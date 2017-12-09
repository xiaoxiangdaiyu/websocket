var http = require('http');
var net = require('net')
var url = require('url');
var crypto = require('crypto');
var querystring = require('querystring');
// 指定拼接字符
var ws_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var br = '\r\n'

var server = net.createServer()
var utils = {
    formatHeader: function (str) {
        var arr = str.split('\r\n'),
            len = arr.length,
            headers = {}
        for (var i = 0; i < len; i++) {
            var items = arr[i].split(':')
            if (items.length < 2) continue;
            headers[items[0].trim()] = items[1].trim()
        }

        var firstLine = arr[0].split(' ')
        headers.method = firstLine[0]
        headers.path = firstLine[1]
        // console.dir(headers)
        return headers
    }
}
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
// 
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

server.on('connection', function (sock) {
    sock.once('data', function (data) {
        var headers = utils.formatHeader(data.toString())
        // 即http请求
        if (headers['Upgrade']) {
            handShake(sock, headers)
            sock.on('data', function (e) {
                var frame = decodeFrame(e),
                    data = frame.data,
                    Fin = frame.Fin,
                    opcode = frame.opcode
                if(Fin){
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
                    var datas = '收到数据';
                    datas = encodeFrame(datas)   
                    sock.write(datas)
                }   

            })
        } else {
            sock.write("HTTP/1.1 200 OK\r\nserver: 直解析websocket\r\n\r\n")
            sock.end()
        }
    })
})

server.listen(8081)