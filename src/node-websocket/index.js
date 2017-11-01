var http = require('http')
var server = new http.Server()
server.on('request',(req,res)=>{
    console.log(req.headers);
    //设置应答头信息
    res.writeHead(200,{'Content-Type':'text/html'});
    res.write('hello we are family<br>');
    res.end('server already end\n');
})
server.on('connection',()=>{
    console.log('a')
});
server.on('close',()=>{
    console.log('server will close');
});
//关闭服务为了触发close事件
server.close();
server.listen(8080);
