# 实现一个websocket服务器-实践篇 

早点时候翻译了篇[实现一个websocket服务器-理论篇 ](https://github.com/xiaoxiangdaiyu/chartroom/blob/master/src/websocket/README.md)，简单介绍了下理论基础，本来打算放在一起，但是感觉太长了大家可能都看不下去。不过发现如果拆开的话，还是不可避免的要提及理论部分。用到的地方就简要回顾一下好了。
## Websockt 基本通信流程
在具体代码实现之前，我们需要大概理一下思路。回顾一下websocket的理论部分。简单的websocket流程如下(这里就不谈详细的过程了，大概描述一下)   

1. 客户端发送握手请求
2. 服务器响应、处理握手并返回 
3. 客户端验证通过后，发送数据
4. 服务器接收、处理数据，然后返回给客户端
5. 客户端接收服务器的推送  

作为一个服务器而言，我们主要的精力需要放在2，4这两个步骤。
## 响应并处理握手   

虽然websocket可以实现服务器推送，前提在于该连接已经建立。第客户端仍然需要发起一个Websocket握手请求。 既然要响应该握手请求，我们需要了解一下该请求。
### 客户端握手请求

客户端的握手请求是一个标准的HTTP请求，大概像下面的例子。   
 
```  
GET / HTTP/1.1  //HTTP版本必须1.1及以上，请求方式为GET
Host: localhost:8081 //本地项目
Connection: Upgrade 
Pragma: no-cache
Cache-Control: no-cache
Upgrade: websocket //指定websocket协议
Origin: http://192.168.132.170:8000
Sec-WebSocket-Version: 13 //版本
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: optimizelyEndUserId=oeu1505722530441r0.5993643212774391; _ga=GA1.1.557695983.1505722531
Sec-WebSocket-Key: /2R6uuzPqLT/6z8fnZfN3w==   //握手返回基于该密钥
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
  
```     
上面列出了实际例子中的请求头，内容由浏览器生成，需要注意的部分如下。  

* HTTP版本必须1.1及以上，请求方式为GET
* Connection: Upgrade  
* Upgrade: websocket //指定websocket  
* Sec-WebSocket-Key  密钥 服务器处理握手的依据 

  
我们服务器处理握手的时候需要关注的就是上面四点。
   
### 响应握手请求

服务器处理根据是否满足websocket的必须请求头，分下面两种情况：  
  
1. 不满足，作为http请求来响应。
2. 满足，解析处理按照websocket规定的数据格式来响应 

#### 返回格式  

```  
    HTTP/1.1 101 Switching Protocols
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
``` 
请注意每一个header以\r\n结尾并且在最后一个后面加入额外的\r\n。 

这里的Sec-WebSocket-Accept 就是基于请求头中Sec-WebSocket-Key来生成。规则如下：  
Sec-WebSocket-Key 和"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"链接，通过SHA-1 hash获得结果，然后返回该结果的base64编码。
代码如下：

```  
// 指定拼接字符
var ws_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
// 生成相应key
function getAccpectKey(rSWKey) {
    return crypto.createHash('sha1').update(rSWKey + ws_key).digest('base64')
}
function handShake(socket, headers) {
    var reqSWKey = headers['Sec-WebSocket-Key'],
        resSWKey = getAccpectKey(reqSWKey)
    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write('Connection: Upgrade\r\n');
    socket.write('Sec-WebSocket-Accept: ' + resSWKey + '\r\n');
    socket.write('\r\n');
}
```  

这样我们的握手协议就算完成了，此时会触发客户端websocket的onopen事件，即websocket打开，可以进行通信

### 解析数据  
#### 客户端发送帧格式
握手协议完成之后，我们就该解析数据了，还是要把这张帧格式拿出来。  

```  
    帧格式:  
​​
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+

```

每个从客户端发送到服务器的数据帧遵循上面的格式。  

1. MASK位：只表明信息是否已进行掩码处理。来自客户端的消息必须经过处理，因此我们应该将其置为1   

2. opcode字段定义如何解析有效的数据：  
    * 0x0 继续处理
    * 0x1 text(必须是UTF-8编码)  
    * 0x2 二进制 和其他叫做控制代码的数据。
    * 0x3-0x7 0xB-0xF 该版本的WebSockets无意义   

3. FIN 表明是否是数据集合的最后一段消息，如果为0，服务器继续监听消息，以待消息剩余的部分。否则服务器认为消息已经完全发送。
4. Payload len：有效数据长度  
    * Payload len<126, 即为真实长度
    * 126,说明真实长度大于125，后面2个字节的值为真实长度
    * 127,真实长度大于65535，后面8字节值为真实长度 
      

#### 解析数据  
所谓解析数据，肯定是基于上面的格式按照一定规则来进行处理。下面就是处理的规则。  
  
1. 获取有效数据长度  
2. 获取掩码并依据规则进行反序列化数据

直接看代码应该更加直接。    

```
// 解析接受的数据帧
function decodeFrame(buffer) {
    /**
     * >>> 7 右移操作，即字节右移7位，目的是为了即只取第一位的值
     * 10010030  ====>   00000001
     * & 按位与  同1为1    
     * 15二进制表示为：00001111  ,运算之后前四位即为0，得到后四位的值
     * 11011000 & 00001111  ===》  00001000
     *  
     */
    var fBite = buffer[0],
        /**
         * 获取Fin的值，
         * 1传输结束
         * 0 继续监听 
         */
        Fin = fBite >>> 7,
        /**
         * 获取opcode的值，opcode为fBite的4-7位
         * & 按位与  同1为1    
         * 15二进制表示为：00001111  ,运算之后前四位即为0，得到后四位的值
         */
        opcode = buffer[0] & 15,
        /**
         * 获取有效数据长度 
         */
        len = buffer[1] & 127,
        // 是否进行掩码处理，客户端请求必须为1
        Mask = buffer[1] >>> 7,
        maskKey = null
    // 获取数据长度
    //真实长度大于125，读取后面2字节
    if (len == 126) {
        len = buffer.readUInt16BE(2)
    } else if (len == 127) {
        // 真实长度大于65535，读取后面8字节
        len = buffer.readUInt64BE(2)
    }
    // 判断是否进行掩码处理
    Mask && (maskKey = buffer.slice(2,5))
    /**
     * 反掩码处理 
     * 循环遍历加密的字节（octets，text数据的单位）并且将其与第（i%4）位掩码字节(即i除以4取余)进行异或运算
     */
    if(Mask){
        for (var i = 2;i<len ;i++){
            buffer[i] = maskKey[(i - 2) % 4] ^ buffer[i];
        }
    }
    var data = buffer.slice(2)
    return {
        Fin:Fin,
        opcode:opcode,
        data:data
    }
}
```    

#### 发送数据
处理完接收到的数据之后，下面就是发送响应了。 
响应数据不需要进行掩码运算，只需要根据帧的格式(即上面的帧)，将数据进行组装就好

```
// 加密发送数据
function encodeFrame(data){
    var len = Buffer.byteLength(data),
        // 2的64位
        payload_len = len > 65535 ?10:(len > 125 ? 4 : 2),
        buf = new Buffer(len+payload_len)
    /**
     * 首个字节，0x81 = 10000001 
     *对应的Fin 为1 opcode为001 mask 为0 
     * 即表明 返回数据为txt文本已经结束并未使用掩码处理
     */
    buf[0] = 0x81  
    /**
     * 根据真实数据长度设置payload_len位
     */        
    if(payload_len == 2){
        buf[1] = len
    }else if(payload_len == 4){
        buf[1] = 126;
        buf.writeUInt16BE(payload_len, 2);
    }else {
        buf[1] = 127;
        buf.writeUInt32BE(payload_len >>> 32, 2);
        buf.writeUInt32BE(payload_len & 0xFFFFFFFF, 6);
    }  
    buf.write(data, payload_len);
    return buf;
}    
```    

#### 心跳响应  
当收到opcode 为 9时即ping请求，直接返回具有完全相同有效数据的pong即可。
Pings的opcode为0x9，pong是0xA，所以可以直接如下   

```
// ping请求
if(opcode == 9){
   console.log("ping相应");
   /**
    * ping pong最大长度为125，所以可以直接拼接
    * 前两位数据为10001010+数据长度
    * 即传输完毕的pong响应，数据肯定小于125
    */
    socke.write(Buffer.concat([new Buffer([0x8A, data.length]), data]))
}
```  

## 结束语 
至此，一个websocket服务器的简单实现就完成了[更多细节请查看](https://github.com/xiaoxiangdaiyu/chartroom/blob/master/src/websocket/ws.js)。当然成熟的websocket库处理各种情况是比较完善的，更推荐大家使用，这里只是简单实践，更多的是满足一下自己的好奇心，知其然，也要知其所以然，希望大家共同学习和进步
## 参考文章  
[细说WebSocket - Node篇](http://www.cnblogs.com/hustskyking/p/websocket-with-node.html)
[WebSocket - 初入探究 与 实现](http://www.jianshu.com/p/e9b86589f6aa)











