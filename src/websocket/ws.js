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
    formatHeader:function(str){
        var arr = str.split('\r\n'),
            len =arr.length,
            headers = {}
        for(var i =0 ;i<len;i++){
            var items = arr[i].split(':')
            if(items.length < 2) continue;
            headers[items[0].trim()] = items[1].trim()
        }    
        
        var firstLine = arr[0].split(' ')
        headers.method = firstLine[0]
        headers.path = firstLine[1]
        console.dir(headers)    
        return headers
    }
}

function getAccpectKey(rSWKey){
    return crypto.createHash('sha1').update(rSWKey + ws_key).digest('base64')
}
function bindEvent(socket){
    socket.on('data',function(data){
        console.log(data)
        socket.emit('send',unMaskData(data));
    })
    .on('send',function(data){
        socket.write(data);
        // socket.end()
    })
}
function handShake(socket,headers){ 
    var reqSWKey = headers['Sec-WebSocket-Key'],
        resSWKey = getAccpectKey(reqSWKey)
        socket.write('HTTP/1.1 101 Switching Protocols\r\n');  
        socket.write('Upgrade: websocket\r\n');  
        socket.write('Connection: Upgrade\r\n');  
        //这个字段带上服务器处理后的KEY  
        socket.write('Sec-WebSocket-Accept: '+resSWKey+'\r\n');  
        //输出空行，使HTTP头结束  
        socket.write('\r\n'); 
}

server.on('connection',function(sock){

    sock.once('data',function(data){
        var headers = utils.formatHeader(data.toString())
        // 即http请求
        if(headers['Upgrade']){
            bindEvent(sock)
            handShake(sock,headers)
        }else{
            sock.write("HTTP/1.1 200 OK\r\nserver: 直解析websocket\r\n\r\n")
            sock.end()
        }
    })
})

server.listen(8080)