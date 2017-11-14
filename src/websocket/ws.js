var http = require('http');
var url = require('url');
var crypto = require('crypto');
// 指定拼接字符
var ws_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
var br = '\r\n'
var server = http.createServer()
server.on('request',function(req,res){  
    console.log('第一次请求进来'+req.upgrade)
    // if(!req.upgrade || req.headers.upgrade != 'websocket'){
    //     res.writeHead(200,{'content-type':'text/plain;charset=UTF-8'})
    //     res.write('当前请求非websokkcet')
    //     res.end()
    // }
    // handShake(req,res)
}); 

server.on('upgrade',function(req,socket,head){
    console.log('upgrade<==>'+req.upgrade)
    if(req.headers.upgrade != 'websocket'){
        console.warn('非websocket')
        socket.close()
    }
    bindEvent(socket)
    handShake(req,socket,head)
})
function bindEvent(socket){
    socket.on('data',function(data){
        console.log(data)
        socket.emit('send',data);
    })
    .on('send',function(data){
        socket.write(data);
        socket.end()
    })
}
function handShake(req,socket){
    var headers = req.headers,
        reqSWKey = headers['Sec-WebSocket-Key'],
        resSWKey = getAccpectKey(reqSWKey)
        socket.write('HTTP/1.1 101 Switching Protocols\r\n');
        // socket.write('Upgrade: websocket\r\n');
        // socket.write('Connection: Upgrade\r\n');
        // socket.write('Sec-WebSocket-Accept: ' + resSWKey + '\r\n');
        // socket.write('\r\n');
}
function getAccpectKey(rSWKey){
    return crypto.createHash('sha1').update(rSWKey + ws_key).digest('base64')
}
server.listen(8080)