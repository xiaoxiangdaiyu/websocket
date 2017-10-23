// in your nodeserver file
var ws = require('node-websocket').init;
var sockets = [],
users = {}
// bind events
ws.on('connection', function(socket) {
  console.log(socket.id); // ID in cookie,key: socketId
  ws.on('join', function(data) {
    console.log(data)
    var obj = data
    console.log(obj)
    if(obj.id && obj.name){
      var id = obj.id,
          name = obj.name
      socket.send(JSON.stringify('欢迎'+obj.name+'登录'));
      users[obj.id] = obj.name
    setTimeout(function(){
      socket.send(JSON.stringify({
        nums:1,
        show:'尊敬的用户'+name+'请注意，现在要吃饭了',
        id:id
      }));
    },3000)
  }
  });
});

// You should emit server's close event and delete socket object when frontend exit
ws.on('close', function(socketId) {
  console.log('close ' + socketId);
  delete sockets[socketId];
});

// you need start server in the end
ws.start(8080);