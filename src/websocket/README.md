# how to write websocket server   
翻译自MDN[Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)
## websocket服务器的本质
WebSocket 服务器简单来说就是一个遵循特殊协议监听服务器任意端口的tcp应用。搭建一个定制服务器的任务通常会让让人们感到害怕。然而基于实现一个简单的Websocket服务器没有那么麻烦。   

一个WebSocket server可以使用任意的服务端编程语言来实现，只要该语言能实现基本的Berkeley sockets（伯克利套接字）。例如c(++)、Python、PHP、服务端JavaScript(node.js)。下面不是关于特定语言的教程，而是一个促进你搭建自己服务器的指南。   

你需要明白http如何工作并且有中等编程经验。基于特定语言的支持，了解TCP sockets 同样也是必要的。该篇教程的范围是介绍开发一个WebSocket server需要的最少知识。   

该文章将会从很底层的观点来解释一个 WebSocket server。WebSocket servers 通常是独立的专门的servers(因为负载均衡和其他一些原因),因此你通常使用一个反向代理（例如一个标准的HTTP server）来发现 WebSocket握手协议，预处理他们然后将客户端信息发送给真正的WebSocket server。这意味着你的WebSocket server不必充斥这cookie和签名的处理方法。完全可以放在代理中处理。   
## websocket 握手规则    

首先，服务器必须使用标准的TCPsocket来监听即将到来的socket连接。基于你的平台，这些很可能被你处理了(成熟的服务端语言提供了这些接口，使我们不必从头做起)。例如，假设你的服务器监听example.com的8000端口，socket server响应/chat的GET请求。 
  





