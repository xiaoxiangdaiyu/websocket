# 实现一个websocket服务器-理论篇 

## websocket服务器的本质
WebSocket 服务器简单来说就是一个遵循特殊协议监听服务器任意端口的tcp应用。搭建一个定制服务器的任务通常会让让人们感到害怕。然而基于实现一个简单的Websocket服务器没有那么麻烦。   

一个WebSocket server可以使用任意的服务端编程语言来实现，只要该语言能实现基本的Berkeley sockets（伯克利套接字）。例如c(++)、Python、PHP、服务端JavaScript(node.js)。下面不是关于特定语言的教程，而是一个促进我们搭建自己服务器的指南。   

我们需要明白http如何工作并且有中等编程经验。基于特定语言的支持，了解TCP sockets 同样也是必要的。该篇教程的范围是介绍开发一个WebSocket server需要的最少知识。   

该文章将会从很底层的观点来解释一个 WebSocket server。WebSocket servers 通常是独立的专门的servers(因为负载均衡和其他一些原因),因此通常使用一个反向代理（例如一个标准的HTTP server）来发现 WebSocket握手协议，预处理他们然后将客户端信息发送给真正的WebSocket server。这意味着WebSocket server不必充斥这cookie和签名的处理方法。完全可以放在代理中处理。   
## websocket 握手规则    

首先，服务器必须使用标准的TCPsocket来监听即将到来的socket连接。基于我们的平台，这些很可能被我们处理了(成熟的服务端语言提供了这些接口，使我们不必从头做起)。例如，假设我们的服务器监听example.com的8000端口，socket server响应/chat的GET请求。   

警告：服务器可以选择监听任意端口，但是如果在80或443之外，可能会遇到防火墙或者代理的问题。443端口大多数情况下是可以的，当然需要一个安全连接(TLS/SSL)。此外，注意这一点，大多数浏览器不允许从安全的页面连接到不安全的Websocket服务器。  
在WebSockets中握手是web，是HTTP想WS转化的桥梁。通过握手，连接的详情会被判断，并且在完成之前每一个部分都可以终端如果条件不满足。服务器必须谨慎解析客户端请求的所有信息，否则安全问题将会发生。  

## 客户端握手请求   

尽管我们在开发一个服务器，客户端仍然需要发起一个Websocket握手过程。因此我们必须知道如何解析客户端的请求。客户端将会发送一个标准的HTTP请求，大概像下面的例子(HTTP版本必须1.1及以上，请求方式为GET)。   
 
```  
    GET /chat HTTP/1.1
    Host: example.com:8000
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
    Sec-WebSocket-Version: 13  
```     
 
 
此处客户端可以发起扩展或者子协议，在[Miscellaneous](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#Miscellaneous)查看更多细节。同样，公共的headers像User-Agent, Referer, Cookie, or authentication等同样可以包括，一句话做你想做的。这些并不直接和WebSocket相关，忽略掉他们也是安全的，在很多公共的设置中，会有一个代理服务器来处理这些信息。 

如果有的header不被识别或者有非法值，服务器应该发送'400 Bad Request'并立刻关闭socket，通常也会在HTTP返回体中给出握手失败的原因，不过这些信息可能不会被展示(因为浏览器不会展示他们)。如果服务器不识别WebSockets的版本，应该返回一个Sec-WebSocket-Version 消息头，指明可以接受的版本(最好是V13,及最新)。下面一起看一下最神秘的消息头Sec-WebSocket-Key。    

### 提示：
* 所有的浏览器将会发送一个Origin header,我们可以使用这个header来做安全限制（检查是否相同的origin）如果并不是期望的origin返回一个403 Forbidden。然后注意下那些非浏览器的客户端可以发送一个伪造的origin，很多应用将会拒绝没有该消息头的请求。  
* 请求资源定位符(这里的/chat)在规范中没有明确的定义，所以很多人巧妙的使用它，让一个服务器处理多个WebSocket 应用。例如，example.com/chat可以指向一个多用户聊天app，而相同服务器上的/game指向多用户的游戏。即[相同域名下的路径可以指向不同应用]()。   
* 规范的HTTP code只可以在握手之前使用，当握手成功之后，应该使用不同的code集合。请查看规范第7.4节   

## 服务器握手返回  

当服务器接受到请求时，应该发送一个相当奇怪的响应，看起来大概这个样子，不过仍然遵循HTTP规范。 请注意每一个header以\r\n结尾并且在最后一个后面加入额外的\r\n。 

```  
    HTTP/1.1 101 Switching Protocols
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```  

此外，服务器可以在这里决定扩展或者子协议请求。更多详情请查看[Miscellaneous](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#Miscellaneous)。Sec-WebSocket-Accept 部分很有趣，服务器必须基于客户端请求的Sec-WebSocket-Key 中得到它，具体做法如下：将Sec-WebSocket-Key 和"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"链接，通过SHA-1 hash获得结果，然后返回该结果的base64编码。

###提示  
因为这个看似复杂的过程存在，所以客户端不用关心服务器是否支持websocket。另外，该过程的重要性还是在于安全性，如果一个服务器将一个Websocket连接作为http请求解析的话，将会有不小的问题。   

因此，如果key是"dGhlIHNhbXBsZSBub25jZQ=="，Accept将会是"s3pPLMBiTxaQ9kYGzzhZRbK+xOo="，一旦服务器发送这些消息头，握手协议就完成了。   

服务器在回复握手之前，可以发送其他的header像Set-Cookie、要求签名、重定向等。   

## 跟踪客户端  

虽然并不直接与Websocket协议相关，但值得我们注意。服务器将会跟踪客户端的sockets，因此我们不必和已经完成握手协议的客户端再次进行握手。相同客户端的IP地址可以尝试多次连接(但是服务器可以选择拒绝，如果他们尝试多次连接以达到保存自己Denial-of-Service 踪迹的目的)  

## FramesEdit 数据交换  

客户端和服务器都可以在任意时间发送消息、这正是websocket的魔力所在。然而从数据帧中提取信息的过程就不那么充满魔力了。尽管所有的帧遵循相同的特定格式，从客户端发到服务器的数据通过X异或加密 (使用32位的密钥)进行处理，该规范的第五章详细描述了相关内容。
 
     
## 格式  
每个从客户端发送到服务器的数据帧遵循下面的格式：  
  
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


MASK (掩码:一串二进制代码对目标字段进行位与运算，屏蔽当前的输入位。)位只表明信息是否已进行掩码处理。来自客户端的消息必须经过处理，因此我们应该将其置为1(事实上5.1节表明，如果客户端发送未掩码处理的消息，服务器必须断开连接)当发送一个帧至客户端时，不要处理数据并且不设置mask位。下面将会阐述原因。注意：我们必须处理消息即使用一个安全的socket。RSV1-3可以被忽略，这是待扩展位。   

opcode字段定义如何解析有效的数据：  
* 0x0 继续处理
* 0x1 text(必须是UTF-8编码)  
* 0x2 二进制 和其他叫做控制代码的数据。
* 0x3-0x7 0xB-0xF 该版本的WebSockets无意义   

FIN 表明是否是数据集合的最后一段消息，如果为0，服务器继续监听消息，以待消息剩余的部分。否则服务器认为消息已经完全发送。   

## 有效编码数据长度  

为了解析有效编码数据，我们必须知道何时结束。这是知道有效数据长度的重要所在。不幸的是，有一些复杂。让我们分步骤来看。  
1. 阅读9-15位并且作为无符号整数解释，如果是小于等于125，这就是数据的长度。如果是126，请继续步骤2,如果是127请阅读，步骤3   
2. 阅读后面16位并且作为无符号整数解读，结束  
3. 阅读后面64位并且作为无符号整数解读，结束    


## 读取并反掩码数据  

如果MASK位被设置(当然它应该被设置，对于一个从客户端到服务器的消息)，读取后4字节（即32位），即加密的key。一旦数据长度和加密key被解码，我们可以直接从socket中读取成批的字节。获取编码的数据和掩码key，将其解码，循环遍历加密的字节（octets，text数据的单位）并且将其与第（i%4）位掩码字节(即i除以4取余)进行异或运算，如果用js就如下所示(该规则就是加密解密的规则而已，没必要深究，大家知道如何使用就好)。 

```js
var DECODED = "";
    for (var i = 0; i < ENCODED.length; i++) {
        DECODED[i] = ENCODED[i] ^ MASK[i % 4];
    }
``` 

现在我们可以知道我们应用上解码之后的数据具体含义了。

## 消息分割

FIN和opcode字段共同工作来讲一个消息分解为单独的帧，该过程叫做消息分割，只有在opcodes为0x0-0x2时才可用（前面也提到，当前版本其他数值无意义）。  

回想一下，opcode指明了一个帧的将要做什么，如果是0x1，数据是text。如果是0x2，诗句是二进制数据。然而当其为0x0时，该帧是一个继续帧，表示服务器应该将该帧的有效数据和服务器收到的最后一帧链接起来。这是一个草图，指明了当客户端发送text消息时，第一个消息在一个单独的帧里发送，然而第二个消息却包括三个帧，服务器如何反应。FIN和opcode细节仅仅对客户端展示。看一下下面的例子应该会更容易理解。
  
```   
Client: FIN=1, opcode=0x1, msg="hello"
Server: (消息传输过程完成) Hi.
Client: FIN=0, opcode=0x1, msg="and a"
Server: (监听，新的消息包含开始的文本)
Client: FIN=0, opcode=0x0, msg="happy new"
Server: (监听，有效数据与上面的消息拼接)
Client: FIN=1, opcode=0x0, msg="year!"
Server: (消息传输完成) Happy new year to you too!
     
``` 
 
注意:第一帧包括一个完全的消息(FIN=1并且opcode!=0x0)，因此当服务器发现结束时可以返回。第二帧有效数据为text(opcode=0x1)，但是完整的消息没有到达(FIN=0)。该消息所有剩下的部分通过继续帧发送(opcode=0x0)，并且最后以帧通过FIN=1表明身份。  

## WebSockets 的心跳：ping和pong  

在握手接受之后的任意点，不论是客户端还是服务器都可以选择发送ping给另一部分。当ping被接收时，接收方必须尽可能的返回一个pong。我们可以用该方式来确保连接依然有效。  

一个ping或者pong只是一个规则的帧，但是是控制帧，Pings的opcode为0x9，pong是0xA。当我们得到ping时，返回具有完全相同有效数据的pong。(对ping和pong而言，最大有效数据长度是125)我们可能在没有发送ping的情况下，得到一个pong。这种情况请忽略。

在发送pong之前，如果我们接收到不止一个ping，只需回应一个pong即可。  
## 关闭连接  

要关闭客户端和服务器之间的连接，我们可以发送一个包含特定控制队列的数据的控制帧来开始关闭的握手协议。当接收到该帧时，另一方发送一个关闭帧作为回应。然后前者会关闭连接。关闭连接之后接收到的数据都会被丢弃。

## 更多  

WebSocket 扩展和子协议在握手过程中通过headers进行约定。有时扩展和子协议太近似了以致于难以分别。最基本的区别是，扩展控制websocket 帧并且修改有效数据。然而子协议构成websocket有效数据并且从不修改任何事物。扩展是可选的广义的，子协议是必须的局限性的。

### 扩展 

将扩展看作压缩一个文件在发送之前，无论你如何做，你将发送相同的数据只不过帧不同而已。收件人最终将会受到与你本地拷贝相同的数据，不过以不同方式发送。这就是扩展做的事情。websockets定义了一个协议和基本的方式去发送数据，然而扩展例如压缩可以以更短的帧来阿松相同的数据。 

### 子协议  

将子协议看作定做的xml表或者文档类型说明。你在使用XML和它的语法，但是你被限制于你同意的结构。WebSocket子协议就是如此。他们不介绍其他一些华丽的东西，仅仅建立结构，像一个文档类型和表一样，两个部分(client & server)都同意该协议,和文档类型和表不同，子协议由服务器实现并且客户端不能对外引用。  
一个客户端必须请求特定的子协议，为了达到目的，将会发送一些像下面的内容作为原始握手的一部分。  

```
GET /chat HTTP/1.1
...
Sec-WebSocket-Protocol: soap, wamp
```  
或者等价的写法

```
...
Sec-WebSocket-Protocol: soap
Sec-WebSocket-Protocol: wamp
```
现在，服务器必须选择客户端建议并且支持的一种协议。如果多余一个，发送客户端发送过来的第一个。想象我们的服务器可以使用soap和wamp中的一个，然后，返回的握手中将会发送如下形式。

```
Sec-WebSocket-Protocol: soap
```

服务器不能发送超过一个的Sec-Websocket-Protocol消息头，如果服务器不想使用任一个子协议，应该不发送Sec-WebSocket-Protocol 消息头。发送一个空白的消息头是错误的。客户端可能会关闭连接如果不能获得期望的子协议。    

如果我们希望我们的服务器遵守一定的子协议，自然地在我们的服务器需要额外的代码。想象我们使用一个子协议json，基于该子协议，所有的数据将会作为JSON传递，如果一个客户端征求子协议并且服务器想使用它，服务你需要有一个JSON解析。实话实说，将会有一个工具库，但是服务器也要需要传递数据。


为了避免名称冲突，推荐选用domain的一部分作为子协议的名称。如果我们开发一个使用特定格式的聊天app，我们可能使用这样的名字:Sec-WebSocket-Protocol: chat.example.com  注意，这不是必须的。仅仅是一个可选的惯例，我们可以使用我们想用的任意字符。
## 结束语 
翻译这篇文档的初衷是看到关于websocket的中文大部分都是客户端相关的内容，自己又对服务器端的实现感兴趣，没有找到合适的资料，就只好自己阅读下英文，本着提高自己的目的将其翻译下来，希望对其他同学有所帮助。  
## 源文档出处  
翻译自MDN[Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)







