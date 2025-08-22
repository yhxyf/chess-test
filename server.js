const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const DatabaseManager = require('./database/DatabaseManager');
// 注意：确保你的 chessRules.js 文件导出了这些函数
const { isValidMove, isCheck, isCheckmate } = require('./game_logic/chessRules');

// 初始化 Express 应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 存储房间信息（内存中缓存，与数据库同步）
const rooms = {};

// 路由：主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：房间页面
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 加入房间
  socket.on('joinRoom', ({ roomId, username }) => {
    let room = rooms[roomId];

    if (!room) {
      const roomRecord = DatabaseManager.getRoom(roomId);
      if (!roomRecord) {
        DatabaseManager.createRoom(roomId, `房间 ${roomId}`);
      }
      room = {
        id: roomId,
        name: `房间 ${roomId}`,
        players: [],
        spectators: [],
        status: 'waiting',
        gameState: {
          board: initializeBoard(),
          currentPlayer: 'red'
        }
      };
      DatabaseManager.saveGameState(roomId, room.gameState.board, 'red');
      rooms[roomId] = room;
    }

    // **需求2：确保用户名唯一**
    let finalUsername = username;
    const allUsers = [...room.players, ...room.spectators];
    while (allUsers.some(u => u.username === finalUsername)) {
      finalUsername = `${username}${Math.floor(Math.random() * 100)}`;
    }
    if (finalUsername !== username) {
      socket.emit('usernameUpdated', { newUsername: finalUsername });
    }
    
    let role = 'spectator';
    if (room.players.length < 2 && room.status === 'waiting') {
      const color = room.players.length === 0 ? 'red' : 'black';
      room.players.push({ id: socket.id, username: finalUsername, color });
      role = 'player';
      DatabaseManager.addPlayer(roomId, finalUsername, color, socket.id);
      
      if (room.players.length === 2) {
        room.status = 'playing';
        DatabaseManager.updateRoomStatus(roomId, 'playing');
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    } else {
      room.spectators.push({ id: socket.id, username: finalUsername });
      role = 'spectator';
      DatabaseManager.addSpectator(roomId, finalUsername, socket.id);
    }

    socket.join(roomId);

    const gameState = DatabaseManager.getGameState(roomId) || room.gameState;
    room.gameState = gameState;
    
    socket.emit('roomInfo', { room, role, username: finalUsername });
    
    const chatHistory = DatabaseManager.getChatMessages(roomId, 50);
    socket.emit('chatHistory', chatHistory);
    
    socket.to(roomId).emit('userJoined', { username: finalUsername, role });
    
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    
    console.log(`用户 ${finalUsername} 以 ${role} 身份加入房间 ${roomId}`);
  });

  // **需求1：切换角色**
  socket.on('switchRole', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'waiting') {
      socket.emit('roleSwitchRejected', { reason: '游戏已经开始或房间不存在，不能切换角色' });
      return;
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
    let newRole = '';

    if (playerIndex > -1) { // 从玩家切换到观众
      const player = room.players.splice(playerIndex, 1)[0];
      room.spectators.push({ id: socket.id, username: player.username });
      DatabaseManager.removePlayer(roomId, socket.id);
      DatabaseManager.addSpectator(roomId, player.username, socket.id);
      newRole = 'spectator';
    } else if (spectatorIndex > -1) { // 从观众切换到玩家
      if (room.players.length >= 2) {
        socket.emit('roleSwitchRejected', { reason: '房间玩家已满' });
        return;
      }
      const spectator = room.spectators.splice(spectatorIndex, 1)[0];
      const color = room.players.length === 0 ? 'red' : 'black';
      room.players.push({ id: socket.id, username: spectator.username, color });
      DatabaseManager.removeSpectator(roomId, socket.id);
      DatabaseManager.addPlayer(roomId, spectator.username, color, socket.id);
      newRole = 'player';
      
      if (room.players.length === 2) {
        room.status = 'playing';
        DatabaseManager.updateRoomStatus(roomId, 'playing');
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    } else {
      return; // 用户不在房间内
    }

    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    // 通知所有人角色变化
    io.to(roomId).emit('userRoleChanged', { username, newRole });
    console.log(`用户 ${username} 在房间 ${roomId} 切换角色为 ${newRole}`);
  });
  
  // 玩家移动棋子
  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== room.gameState.currentPlayer) {
      return socket.emit('moveRejected', { reason: '不是你的回合' });
    }
    
    if (!isValidMove(from.row, from.col, to.row, to.col, player.color, room.gameState.board)) {
      return socket.emit('moveRejected', { reason: '非法移动' });
    }
    
    const piece = room.gameState.board[from.row][from.col];
    room.gameState.board[to.row][to.col] = piece;
    room.gameState.board[from.row][from.col] = null;
    
    if (piece) {
      piece.row = to.row;
      piece.col = to.col;
    }
    
    room.gameState.currentPlayer = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
    room.gameState.isCheck = isCheck(room.gameState.currentPlayer, room.gameState.board);
    
    DatabaseManager.saveGameState(roomId, room.gameState.board, room.gameState.currentPlayer);
    io.to(roomId).emit('gameStateUpdate', room.gameState);
    
    if (isCheckmate(room.gameState.currentPlayer, room.gameState.board)) {
      const winner = player.color;
      room.status = 'finished';
      DatabaseManager.updateRoomStatus(roomId, 'finished');
      io.to(roomId).emit('gameOver', { winner });
      io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
    }
  });

  socket.on('sendMessage', ({ roomId, message, username }) => {
    DatabaseManager.saveChatMessage(roomId, username, message);
    io.to(roomId).emit('newMessage', { username, message });
  });

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      let userLeft = null;

      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        userLeft = room.players.splice(playerIndex, 1)[0];
        DatabaseManager.removePlayer(roomId, socket.id);
        if (room.status === 'playing') {
          room.status = 'finished';
          DatabaseManager.updateRoomStatus(roomId, 'finished');
          io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
          io.to(roomId).emit('gameOver', { winner: room.players[0]?.color, reason: `${userLeft.username} 断线` });
        }
      }

      const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
      if (spectatorIndex !== -1) {
        userLeft = room.spectators.splice(spectatorIndex, 1)[0];
        DatabaseManager.removeSpectator(roomId, socket.id);
      }

      if (userLeft) {
        io.to(roomId).emit('userLeft', { username: userLeft.username });
        io.to(roomId).emit('playersListUpdate', room.players);
        io.to(roomId).emit('spectatorsListUpdate', room.spectators);
      }
    }
  });
});

// **需求4：修复棋盘布局**
function initializeBoard() {
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 红方 (bottom)
  board[0][0] = { color: 'red', type: 'chariot' };
  board[0][1] = { color: 'red', type: 'horse' };
  board[0][2] = { color: 'red', type: 'elephant' }; // 相
  board[0][3] = { color: 'red', type: 'advisor' };  // 仕
  board[0][4] = { color: 'red', type: 'general' };   // 帅
  board[0][5] = { color: 'red', type: 'advisor' };  // 仕
  board[0][6] = { color: 'red', type: 'elephant' }; // 相
  board[0][7] = { color: 'red', type: 'horse' };
  board[0][8] = { color: 'red', type: 'chariot' };
  board[2][1] = { color: 'red', type: 'cannon' };
  board[2][7] = { color: 'red', type: 'cannon' };
  board[3][0] = { color: 'red', type: 'soldier' };
  board[3][2] = { color: 'red', type: 'soldier' };
  board[3][4] = { color: 'red', type: 'soldier' };
  board[3][6] = { color: 'red', type: 'soldier' };
  board[3][8] = { color: 'red', type: 'soldier' };
  
  // 黑方 (top)
  board[9][0] = { color: 'black', type: 'chariot' };
  board[9][1] = { color: 'black', type: 'horse' };
  board[9][2] = { color: 'black', type: 'elephant' }; // 象
  board[9][3] = { color: 'black', type: 'advisor' };  // 士
  board[9][4] = { color: 'black', type: 'general' };   // 将
  board[9][5] = { color: 'black', type: 'advisor' };  // 士
  board[9][6] = { color: 'black', type: 'elephant' }; // 象
  board[9][7] = { color: 'black', type: 'horse' };
  board[9][8] = { color: 'black', type: 'chariot' };
  board[7][1] = { color: 'black', type: 'cannon' };
  board[7][7] = { color: 'black', type: 'cannon' };
  board[6][0] = { color: 'black', type: 'soldier' };
  board[6][2] = { color: 'black', type: 'soldier' };
  board[6][4] = { color: 'black', type: 'soldier' };
  board[6][6] = { color: 'black', type: 'soldier' };
  board[6][8] = { color: 'black', type: 'soldier' };
  
  // 添加行列信息
  for(let r=0; r<10; r++) {
    for(let c=0; c<9; c++) {
      if(board[r][c]) {
        board[r][c].row = r;
        board[r][c].col = c;
      }
    }
  }

  return board;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});