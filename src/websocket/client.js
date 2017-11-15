// Create WebSocket connection.
var socket = new WebSocket('ws://localhost:8080');
var id = Math.floor(Math.random () * 1000)
function query(selecter){
    return document.querySelector(selecter)
}
function queryAll(selecter){
    return document.querySelectorAll(selecter)
}
// Connection opened
socket.onopen = function (event) {
    console.log('握手成功')
    socket.send('测试一下');
};

// Listen for messages
socket.addEventListener('message', function (event) {
    console.log('Message from server', event.data.toString());
    // var data = JSON.parse(event.data)
    // if(data.id && data.id == id){
    //     render(data) 
    // }else{
    //     query('.show').innerHTML = data
    // }
});
function render(data){
    this.num.innerHTML = data.nums
    this.content.innerHTML = data.show 
}
function init(){
    this.num = query('#num');
    this.content = query('.show');
    this.nums = 0;
    this.show = '';
    render(this)
}
init()