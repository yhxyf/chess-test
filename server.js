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
// 用于存储待处理的角色交换请求
const pendingSwaps = {};


// 路由：主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：房间页面
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


// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  socket.join('lobby');
  broadcastRooms(); // 新用户连接时发送一次房间列表

  socket.on('getRoomList', () => {
    broadcastRooms();
  });


  // 加入房间
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.leave('lobby');
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
    
    broadcastRooms();
    console.log(`用户 ${finalUsername} 以 ${role} 身份加入房间 ${roomId}`);
  });

  // 新的角色切换请求逻辑
  socket.on('requestRoleSwitch', ({ roomId, targetRole }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('roleSwitchError', { reason: '房间不存在' });

    const requesterUser = room.players.find(p => p.id === socket.id) || room.spectators.find(s => s.id === socket.id);
    if (!requesterUser) return socket.emit('roleSwitchError', { reason: '找不到您的信息' });
    
    // 如果已经是目标角色，则不处理
    if ((requesterUser.color === targetRole) || (targetRole === 'spectator' && !requesterUser.color)) {
        return;
    }

    // 切换为观战者
    if (targetRole === 'spectator') {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const [player] = room.players.splice(playerIndex, 1);
            const oldUsername = player.username;
            player.color = undefined;
            room.spectators.push(player);
            
            io.to(roomId).emit('userRoleChanged', { username: oldUsername, newRole: 'spectator' });
            io.to(roomId).emit('playersListUpdate', room.players);
            io.to(roomId).emit('spectatorsListUpdate', room.spectators);
        }
        return;
    }

    // 切换为玩家 (红/黑)
    const targetPlayer = room.players.find(p => p.color === targetRole);
    
    // Case 1: 目标位置为空
    if (!targetPlayer) {
        if (room.players.length >= 2) {
            return socket.emit('roleSwitchError', { reason: '玩家位置已满，无法加入' });
        }
        
        let user;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex > -1) { // 本身是另一个颜色的玩家
            user = room.players[playerIndex];
        } else { // 本身是观众
            const specIndex = room.spectators.findIndex(s => s.id === socket.id);
            if (specIndex === -1) return socket.emit('roleSwitchError', { reason: '找不到您的信息' });
            [user] = room.spectators.splice(specIndex, 1);
            room.players.push(user);
        }

        user.color = targetRole;
        
        io.to(roomId).emit('userRoleChanged', { username: user.username, newRole: 'player' });
        io.to(roomId).emit('playersListUpdate', room.players);
        io.to(roomId).emit('spectatorsListUpdate', room.spectators);
        
        if (room.players.length === 2 && room.status === 'waiting') {
            room.status = 'playing';
            DatabaseManager.updateRoomStatus(roomId, 'playing');
            io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
        }
        return;
    }

    // Case 2: 目标位置有人
    if (targetPlayer.id === socket.id) return; // 不能和自己换

    // 向目标玩家发送请求
    io.to(targetPlayer.id).emit('roleSwitchRequest', { fromUser: requesterUser, targetRole });
  });

  socket.on('roleSwitchResponse', ({ accepted, fromUser, targetRole }) => {
    const room = Object.values(rooms).find(r => r.players.some(p => p.id === socket.id));
    if (!room) return;

    const occupant = room.players.find(p => p.id === socket.id); // 同意/拒绝的人
    const requester = room.players.find(p => p.id === fromUser.id) || room.spectators.find(s => s.id === fromUser.id);
    
    if (!occupant || !requester) return;

    if (accepted) {
        // 执行交换: requester 成为玩家, occupant 成为观众
        const requesterIndexInPlayers = room.players.findIndex(p => p.id === requester.id);
        if (requesterIndexInPlayers > -1) {
            room.players.splice(requesterIndexInPlayers, 1);
        } else {
            const requesterIndexInSpecs = room.spectators.findIndex(s => s.id === requester.id);
            room.spectators.splice(requesterIndexInSpecs, 1);
        }
        
        const occupantIndex = room.players.findIndex(p => p.id === occupant.id);
        room.players.splice(occupantIndex, 1);
        
        // 交换身份
        requester.color = occupant.color;
        occupant.color = undefined;

        room.players.push(requester);
        room.spectators.push(occupant);

        io.to(room.id).emit('userRoleChanged', { username: occupant.username, newRole: 'spectator' });
        io.to(room.id).emit('userRoleChanged', { username: requester.username, newRole: 'player' });

        io.to(room.id).emit('playersListUpdate', room.players);
        io.to(room.id).emit('spectatorsListUpdate', room.spectators);

    } else {
        io.to(requester.id).emit('roleSwitchError', { reason: `${occupant.username} 拒绝了你的请求` });
    }
  });
  
  // 玩家移动棋子
  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== room.gameState.currentPlayer) {
      return socket.emit('moveRejected', { reason: '不是你的回合' });
    }
    
    // 增加对棋子所有权的判断
    const pieceToMove = room.gameState.board[from.row][from.col];
    if (!pieceToMove || pieceToMove.color !== player.color) {
      return socket.emit('moveRejected', { reason: '你不能移动对方的棋子' });
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
      if (playerIndex !== -1) {
        userLeft = room.players.splice(playerIndex, 1)[0];
        DatabaseManager.removePlayer(roomId, socket.id);
        if (room.status === 'playing') {
          room.status = 'finished';
          DatabaseManager.updateRoomStatus(roomId, 'finished');
          const winner = room.players[0]?.color; // 剩下的玩家获胜
          io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
          if(winner) io.to(roomId).emit('gameOver', { winner, reason: `${userLeft.username} 断线` });
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
        broadcastRooms();
        // 如果房间空了，从内存中移除
        if (room.players.length === 0 && room.spectators.length === 0) {
            delete rooms[roomId];
            broadcastRooms();
        }
      }
    }
  });
});

// **需求4：修复棋盘布局**
function initializeBoard() {
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 黑方 (top, row 0-4)
  board[0][0] = { color: 'black', type: 'chariot' };
  board[0][1] = { color: 'black', type: 'horse' };
  board[0][2] = { color: 'black', type: 'elephant' }; // 象
  board[0][3] = { color: 'black', type: 'advisor' };  // 士
  board[0][4] = { color: 'black', type: 'general' };   // 将
  board[0][5] = { color: 'black', type: 'advisor' };  // 士
  board[0][6] = { color: 'black', type: 'elephant' }; // 象
  board[0][7] = { color: 'black', type: 'horse' };
  board[0][8] = { color: 'black', type: 'chariot' };
  board[2][1] = { color: 'black', type: 'cannon' };
  board[2][7] = { color: 'black', type: 'cannon' };
  board[3][0] = { color: 'black', type: 'soldier' };
  board[3][2] = { color: 'black', type: 'soldier' };
  board[3][4] = { color: 'black', type: 'soldier' };
  board[3][6] = { color: 'black', type: 'soldier' };
  board[3][8] = { color: 'black', type: 'soldier' };
  
  // 红方 (bottom, row 5-9)
  board[9][0] = { color: 'red', type: 'chariot' };
  board[9][1] = { color: 'red', type: 'horse' };
  board[9][2] = { color: 'red', type: 'elephant' }; // 相
  board[9][3] = { color: 'red', type: 'advisor' };  // 仕
  board[9][4] = { color: 'red', type: 'general' };   // 帅
  board[9][5] = { color: 'red', type: 'advisor' };  // 仕
  board[9][6] = { color: 'red', type: 'elephant' }; // 相
  board[9][7] = { color: 'red', type: 'horse' };
  board[9][8] = { color: 'red', type: 'chariot' };
  board[7][1] = { color: 'red', type: 'cannon' };
  board[7][7] = { color: 'red', type: 'cannon' };
  board[6][0] = { color: 'red', type: 'soldier' };
  board[6][2] = { color: 'red', type: 'soldier' };
  board[6][4] = { color: 'red', type: 'soldier' };
  board[6][6] = { color: 'red', type: 'soldier' };
  board[6][8] = { color: 'red', type: 'soldier' };
  
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
  console.log(`服务器运行在端口 http://localhost:${PORT}`);
});