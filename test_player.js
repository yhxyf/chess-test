const io = require('socket.io-client');

// 连接到服务器
const socket = io('http://localhost:3000');

// 房间ID和用户名
const roomId = 'test-room-2';
const username = '玩家' + Math.floor(Math.random() * 1000);

// 监听连接成功
socket.on('connect', () => {
  console.log(`玩家 ${username} 已连接到服务器`);
  
  // 加入房间
  socket.emit('joinRoom', { roomId, username });
});

// 监听房间信息
socket.on('roomInfo', ({ room, role }) => {
  console.log(`玩家 ${username} 以 ${role} 身份加入房间 ${room.id}`);
  console.log('房间状态:', room.status);
  console.log('玩家列表:', room.players);
  console.log('观战者列表:', room.spectators);
  
  // 如果是玩家角色，尝试移动棋子
  if (role === 'player') {
    setTimeout(() => {
      console.log('尝试移动棋子...');
      // 红方先行，移动兵
      socket.emit('playerMove', { 
        roomId, 
        from: { row: 3, col: 0 }, 
        to: { row: 4, col: 0 } 
      });
    }, 5000);
  }
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
  console.log('当前玩家:', gameState.currentPlayer);
});

// 监听移动被拒绝
socket.on('moveRejected', ({ reason }) => {
  console.log(`移动被拒绝: ${reason}`);
});

// 监听游戏结束
socket.on('gameOver', ({ winner }) => {
  console.log(`游戏结束！${winner}获胜！`);
});

// 监听房间状态更新
socket.on('roomStatusUpdate', ({ status }) => {
  console.log(`房间状态更新为: ${status}`);
});

// 发送测试消息
setTimeout(() => {
  console.log('发送测试消息...');
  socket.emit('sendMessage', { roomId, message: '我是玩家，正在游戏中', username });
}, 3000);

// 60秒后断开连接
setTimeout(() => {
  console.log('玩家断开连接');
  socket.disconnect();
}, 60000);