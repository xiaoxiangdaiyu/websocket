var ws = require('node-websocket').init;
var sockets = []
// bind events
ws.on('connection', function(socket) {
  console.log(socket.id); // ID in cookie,key: socketId
  sockets.push(socket.id)
  ws.on('join', function(data) {
    //send message
    socket.send('yes! it will send to frontend');
  });
});

// You should emit server's close event and delete socket object when frontend exit
ws.on('close', function(socketId) {
  console.log('close ' + socketId);
  delete sockets[socketId];
});

// you need start server in the end
ws.start(8080);