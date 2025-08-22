const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const DatabaseManager = require('./database/DatabaseManager');
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
    // 从数据库获取房间信息
    let room = rooms[roomId];
    
    // 如果房间不存在，从数据库加载或创建它
    if (!room) {
      // 检查数据库中是否存在房间
      const roomRecord = DatabaseManager.getRoom(roomId);
      
      if (!roomRecord) {
        // 创建新房间
        DatabaseManager.createRoom(roomId, `房间 ${roomId}`);
        room = {
          id: roomId,
          name: `房间 ${roomId}`,
          players: [],
          spectators: [],
          status: 'waiting'
        };
      } else {
        // 从数据库加载房间
        room = {
          id: roomRecord.id,
          name: roomRecord.name,
          status: roomRecord.status,
          players: [],
          spectators: []
        };
        
        // 加载玩家信息
        const players = DatabaseManager.getPlayers(roomId);
        room.players = players.map(player => ({
          id: player.socket_id,
          username: player.username,
          color: player.color
        }));
        
        // 加载观战者信息
        const spectators = DatabaseManager.getSpectators(roomId);
        room.spectators = spectators.map(spectator => ({
          id: spectator.socket_id,
          username: spectator.username
        }));
      }
      
      // 初始化游戏状态
      const gameStateRecord = DatabaseManager.getGameState(roomId);
      if (!gameStateRecord) {
        DatabaseManager.saveGameState(roomId, initializeBoard(), 'red');
      }
      
      rooms[roomId] = room;
    }
    
    // 确定用户角色（玩家或观战者）
    let role = 'spectator';
    if (room.players.length < 2 && room.status === 'waiting') {
      // 添加为玩家
      const color = room.players.length === 0 ? 'red' : 'black';
      room.players.push({ id: socket.id, username, color });
      role = 'player';
      
      // 保存玩家信息到数据库
      DatabaseManager.addPlayer(roomId, username, color, socket.id);
      
      // 如果两个玩家都加入了，开始游戏
      if (room.players.length === 2) {
        room.status = 'playing';
        // 更新房间状态到数据库
        DatabaseManager.updateRoomStatus(roomId, 'playing');
        // 通知房间内所有用户房间状态已改变
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    } else {
      // 添加为观战者
      room.spectators.push({ id: socket.id, username });
      role = 'spectator';
      
      // 保存观战者信息到数据库
      DatabaseManager.addSpectator(roomId, username, socket.id);
    }

    // 将用户加入房间
    socket.join(roomId);
    
    // 获取游戏状态
    const gameState = DatabaseManager.getGameState(roomId);
    if (gameState) {
      room.gameState = gameState;
    } else {
      // 初始化游戏状态
      const initialBoard = initializeBoard();
      DatabaseManager.saveGameState(roomId, initialBoard, 'red');
      room.gameState = {
        board: initialBoard,
        currentPlayer: 'red',
        isCheck: false,
        history: []
      };
    }
    
    // 发送房间信息给用户
    socket.emit('roomInfo', { room, role });
    
    // 发送历史聊天消息给用户
    const chatHistory = DatabaseManager.getChatMessages(roomId, 50);
    socket.emit('chatHistory', chatHistory);
    
    // 通知房间内其他用户有新用户加入
    socket.to(roomId).emit('userJoined', { username, role });
    
    // 向房间内所有用户广播更新后的玩家和观战者列表
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    
    console.log(`用户 ${username} 以 ${role} 身份加入房间 ${roomId}`);
  });

  // 玩家移动棋子
  socket.on('playerMove', ({ roomId, from, to }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // 验证是否是当前玩家的回合
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== room.gameState.currentPlayer) {
      socket.emit('moveRejected', { reason: '不是你的回合' });
      return;
    }
    
    // 验证移动是否合法
    const fromRow = from.row;
    const fromCol = from.col;
    const toRow = to.row;
    const toCol = to.col;
    
    if (!isValidMove(fromRow, fromCol, toRow, toCol, player.color, room.gameState.board)) {
      socket.emit('moveRejected', { reason: '非法移动' });
      return;
    }
    
    // 执行移动
    const piece = room.gameState.board[fromRow][fromCol];
    room.gameState.board[toRow][toCol] = piece;
    room.gameState.board[fromRow][fromCol] = null;
    
    // 更新棋子位置
    if (piece) {
      piece.row = toRow;
      piece.col = toCol;
    }
    
    // 切换当前玩家
    room.gameState.currentPlayer = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
    
    // 检查是否将军
    room.gameState.isCheck = isCheck(room.gameState.currentPlayer, room.gameState.board);
    
    // 检查是否将死
    const isCheckmated = isCheckmate(room.gameState.currentPlayer, room.gameState.board);
    
    // 保存游戏状态到数据库
    DatabaseManager.saveGameState(roomId, room.gameState.board, room.gameState.currentPlayer);
    
    // 广播游戏状态更新
    io.to(roomId).emit('gameStateUpdate', room.gameState);
    
    // 如果将死，宣布游戏结束
    if (isCheckmated) {
      const winner = room.gameState.currentPlayer === 'red' ? 'black' : 'red';
      io.to(roomId).emit('gameOver', { winner });
      
      // 更新房间状态为结束
      room.status = 'finished';
      DatabaseManager.updateRoomStatus(roomId, 'finished');
      // 通知房间内所有用户房间状态已改变
      io.to(roomId).emit('roomStatusUpdate', { status: 'finished' });
    }
  });

  // 用户获取房间信息
  socket.on('getRoomInfo', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // 查找用户角色
    let role = 'spectator';
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      role = 'player';
    } else {
      const spectator = room.spectators.find(s => s.id === socket.id);
      if (spectator) {
        role = 'spectator';
      }
    }
    
    // 发送房间信息给用户
    socket.emit('roomInfo', { room, role });
  });
  
  // 用户发送消息
  socket.on('sendMessage', ({ roomId, message, username }) => {
    // 保存消息到数据库
    DatabaseManager.saveChatMessage(roomId, username, message);
    
    // 广播消息给房间内所有用户
    io.to(roomId).emit('newMessage', { username, message });
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    // 从所有房间中移除用户
    for (const roomId in rooms) {
      const room = rooms[roomId];
      // 从玩家列表中移除
      const playerIndex = room.players.findIndex(player => player.id === socket.id);
      if (playerIndex !== -1) {
        // 从数据库中删除玩家
        DatabaseManager.removePlayer(roomId, socket.id);
        room.players.splice(playerIndex, 1);
      }
      
      // 从观战者列表中移除
      const spectatorIndex = room.spectators.findIndex(spectator => spectator.id === socket.id);
      if (spectatorIndex !== -1) {
        // 从数据库中删除观战者
        DatabaseManager.removeSpectator(roomId, socket.id);
        room.spectators.splice(spectatorIndex, 1);
      }
      
      // 通知房间内其他用户有用户离开
      socket.to(roomId).emit('userLeft', { socketId: socket.id });
      
      // 向房间内所有用户广播更新后的玩家和观战者列表
      io.to(roomId).emit('playersListUpdate', room.players);
      io.to(roomId).emit('spectatorsListUpdate', room.spectators);
    }
  });
  
  // 用户切换角色
  socket.on('switchRole', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // 查找用户当前角色
    const playerIndex = room.players.findIndex(player => player.id === socket.id);
    const spectatorIndex = room.spectators.findIndex(spectator => spectator.id === socket.id);
    
    // 如果用户是玩家，切换为观战者
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      
      // 如果房间状态不是等待中，不能切换角色
      if (room.status !== 'waiting') {
        socket.emit('roleSwitchRejected', { reason: '游戏已经开始，不能切换角色' });
        return;
      }
      
      // 从玩家列表中移除
      DatabaseManager.removePlayer(roomId, socket.id);
      room.players.splice(playerIndex, 1);
      
      // 添加到观战者列表
      room.spectators.push({ id: socket.id, username });
      DatabaseManager.addSpectator(roomId, username, socket.id);
      
      // 通知用户角色已切换
      socket.emit('roleSwitched', { role: 'spectator' });
    } 
    // 如果用户是观战者，切换为玩家
    else if (spectatorIndex !== -1) {
      const spectator = room.spectators[spectatorIndex];
      
      // 如果房间状态不是等待中，不能切换角色
      if (room.status !== 'waiting') {
        socket.emit('roleSwitchRejected', { reason: '游戏已经开始，不能切换角色' });
        return;
      }
      
      // 如果玩家数量已满，不能切换为玩家
      if (room.players.length >= 2) {
        socket.emit('roleSwitchRejected', { reason: '房间玩家已满，不能切换为玩家' });
        return;
      }
      
      // 从观战者列表中移除
      DatabaseManager.removeSpectator(roomId, socket.id);
      room.spectators.splice(spectatorIndex, 1);
      
      // 添加到玩家列表
      const color = room.players.length === 0 ? 'red' : 'black';
      room.players.push({ id: socket.id, username, color });
      DatabaseManager.addPlayer(roomId, username, color, socket.id);
      
      // 通知用户角色已切换
      socket.emit('roleSwitched', { role: 'player', color });
      
      // 如果两个玩家都加入了，开始游戏
      if (room.players.length === 2) {
        room.status = 'playing';
        // 更新房间状态到数据库
        DatabaseManager.updateRoomStatus(roomId, 'playing');
        // 通知房间内所有用户房间状态已改变
        io.to(roomId).emit('roomStatusUpdate', { status: 'playing' });
      }
    }
    
    // 向房间内所有用户广播更新后的玩家和观战者列表
    io.to(roomId).emit('playersListUpdate', room.players);
    io.to(roomId).emit('spectatorsListUpdate', room.spectators);
  });
});

// 初始化棋盘函数
function initializeBoard() {
  // 创建一个空的10x9棋盘 (0-9行, 0-8列)
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 设置红方棋子 (棋盘下方，第0行和第2行、第3行)
  // 第0行：车 马 相 仕 帅 仕 相 马 车
  board[0][0] = { color: 'red', type: 'chariot', row: 0, col: 0 };   // 车
  board[0][1] = { color: 'red', type: 'horse', row: 0, col: 1 };     // 马
  board[0][2] = { color: 'red', type: 'elephant', row: 0, col: 2 };  // 相
  board[0][3] = { color: 'red', type: 'advisor', row: 0, col: 3 };   // 仕
  board[0][4] = { color: 'red', type: 'general', row: 0, col: 4 };   // 帅
  board[0][5] = { color: 'red', type: 'advisor', row: 0, col: 5 };   // 仕
  board[0][6] = { color: 'red', type: 'elephant', row: 0, col: 6 };  // 相
  board[0][7] = { color: 'red', type: 'horse', row: 0, col: 7 };     // 马
  board[0][8] = { color: 'red', type: 'chariot', row: 0, col: 8 };   // 车
  
  // 第2行：炮 炮
  board[2][1] = { color: 'red', type: 'cannon', row: 2, col: 1 };    // 炮
  board[2][7] = { color: 'red', type: 'cannon', row: 2, col: 7 };    // 炮
  
  // 第3行：兵 兵 兵 兵 兵
  board[3][0] = { color: 'red', type: 'soldier', row: 3, col: 0 };   // 兵
  board[3][2] = { color: 'red', type: 'soldier', row: 3, col: 2 };   // 兵
  board[3][4] = { color: 'red', type: 'soldier', row: 3, col: 4 };   // 兵
  board[3][6] = { color: 'red', type: 'soldier', row: 3, col: 6 };   // 兵
  board[3][8] = { color: 'red', type: 'soldier', row: 3, col: 8 };   // 兵
  
  // 设置黑方棋子 (棋盘上方，第9行和第7行、第6行)
  // 第9行：车 马 象 士 将 士 象 马 车
  board[9][0] = { color: 'black', type: 'chariot', row: 9, col: 0 };   // 车
  board[9][1] = { color: 'black', type: 'horse', row: 9, col: 1 };     // 马
  board[9][2] = { color: 'black', type: 'elephant', row: 9, col: 2 };  // 象
  board[9][3] = { color: 'black', type: 'advisor', row: 9, col: 3 };   // 士
  board[9][4] = { color: 'black', type: 'general', row: 9, col: 4 };   // 将
  board[9][5] = { color: 'black', type: 'advisor', row: 9, col: 5 };   // 士
  board[9][6] = { color: 'black', type: 'elephant', row: 9, col: 6 };  // 象
  board[9][7] = { color: 'black', type: 'horse', row: 9, col: 7 };     // 马
  board[9][8] = { color: 'black', type: 'chariot', row: 9, col: 8 };   // 车
  
  // 第7行：炮 炮
  board[7][1] = { color: 'black', type: 'cannon', row: 7, col: 1 };    // 炮
  board[7][7] = { color: 'black', type: 'cannon', row: 7, col: 7 };    // 炮
  
  // 第6行：卒 卒 卒 卒 卒
  board[6][0] = { color: 'black', type: 'soldier', row: 6, col: 0 };   // 卒
  board[6][2] = { color: 'black', type: 'soldier', row: 6, col: 2 };   // 卒
  board[6][4] = { color: 'black', type: 'soldier', row: 6, col: 4 };   // 卒
  board[6][6] = { color: 'black', type: 'soldier', row: 6, col: 6 };   // 卒
  board[6][8] = { color: 'black', type: 'soldier', row: 6, col: 8 };   // 卒
  
  return board;
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});