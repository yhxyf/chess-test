const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const DatabaseManager = require('./database/DatabaseManager');
const { isValidMove, isCheck, isCheckmate } = require('./game_logic/chessRules');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// 使用一个更健壮的内存缓存
const rooms = {};

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// 广播大厅的房间列表
function broadcastRooms() {
    const roomList = Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        spectators: room.spectators.length,
        status: room.status
    }));
    io.to('lobby').emit('roomListUpdate', roomList);
}


io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  socket.join('lobby');
  broadcastRooms(); // 新用户连接时发送一次房间列表

  socket.on('getRoomList', () => {
    broadcastRooms();
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    socket.leave('lobby');
    let room = rooms[roomId];

    if (!room) {
      DatabaseManager.getRoom(roomId) || DatabaseManager.createRoom(roomId, `房间 ${roomId}`);
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
      
      if (room.players.length === 2) {
        room.status = 'playing';
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    } else {
      room.spectators.push({ id: socket.id, username: finalUsername });
    }

    socket.join(roomId);
    
    room.gameState = DatabaseManager.getGameState(roomId) || room.gameState;
    
    socket.emit('roomInfo', { room, role, username: finalUsername });
    socket.emit('chatHistory', DatabaseManager.getChatMessages(roomId, 50));
    socket.to(roomId).emit('userJoined', { username: finalUsername, role });
    
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    
    broadcastRooms();
    console.log(`用户 ${finalUsername} 以 ${role} 身份加入房间 ${roomId}`);
  });

  socket.on('switchRole', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'waiting') {
      return socket.emit('roleSwitchRejected', { reason: '游戏已经开始或房间不存在' });
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
    let newRole = '';

    if (playerIndex > -1) {
      const player = room.players.splice(playerIndex, 1)[0];
      room.spectators.push({ id: socket.id, username: player.username });
      newRole = 'spectator';
    } else if (spectatorIndex > -1) {
      if (room.players.length >= 2) {
        return socket.emit('roleSwitchRejected', { reason: '房间玩家已满' });
      }
      const spectator = room.spectators.splice(spectatorIndex, 1)[0];
      const color = room.players.length === 0 ? 'red' : 'black';
      room.players.push({ id: socket.id, username: spectator.username, color });
      newRole = 'player';
      
      if (room.players.length === 2) {
        room.status = 'playing';
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    } else { return; }

    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    io.to(roomId).emit('userRoleChanged', { username, newRole });
    broadcastRooms();
    console.log(`用户 ${username} 在房间 ${roomId} 切换角色为 ${newRole}`);
  });
  
  // -- BUG FIX: 移动逻辑重写 --
  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') {
      return socket.emit('moveRejected', { reason: '游戏未在进行中' });
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      return socket.emit('moveRejected', { reason: '您不是玩家' });
    }

    if (player.color !== room.gameState.currentPlayer) {
      return socket.emit('moveRejected', { reason: '不是您的回合' });
    }
    
    const piece = room.gameState.board[from.row] && room.gameState.board[from.row][from.col];
    if (!piece || piece.color !== player.color) {
        return socket.emit('moveRejected', { reason: '不能移动该棋子' });
    }

    if (!isValidMove(from.row, from.col, to.row, to.col, player.color, room.gameState.board)) {
      return socket.emit('moveRejected', { reason: '非法移动' });
    }
    
    // 执行移动
    room.gameState.board[to.row][to.col] = piece;
    room.gameState.board[from.row][from.col] = null;
    piece.row = to.row;
    piece.col = to.col;
    
    // 切换回合
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
      broadcastRooms();
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
      if (playerIndex > -1) {
        userLeft = room.players.splice(playerIndex, 1)[0];
        if (room.status === 'playing') {
          room.status = 'finished';
          io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
          const winner = room.players[0]?.color;
          if (winner) {
            io.to(roomId).emit('gameOver', { winner: winner, reason: `${userLeft.username} 断线` });
          }
        }
      } else {
        const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
        if (spectatorIndex > -1) {
          userLeft = room.spectators.splice(spectatorIndex, 1)[0];
        }
      }

      if (userLeft) {
        io.to(roomId).emit('userLeft', { username: userLeft.username });
        io.to(roomId).emit('playersListUpdate', room.players);
        io.to(roomId).emit('spectatorsListUpdate', room.spectators);
        broadcastRooms();
        // 如果房间空了，可以从内存中移除
        if (room.players.length === 0 && room.spectators.length === 0) {
            delete rooms[roomId];
        }
      }
    }
  });
});

function initializeBoard() {
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 红方 (bottom, for rendering)
  board[9][0] = { color: 'red', type: 'chariot' };
  board[9][1] = { color: 'red', type: 'horse' };
  board[9][2] = { color: 'red', type: 'elephant' };
  board[9][3] = { color: 'red', type: 'advisor' };
  board[9][4] = { color: 'red', type: 'general' };
  board[9][5] = { color: 'red', type: 'advisor' };
  board[9][6] = { color: 'red', type: 'elephant' };
  board[9][7] = { color: 'red', type: 'horse' };
  board[9][8] = { color: 'red', type: 'chariot' };
  board[7][1] = { color: 'red', type: 'cannon' };
  board[7][7] = { color: 'red', type: 'cannon' };
  board[6][0] = { color: 'red', type: 'soldier' };
  board[6][2] = { color: 'red', type: 'soldier' };
  board[6][4] = { color: 'red', type: 'soldier' };
  board[6][6] = { color: 'red', type: 'soldier' };
  board[6][8] = { color: 'red', type: 'soldier' };
  
  // 黑方 (top, for rendering)
  board[0][0] = { color: 'black', type: 'chariot' };
  board[0][1] = { color: 'black', type: 'horse' };
  board[0][2] = { color: 'black', type: 'elephant' };
  board[0][3] = { color: 'black', type: 'advisor' };
  board[0][4] = { color: 'black', type: 'general' };
  board[0][5] = { color: 'black', type: 'advisor' };
  board[0][6] = { color: 'black', type: 'elephant' };
  board[0][7] = { color: 'black', type: 'horse' };
  board[0][8] = { color: 'black', type: 'chariot' };
  board[2][1] = { color: 'black', type: 'cannon' };
  board[2][7] = { color: 'black', type: 'cannon' };
  board[3][0] = { color: 'black', type: 'soldier' };
  board[3][2] = { color: 'black', type: 'soldier' };
  board[3][4] = { color: 'black', type: 'soldier' };
  board[3][6] = { color: 'black', type: 'soldier' };
  board[3][8] = { color: 'black', type: 'soldier' };
  
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
  console.log(`服务器运行在端口 http://localhost:${PORT}`);
});