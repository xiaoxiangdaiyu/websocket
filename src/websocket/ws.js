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
     * >>> 7 右移操作，即字节右移7位，目的是为了即只取第一字节的值
     * 10010030  ====>   00000001
     * & 按位与  同1为1    
     * 15二进制表示为：00001111  ,运算之后前四位即为0，得到后四位的值
     * 11011000 & 00001111  ===》  00001000
     *  
     */
    var fBite = buffer[0],
        Fin = fBite >>> 7,
        opcode = buffer[0] & 15,
        len = buffer[1] & 127,
        Mask = buffer[1] >>> 7,
        maskKey = null
    // 获取数据长度
    //读取后面16位，即2-3字节
    if (len == 126) {
        len = buffer.readUInt16BE(2)
    } else if (len == 127) {
        // 读取后面64位，即2-9字节
        len = buffer.readUInt64BE(2)
    }
    // 判断是否进行掩码处理
    Mask && (maskKey = buffer.slice(2,5))
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
    //10000010 已经结束并使用掩码处理 
    buf[0] = 0x81       
    if(payload_len == 2){
        buf[1] = payload_len
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
function getAccpectKey(rSWKey) {
    return crypto.createHash('sha1').update(rSWKey + ws_key).digest('base64')
}

function handShake(socket, headers) {
    var reqSWKey = headers['Sec-WebSocket-Key'],
        resSWKey = getAccpectKey(reqSWKey)
    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write('Upgrade: websocket\r\n');
    socket.write('Connection: Upgrade\r\n');
    //这个字段带上服务器处理后的KEY  
    socket.write('Sec-WebSocket-Accept: ' + resSWKey + '\r\n');
    //输出空行，使HTTP头结束  
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
                        socke.write(Buffer.concat([new Buffer([0x8A, data.length]), data]))
                    }
                    var datas = '接收到:';
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

server.listen(8080)