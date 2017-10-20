// Create WebSocket connection.
var socket = new WebSocket('ws://localhost:8080');

// Connection opened
socket.addEventListener('open', function (event) {
    socket.send(JSON.stringify('Hello Server!'));
    // socket.send(JSON.stringify({
    //     event: 'join',
    //     data: {
    //       room: 1
    //     }
    //   }))
});

// Listen for messages
socket.addEventListener('message', function (event) {
    console.log('Message from server', event.data);
});
