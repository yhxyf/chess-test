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
  
  // 红方
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
  
  // 黑方
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
        history: [], 
        moveHistory: [],
        isCheck: false
    };
}

function getChinaChessNotation(piece, from, to, board) {
    const pieceName = {
        'general': '将', 'advisor': '士', 'elephant': '象', 'horse': '马', 'chariot': '车', 'cannon': '炮', 'soldier': '兵'
    };
    const redPieceName = {
        'general': '帅', 'advisor': '仕', 'elephant': '相', 'horse': '马', 'chariot': '车', 'cannon': '炮', 'soldier': '兵'
    };
    
    const numToChinese = "一二三四五六七八九";
    const name = piece.color === 'red' ? redPieceName[piece.type] : pieceName[piece.type];
    
    let fromColStr, toColStr, action;
    
    const fromColForNotation = piece.color === 'red' ? 9 - from.col : from.col + 1;
    fromColStr = name + numToChinese[fromColForNotation-1];

    if (from.row === to.row) {
        action = '平';
        toColStr = numToChinese[(piece.color === 'red' ? 9 - to.col : to.col + 1) - 1];
    } else {
        action = (piece.color === 'red' ? from.row < to.row : from.row > to.row) ? '进' : '退';
        if (['horse', 'elephant', 'advisor'].includes(piece.type)) {
            toColStr = numToChinese[(piece.color === 'red' ? 9 - to.col : to.col + 1) - 1];
        } else {
            toColStr = numToChinese[Math.abs(from.row - to.row) - 1];
        }
    }
    
    if (['soldier', 'chariot', 'cannon', 'horse'].includes(piece.type)) {
        let sameColPieces = [];
        for(let r=0; r<10; r++) {
            const p = board[r][from.col];
            if (p && p.type === piece.type && p.color === piece.color) {
                sameColPieces.push(p);
            }
        }
        if (sameColPieces.length > 1) {
             const sortedPieces = piece.color === 'red' ? sameColPieces.sort((a,b) => a.row - b.row) : sameColPieces.sort((a,b) => b.row - a.row);
             const pieceIndex = sortedPieces.findIndex(p => p.row === from.row);
             const pos = ['前', '后', '三', '四', '五'];
             fromColStr = pos[pieceIndex] + name;
        }
    }

    return `${fromColStr}${action}${toColStr}`;
}

io.on('connection', (socket) => {
  socket.join('lobby');
  broadcastRooms();

  socket.on('getRoomList', () => {
    broadcastRooms();
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    socket.leave('lobby');
    let room = rooms[roomId];

    if (!room) {
        const url = new URL(socket.handshake.headers.referer);
        const roomNameFromQuery = url.searchParams.get('name');
        const roomName = roomNameFromQuery || `房间 ${roomId}`;
        const roomRecord = DatabaseManager.getRoom(roomId);
        if (!roomRecord) {
            DatabaseManager.createRoom(roomId, roomName);
            room = { id: roomId, name: roomName, players: [], spectators: [], status: 'waiting', gameState: initializeGameState() };
            DatabaseManager.saveGameState(roomId, room.gameState.board, 'red');
        } else {
            const dbPlayers = DatabaseManager.getPlayers(roomId).map(p => ({ id: null, username: p.username, color: p.color }));
            const dbGameState = DatabaseManager.getGameState(roomId);
            room = {
                id: roomRecord.id, name: roomRecord.name,
                players: dbPlayers, spectators: [], status: roomRecord.status,
                gameState: dbGameState ? { ...initializeGameState(), ...dbGameState, moveHistory: dbGameState.history ? JSON.parse(dbGameState.history) : [] } : initializeGameState()
            };
        }
        rooms[roomId] = room;
    }

    let finalUsername = username;
    let role = 'spectator'; 

    const returningPlayer = room.players.find(p => p.username === finalUsername && p.id === null);

    if (returningPlayer) {
        returningPlayer.id = socket.id;
        role = 'player';
    } else {
        const allUsers = [...room.players.filter(p => p.id), ...room.spectators];
        if (allUsers.some(u => u.username === finalUsername)) {
            finalUsername = `${username}${Math.floor(Math.random() * 1000)}`;
            socket.emit('usernameUpdated', { newUsername: finalUsername });
        }
        room.spectators.push({ id: socket.id, username: finalUsername });
        DatabaseManager.addSpectator(roomId, finalUsername, socket.id);
    }
    
    socket.join(roomId);
    
    const onlinePlayersCount = room.players.filter(p => p.id).length;
    if (onlinePlayersCount === 2 && room.status !== 'playing') {
        room.status = 'playing';
        room.gameState = initializeGameState();
        io.to(roomId).emit('systemMessage', { message: '双方玩家已到齐，游戏开始！' });
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' }); 
        io.to(roomId).emit('gameStateUpdate', room.gameState);
    }

    socket.emit('roomInfo', { room, role, username: finalUsername });
    socket.emit('chatHistory', DatabaseManager.getChatMessages(roomId, 50));
    socket.to(roomId).emit('userJoined', { username: finalUsername, role: role });
    
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    broadcastRooms();
  });
  
  // *** FIXED LOGIC FOR SWITCHING ROLES ***
  socket.on('switchRole', ({ roomId, username, desiredRole }) => {
      const room = rooms[roomId];
      if (!room) return;
      
      const onlinePlayers = room.players.filter(p => p.id);
      const existingColors = onlinePlayers.map(p => p.color);
      
      if ((desiredRole === 'red' || desiredRole === 'black') && onlinePlayers.length < 2) {
          if (existingColors.includes(desiredRole)) {
              return socket.emit('systemMessage', { message: `该位置 (${desiredRole}) 已被占据。`});
          }
          
          const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
          if (spectatorIndex !== -1) room.spectators.splice(spectatorIndex, 1);
          
          const playerRecord = { id: socket.id, username: username, color: desiredRole };
          
          const existingPlayerSlot = room.players.find(p => p.color === desiredRole && p.id === null);
          if (existingPlayerSlot) {
              existingPlayerSlot.id = socket.id;
              existingPlayerSlot.username = username;
          } else {
              room.players.push(playerRecord);
          }
          
          socket.emit('roleChanged', { newRole: 'player', color: desiredRole });
          
          io.to(roomId).emit('playersListUpdate', room.players);
          io.to(roomId).emit('spectatorsListUpdate', room.spectators);
          io.to(roomId).emit('systemMessage', { message: `${username} 成为了 ${desiredRole === 'red' ? '红方' : '黑方'} 玩家。` });
          
          if (room.players.filter(p => p.id).length === 2) {
              room.status = 'playing';
              room.gameState = initializeGameState();
              DatabaseManager.updateRoomStatus(roomId, 'playing');
              io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
              io.to(roomId).emit('gameStateUpdate', room.gameState);
              io.to(roomId).emit('systemMessage', { message: '双方玩家已到齐，游戏开始！' });
              broadcastRooms();
          }
      }
  });


  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== room.gameState.currentPlayer) return;
    const pieceToMove = room.gameState.board[from.row][from.col];
    if (!pieceToMove) return;

    if (!isValidMove(from.row, from.col, to.row, to.col, player.color, room.gameState.board)) return;

    room.gameState.history.push(JSON.parse(JSON.stringify(room.gameState)));
    
    const moveNotation = getChinaChessNotation(pieceToMove, from, to, room.gameState.board);
    room.gameState.moveHistory.push(moveNotation);
    
    const capturedPiece = room.gameState.board[to.row][to.col];
    if (capturedPiece) {
        room.gameState.capturedPieces[capturedPiece.color].push(capturedPiece.type);
        if (capturedPiece.type === 'general') {
            room.status = 'finished';
            DatabaseManager.updateRoomStatus(roomId, 'finished');
            io.to(roomId).emit('gameOver', { winner: player.username, reason: '对方主帅被吃' });
            io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
            broadcastRooms();
            return;
        }
    }
    
    room.gameState.board[to.row][to.col] = { ...pieceToMove, row: to.row, col: to.col };
    room.gameState.board[from.row][from.col] = null;
    
    room.gameState.currentPlayer = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
    room.gameState.isCheck = isCheck(room.gameState.currentPlayer, room.gameState.board);
    
    DatabaseManager.saveGameState(roomId, room.gameState.board, room.gameState.currentPlayer, JSON.stringify(room.gameState.moveHistory));
    io.to(roomId).emit('gameStateUpdate', room.gameState);
    
    if (isCheckmate(room.gameState.currentPlayer, room.gameState.board)) {
      const winnerColor = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
      const winner = room.players.find(p => p.color === winnerColor);
      room.status = 'finished';
      DatabaseManager.updateRoomStatus(roomId, 'finished');
      io.to(roomId).emit('gameOver', { winner: winner ? winner.username : winnerColor, reason: '绝杀' });
      io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
      broadcastRooms();
    }
  });

  socket.on('requestUndo', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.status !== 'playing') return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.color === room.gameState.currentPlayer) return;
      const opponent = room.players.find(p => p.id && p.id !== socket.id);
      if (opponent) io.to(opponent.id).emit('undoRequest', { from: player.username });
  });

  socket.on('undoResponse', ({ roomId, accepted }) => {
      const room = rooms[roomId];
      if (!room || !room.gameState.history || room.gameState.history.length === 0) return;
      const player = room.players.find(p => p.id === socket.id);
      if (accepted) {
          room.gameState = room.gameState.history.pop();
          DatabaseManager.saveGameState(roomId, room.gameState.board, room.gameState.currentPlayer, JSON.stringify(room.gameState.moveHistory));
          io.to(roomId).emit('gameStateUpdate', room.gameState);
      }
  });

  socket.on('requestRestart', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      const opponent = room.players.find(p => p.id && p.id !== socket.id);
      if (opponent) io.to(opponent.id).emit('restartRequest', { from: player.username });
  });

  socket.on('restartResponse', ({ roomId, accepted }) => {
      const room = rooms[roomId];
      if (!room) return;
      if (accepted) {
          room.status = 'playing';
          room.gameState = initializeGameState();
          DatabaseManager.updateRoomStatus(roomId, 'playing');
          io.to(roomId).emit('gameStateUpdate', room.gameState);
          io.to(roomId).emit('systemMessage', { message: '游戏已重新开始！' });
      }
  });

  socket.on('sendMessage', ({ roomId, message, username }) => {
    DatabaseManager.saveChatMessage(roomId, username, message);
    io.to(roomId).emit('newMessage', { username, message });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        let userLeft = null;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            userLeft = { ...room.players[playerIndex] };
            room.players[playerIndex].id = null;
            io.to(roomId).emit('systemMessage', { message: `玩家 ${userLeft.username} 已断开连接。` });
        } else {
            const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);
            if (spectatorIndex !== -1) {
                userLeft = room.spectators.splice(spectatorIndex, 1)[0];
            }
        }
        if (userLeft) {
            io.to(roomId).emit('userLeft', { username: userLeft.username });
            io.to(roomId).emit('playersListUpdate', room.players);
            io.to(roomId).emit('spectatorsListUpdate', room.spectators);
            if (room.players.every(p => p.id === null) && room.spectators.length === 0) {
                delete rooms[roomId];
            }
            broadcastRooms();
        }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 http://localhost:${PORT}`);
});
