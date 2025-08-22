const io = require('socket.io-client');

// 连接到服务器
const socket = io('http://localhost:3000');

// 房间ID和用户名
const roomId = 'test-room-2';
const username = '观战者' + Math.floor(Math.random() * 1000);

// 监听连接成功
socket.on('connect', () => {
  console.log(`观战者 ${username} 已连接到服务器`);
  
  // 加入房间
  socket.emit('joinRoom', { roomId, username });
});

// 监听房间信息
socket.on('roomInfo', ({ room, role }) => {
  console.log(`观战者 ${username} 以 ${role} 身份加入房间 ${room.id}`);
  console.log('房间状态:', room.status);
  console.log('玩家列表:', room.players);
  console.log('观战者列表:', room.spectators);
});

// 监听玩家列表更新
socket.on('playersListUpdate', (players) => {
  console.log(`玩家列表更新:`, players);
});

// 监听观战者列表更新
socket.on('spectatorsListUpdate', (spectators) => {
  console.log(`观战者列表更新:`, spectators);
});

// 监听新消息
socket.on('newMessage', ({ username, message }) => {
  console.log(`[${username}]: ${message}`);
});

// 监听用户加入
socket.on('userJoined', ({ username, role }) => {
  console.log(`${username} 以 ${role} 身份加入了房间`);
});

// 监听用户离开
socket.on('userLeft', ({ socketId }) => {
  console.log(`有用户离开了房间`);
});

// 监听游戏状态更新
socket.on('gameStateUpdate', (gameState) => {
  console.log('游戏状态更新');
});

// 监听房间状态更新
socket.on('roomStatusUpdate', ({ status }) => {
  console.log(`房间状态更新为: ${status}`);
});

// 发送测试消息
setTimeout(() => {
  console.log('发送测试消息...');
  socket.emit('sendMessage', { roomId, message: '我是观战者，正在观看游戏', username });
}, 3000);

// 30秒后断开连接
setTimeout(() => {
  console.log('观战者断开连接');
  socket.disconnect();
}, 30000);