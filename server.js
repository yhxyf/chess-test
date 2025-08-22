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

// 内存中的房间缓存
const rooms = {};

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// 新增：设置页路由
app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});


// 广播大厅的房间列表
function broadcastRooms() {
    const roomList = Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.filter(p => p.id).length, // 只计算在线玩家
        spectators: room.spectators.length,
        status: room.status
    }));
    io.to('lobby').emit('roomListUpdate', roomList);
}

// 初始化一个新棋盘
function initializeBoard() {
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 红方 (low-index rows 0-4)
  board[0][0] = { color: 'red', type: 'chariot' };
  board[0][1] = { color: 'red', type: 'horse' };
  board[0][2] = { color: 'red', type: 'elephant' };
  board[0][3] = { color: 'red', type: 'advisor' };
  board[0][4] = { color: 'red', type: 'general' };
  board[0][5] = { color: 'red', type: 'advisor' };
  board[0][6] = { color: 'red', type: 'elephant' };
  board[0][7] = { color: 'red', type: 'horse' };
  board[0][8] = { color: 'red', type: 'chariot' };
  board[2][1] = { color: 'red', type: 'cannon' };
  board[2][7] = { color: 'red', type: 'cannon' };
  board[3][0] = { color: 'red', type: 'soldier' };
  board[3][2] = { color: 'red', type: 'soldier' };
  board[3][4] = { color: 'red', type: 'soldier' };
  board[3][6] = { color: 'red', type: 'soldier' };
  board[3][8] = { color: 'red', type: 'soldier' };
  
  // 黑方 (high-index rows 5-9)
  board[9][0] = { color: 'black', type: 'chariot' };
  board[9][1] = { color: 'black', type: 'horse' };
  board[9][2] = { color: 'black', type: 'elephant' };
  board[9][3] = { color: 'black', type: 'advisor' };
  board[9][4] = { color: 'black', type: 'general' };
  board[9][5] = { color: 'black', type: 'advisor' };
  board[9][6] = { color: 'black', type: 'elephant' };
  board[9][7] = { color: 'black', type: 'horse' };
  board[9][8] = { color: 'black', type: 'chariot' };
  board[7][1] = { color: 'black', type: 'cannon' };
  board[7][7] = { color: 'black', type: 'cannon' };
  board[6][0] = { color: 'black', type: 'soldier' };
  board[6][2] = { color: 'black', type: 'soldier' };
  board[6][4] = { color: 'black', type: 'soldier' };
  board[6][6] = { color: 'black', type: 'soldier' };
  board[6][8] = { color: 'black', type: 'soldier' };
  
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

// 初始化游戏状态
function initializeGameState() {
    return {
        board: initializeBoard(),
        currentPlayer: 'red',
        capturedPieces: { red: [], black: [] },
        history: [], // 用于悔棋
        isCheck: false
    };
}


io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  socket.join('lobby');
  broadcastRooms();

  socket.on('getRoomList', () => {
    broadcastRooms();
  });

  // 核心：处理用户加入/重连房间的逻辑
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.leave('lobby');
    let room = rooms[roomId];

    // 1. 如果房间不在内存中，从数据库恢复
    if (!room) {
        const roomRecord = DatabaseManager.getRoom(roomId);
        if (!roomRecord) {
            DatabaseManager.createRoom(roomId, `房间 ${roomId}`);
            room = {
                id: roomId, name: `房间 ${roomId}`, players: [], spectators: [], status: 'waiting',
                gameState: initializeGameState()
            };
            DatabaseManager.saveGameState(roomId, room.gameState.board, 'red');
        } else {
            const dbPlayers = DatabaseManager.getPlayers(roomId).map(p => ({ id: null, username: p.username, color: p.color }));
            const dbSpectators = DatabaseManager.getSpectators(roomId);
            const dbGameState = DatabaseManager.getGameState(roomId);
            room = {
                id: roomRecord.id, name: roomRecord.name,
                players: dbPlayers, 
                spectators: dbSpectators.map(s => ({id: s.socket_id, username: s.username})),
                status: roomRecord.status,
                gameState: dbGameState ? { ...initializeGameState(), ...dbGameState } : initializeGameState()
            };
        }
        rooms[roomId] = room;
    }

    let finalUsername = username;
    let role = '';

    // 2. 检查是否为断线重连的玩家
    const returningPlayer = room.players.find(p => p.username === finalUsername && p.id === null);

    if (returningPlayer) {
        returningPlayer.id = socket.id;
        role = 'player';
        console.log(`玩家 ${finalUsername} 重新连接到房间 ${roomId}`);
    } else {
        // 3. 处理新用户或用户名冲突
        const allUsers = [...room.players.filter(p => p.id), ...room.spectators];
        if (allUsers.some(u => u.username === finalUsername)) {
            finalUsername = `${username}${Math.floor(Math.random() * 100)}`;
            socket.emit('usernameUpdated', { newUsername: finalUsername });
        }
        
        // 4. 分配角色：新玩家或观战者
        const onlinePlayers = room.players.filter(p => p.id);
        if (onlinePlayers.length < 2) {
            const existingColors = onlinePlayers.map(p => p.color);
            const color = !existingColors.includes('red') ? 'red' : 'black';
            
            // 清理可能存在的离线玩家占位
            const offlinePlayerIndex = room.players.findIndex(p => p.color === color && p.id === null);
            if (offlinePlayerIndex !== -1) {
                DatabaseManager.removePlayerByUsername(roomId, room.players[offlinePlayerIndex].username);
                room.players.splice(offlinePlayerIndex, 1);
            }

            const newPlayer = { id: socket.id, username: finalUsername, color };
            room.players.push(newPlayer);
            role = 'player';
            DatabaseManager.addPlayer(roomId, finalUsername, color, socket.id);
        } else {
            role = 'spectator';
            room.spectators.push({ id: socket.id, username: finalUsername });
            DatabaseManager.addSpectator(roomId, finalUsername, socket.id);
        }
    }

    socket.join(roomId);

    // 5. 关键修复：如果房间是'finished'状态，但现在有两个玩家在线，则重置游戏
    const onlinePlayersCount = room.players.filter(p => p.id).length;
    if (onlinePlayersCount === 2 && room.status !== 'playing') {
        console.log(`房间 ${roomId} 已满员，开始或重置游戏。`);
        room.status = 'playing';
        room.gameState = initializeGameState();
        DatabaseManager.updateRoomStatus(roomId, 'playing');
        DatabaseManager.saveGameState(roomId, room.gameState.board, 'red');
        io.to(roomId).emit('gameStateUpdate', room.gameState);
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' }); 
    }
    
    // 6. 更新客户端信息
    socket.emit('roomInfo', { room, role, username: finalUsername });
    socket.emit('chatHistory', DatabaseManager.getChatMessages(roomId, 50));
    socket.to(roomId).emit('userJoined', { username: finalUsername, role });
    
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    
    broadcastRooms();
    console.log(`用户 ${finalUsername} 以 ${role} 身份加入房间 ${roomId}`);
  });

  // 玩家移动棋子
  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') {
        return socket.emit('moveRejected', { reason: '游戏未在进行中' });
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== room.gameState.currentPlayer) {
      return socket.emit('moveRejected', { reason: '不是你的回合' });
    }
    
    const pieceToMove = room.gameState.board[from.row][from.col];
    if (!pieceToMove || pieceToMove.color !== player.color) {
      return socket.emit('moveRejected', { reason: '你不能移动该棋子' });
    }

    if (!isValidMove(from.row, from.col, to.row, to.col, player.color, room.gameState.board)) {
      return socket.emit('moveRejected', { reason: '非法移动' });
    }

    // **悔棋功能：保存移动前的状态**
    room.gameState.history.push(JSON.parse(JSON.stringify(room.gameState)));
    
    // **吃子记录**
    const capturedPiece = room.gameState.board[to.row][to.col];
    if (capturedPiece) {
        room.gameState.capturedPieces[capturedPiece.color].push(capturedPiece.type);
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
      const winnerColor = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
      const winner = room.players.find(p => p.color === winnerColor);
      room.status = 'finished';
      DatabaseManager.updateRoomStatus(roomId, 'finished');
      io.to(roomId).emit('gameOver', { winner: winner ? winner.username : winnerColor });
      io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
      broadcastRooms();
    }
  });

  // 悔棋请求
  socket.on('requestUndo', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'playing') return;
      
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      // 只有在不是自己回合时才能请求悔棋
      if (player.color === room.gameState.currentPlayer) {
          return socket.emit('systemMessage', { message: '请在对方回合时请求悔棋。' });
      }

      const opponent = room.players.find(p => p.id && p.id !== socket.id);
      if (opponent) {
          io.to(opponent.id).emit('undoRequest', { from: player.username });
      } else {
          socket.emit('systemMessage', { message: '对手已离线，无法悔棋。' });
      }
  });

  // 悔棋响应
  socket.on('undoResponse', ({ roomId, accepted }) => {
      const room = rooms[roomId];
      if (!room || !room.gameState.history || room.gameState.history.length === 0) return;

      const player = room.players.find(p => p.id === socket.id);
      const requester = room.players.find(p => p.id !== socket.id);

      if (accepted) {
          room.gameState = room.gameState.history.pop();
          DatabaseManager.saveGameState(roomId, room.gameState.board, room.gameState.currentPlayer);
          io.to(roomId).emit('gameStateUpdate', room.gameState);
          io.to(roomId).emit('systemMessage', { message: `${player.username} 同意了悔棋请求。` });
      } else {
          if (requester && requester.id) {
              io.to(requester.id).emit('systemMessage', { message: `对方拒绝了你的悔棋请求。` });
          }
      }
  });

  // 新增：请求重新开始
    socket.on('requestRestart', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const opponent = room.players.find(p => p.id && p.id !== socket.id);
        if (opponent) {
            io.to(opponent.id).emit('restartRequest', { from: player.username });
        } else {
            socket.emit('systemMessage', { message: '对手已离线，无法重新开始。' });
        }
    });

    // 新增：响应重新开始
    socket.on('restartResponse', ({ roomId, accepted }) => {
        const room = rooms[roomId];
        if (!room) return;

        if (accepted) {
            console.log(`房间 ${roomId} 同意重新开始`);
            room.status = 'playing';
            room.gameState = initializeGameState();
            DatabaseManager.updateRoomStatus(roomId, 'playing');
            DatabaseManager.saveGameState(roomId, room.gameState.board, 'red');
            io.to(roomId).emit('gameStateUpdate', room.gameState);
            io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
            io.to(roomId).emit('systemMessage', { message: '双方同意，游戏已重新开始！' });
            broadcastRooms();
        } else {
            const requester = room.players.find(p => p.id !== socket.id);
            if (requester && requester.id) {
                io.to(requester.id).emit('systemMessage', { message: '对方拒绝了重新开始的请求。' });
            }
        }
    });


  // 聊天消息
  socket.on('sendMessage', ({ roomId, message, username }) => {
    DatabaseManager.saveChatMessage(roomId, username, message);
    io.to(roomId).emit('newMessage', { username, message });
  });

  // 核心：处理用户断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    for (const roomId in rooms) {
        const room = rooms[roomId];
        let userLeft = null;
        
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            userLeft = room.players[playerIndex];
            userLeft.id = null; // 标记为离线
            console.log(`玩家 ${userLeft.username} 在房间 ${roomId} 中断开连接`);
            
            const onlinePlayers = room.players.filter(p => p.id);
            if(onlinePlayers.length < 2 && room.status === 'playing') {
                room.status = 'finished';
                DatabaseManager.updateRoomStatus(roomId, 'finished');
                const winner = onlinePlayers[0];
                io.to(roomId).emit('gameOver', { winner: winner ? winner.username : '', reason: `${userLeft.username} 断线` });
                io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
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
            
            const onlinePlayersCount = room.players.filter(p => p.id).length;
            if (onlinePlayersCount === 0 && room.spectators.length === 0) {
                console.log(`房间 ${roomId} 已空，从内存中移除。`);
                delete rooms[roomId];
            }
            broadcastRooms();
        }
    }
  });
  
  // 角色切换等其他逻辑保持不变...
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 http://localhost:${PORT}`);
});