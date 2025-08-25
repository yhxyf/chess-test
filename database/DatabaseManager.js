const db = require('./init');

class DatabaseManager {
  // 添加用户 (注册)
  static addUser(username, hashedPassword) {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
      const info = stmt.run(username, hashedPassword);
      return { success: true, id: info.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, message: '用户名已存在' };
      }
      console.error('添加用户失败:', error);
      return { success: false, message: '数据库错误' };
    }
  }

  // 获取用户 (登录)
  static getUser(username) {
    try {
      return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  // 创建房间
  static createRoom(roomId, roomName) {
    try {
      db.prepare('INSERT INTO rooms (id, name) VALUES (?, ?)').run(roomId, roomName);
      return true;
    } catch (error) {
      console.error('创建房间失败:', error);
      return false;
    }
  }

  // 获取房间信息
  static getRoom(roomId) {
    try {
      return db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    } catch (error) {
      console.error('获取房间信息失败:', error);
      return null;
    }
  }

  // 更新房间状态
  static updateRoomStatus(roomId, status) {
    try {
      db.prepare('UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, roomId);
      return true;
    } catch (error) {
      console.error('更新房间状态失败:', error);
      return false;
    }
  }

  // 添加玩家
  static addPlayer(roomId, username, color, socketId) {
    try {
      // 使用 INSERT OR REPLACE 避免因重连导致重复插入
      db.prepare(`
        INSERT INTO players (room_id, username, color, socket_id) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(room_id, username) DO UPDATE SET
        color = excluded.color,
        socket_id = excluded.socket_id;
      `).run(roomId, username, color, socketId);
      return true;
    } catch (error) {
      console.error('添加或更新玩家失败:', error);
      return false;
    }
  }

  // 获取房间玩家
  static getPlayers(roomId) {
    try {
      return db.prepare('SELECT * FROM players WHERE room_id = ?').all(roomId);
    } catch (error) {
      console.error('获取玩家列表失败:', error);
      return [];
    }
  }

  // 按 socketId 移除玩家
  static removePlayer(roomId, socketId) {
    try {
      db.prepare('DELETE FROM players WHERE room_id = ? AND socket_id = ?').run(roomId, socketId);
      return true;
    } catch (error) {
      console.error('按socketId移除玩家失败:', error);
      return false;
    }
  }

  // **新增函数：按用户名移除玩家**
  static removePlayerByUsername(roomId, username) {
    try {
      db.prepare('DELETE FROM players WHERE room_id = ? AND username = ?').run(roomId, username);
      console.log(`从数据库移除玩家: ${username} @ ${roomId}`);
      return true;
    } catch (error) {
      console.error('按用户名移除玩家失败:', error);
      return false;
    }
  }


  // 添加观战者
  static addSpectator(roomId, username, socketId) {
    try {
      db.prepare('INSERT INTO spectators (room_id, username, socket_id) VALUES (?, ?, ?)').run(
        roomId, username, socketId
      );
      return true;
    } catch (error) {
      console.error('添加观战者失败:', error);
      return false;
    }
  }

  // 获取房间观战者
  static getSpectators(roomId) {
    try {
      return db.prepare('SELECT * FROM spectators WHERE room_id = ?').all(roomId);
    } catch (error) {
      console.error('获取观战者列表失败:', error);
      return [];
    }
  }

  // 移除观战者
  static removeSpectator(roomId, socketId) {
    try {
      db.prepare('DELETE FROM spectators WHERE room_id = ? AND socket_id = ?').run(roomId, socketId);
      return true;
    } catch (error) {
      console.error('移除观战者失败:', error);
      return false;
    }
  }

  // 保存游戏状态
  static saveGameState(roomId, board, currentPlayer, history) {
    try {
      db.prepare('INSERT OR REPLACE INTO game_states (room_id, board, current_player, history, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run(
        roomId, JSON.stringify(board), currentPlayer, history
      );
      return true;
    } catch (error) {
      console.error('保存游戏状态失败:', error);
      return false;
    }
  }

  // 获取游戏状态
  static getGameState(roomId) {
    try {
      const gameState = db.prepare('SELECT * FROM game_states WHERE room_id = ?').get(roomId);
      if (gameState) {
        gameState.board = JSON.parse(gameState.board);
      }
      return gameState;
    } catch (error) {
      console.error('获取游戏状态失败:', error);
      return null;
    }
  }

  // 保存聊天消息
  static saveChatMessage(roomId, username, message) {
    try {
      db.prepare('INSERT INTO chat_messages (room_id, username, message) VALUES (?, ?, ?)').run(
        roomId, username, message
      );
      return true;
    } catch (error) {
      console.error('保存聊天消息失败:', error);
      return false;
    }
  }

  // 获取聊天消息
  static getChatMessages(roomId, limit = 50) {
    try {
      return db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?').all(roomId, limit);
    } catch (error)
      {
      console.error('获取聊天消息失败:', error);
      return [];
    }
  }
}

module.exports = DatabaseManager;