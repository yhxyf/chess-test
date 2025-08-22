// game.js - 游戏房间页面的 JavaScript

// 连接到 Socket.IO 服务器
const socket = io();

// 获取 URL 中的房间 ID
const urlParams = new URLSearchParams(window.location.pathname.split('/')[2]);
const roomId = window.location.pathname.split('/')[2];

// 获取 DOM 元素
const roomInfo = document.getElementById('roomInfo');
const chessBoard = document.getElementById('chessBoard');
const playersList = document.getElementById('playersList');
const spectatorsList = document.getElementById('spectatorsList');
const spectatorCount = document.getElementById('spectatorCount');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

// 获取用户名（在实际应用中，这应该从登录系统获取）
const username = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);

// 添加切换角色按钮
let switchRoleBtn = null;

// 加入房间
socket.emit('joinRoom', { roomId, username });

// 监听房间信息
socket.on('roomInfo', ({ room, role }) => {
    // 更新房间信息显示
    updateRoomInfo(room, role);
    
    // 初始化棋盘
    initializeChessBoard(room.gameState.board);
    
    // 更新玩家和观战者列表
    updatePlayersList(room.players);
    updateSpectatorsList(room.spectators);
});

// 监听聊天历史消息
socket.on('chatHistory', (messages) => {
    // 清空现有消息
    chatMessages.innerHTML = '';
    
    // 按时间顺序显示历史消息（数据库中是按时间倒序的，所以要反转）
    messages.reverse().forEach(message => {
        addMessage(`${message.username}: ${message.message}`, 'user');
    });
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// 监听用户加入
socket.on('userJoined', ({ username, role }) => {
    addMessage(`${username} 加入了房间`, 'system');
});

// 监听用户离开
socket.on('userLeft', ({ socketId }) => {
    addMessage(`有用户离开了房间`, 'system');
});

// 监听玩家列表更新
socket.on('playersListUpdate', (players) => {
    updatePlayersList(players);
});

// 监听观战者列表更新
socket.on('spectatorsListUpdate', (spectators) => {
    updateSpectatorsList(spectators);
});

// 监听游戏状态更新
socket.on('gameStateUpdate', (gameState) => {
    updateChessBoard(gameState.board);
});

// 监听新消息
socket.on('newMessage', ({ username, message }) => {
    addMessage(`${username}: ${message}`, 'user');
});

// 监听移动被拒绝
socket.on('moveRejected', ({ reason }) => {
    alert(`移动被拒绝: ${reason}`);
});

// 监听角色切换被拒绝
socket.on('roleSwitchRejected', ({ reason }) => {
    alert(`角色切换被拒绝: ${reason}`);
});

// 监听角色已切换
socket.on('roleSwitched', ({ role, color }) => {
    alert(`角色已切换为: ${role === 'player' ? '玩家' : '观战者'}`);
    // 更新房间信息显示
    const roomInfoElement = document.getElementById('roomInfo');
    if (roomInfoElement) {
        // 重新获取房间信息并更新显示
        socket.emit('getRoomInfo', { roomId });
    }
});

// 监听房间状态更新
socket.on('roomStatusUpdate', ({ status }) => {
    // 更新房间状态显示
    const roomInfoElement = document.getElementById('roomInfo');
    if (roomInfoElement) {
        const statusElement = roomInfoElement.querySelector('p:nth-child(2)'); // 第二个p元素是状态
        if (statusElement) {
            const statusText = status === 'waiting' ? '等待中' : status === 'playing' ? '游戏中' : '已结束';
            statusElement.textContent = `状态: ${statusText}`;
        }
    }
});

// 监听游戏结束
socket.on('gameOver', ({ winner }) => {
    const winnerName = winner === 'red' ? '红方' : '黑方';
    alert(`游戏结束！${winnerName}获胜！`);
    
    // 更新房间状态显示
    const roomInfoElement = document.getElementById('roomInfo');
    if (roomInfoElement) {
        const statusElement = roomInfoElement.querySelector('p');
        if (statusElement) {
            statusElement.textContent = '状态: 已结束';
        }
    }
});

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('sendMessage', { roomId, message, username });
        messageInput.value = '';
    }
}

// 添加消息到聊天窗口
function addMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', type);
    
    // 添加时间戳
    const timestamp = new Date().toLocaleTimeString();
    const timestampElement = document.createElement('span');
    timestampElement.classList.add('timestamp');
    timestampElement.textContent = `[${timestamp}] `;
    
    // 添加消息内容
    const contentElement = document.createElement('span');
    contentElement.textContent = message;
    
    messageElement.appendChild(timestampElement);
    messageElement.appendChild(contentElement);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 更新房间信息
function updateRoomInfo(room, role) {
    roomInfo.innerHTML = `
        <h2>${room.name} (${room.id})</h2>
        <p>状态: ${room.status === 'waiting' ? '等待中' : room.status === 'playing' ? '游戏中' : '已结束'}</p>
        <p>您的角色: ${role === 'player' ? '玩家' : '观战者'}</p>
    `;
    
    // 如果房间状态是等待中，添加切换角色按钮
    if (room.status === 'waiting') {
        // 创建切换角色按钮
        if (!switchRoleBtn) {
            switchRoleBtn = document.createElement('button');
            switchRoleBtn.id = 'switchRoleBtn';
            switchRoleBtn.className = 'btn btn-primary';
            switchRoleBtn.textContent = role === 'player' ? '切换为观战者' : '切换为玩家';
            switchRoleBtn.addEventListener('click', switchRole);
            roomInfo.appendChild(switchRoleBtn);
        } else {
            // 更新按钮文本
            switchRoleBtn.textContent = role === 'player' ? '切换为观战者' : '切换为玩家';
        }
    } else {
        // 如果房间状态不是等待中，移除切换角色按钮
        if (switchRoleBtn) {
            switchRoleBtn.remove();
            switchRoleBtn = null;
        }
    }
}

// 切换角色
function switchRole() {
    socket.emit('switchRole', { roomId, username });
}

// 初始化棋盘
function initializeChessBoard(board) {
    chessBoard.innerHTML = '';
    
    // 创建棋盘网格
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.classList.add('board-cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 添加棋子（如果有）
            if (board[row][col]) {
                const piece = document.createElement('div');
                piece.classList.add('chess-piece', board[row][col].color);
                piece.textContent = getPieceSymbol(board[row][col]);
                cell.appendChild(piece);
            }
            
            chessBoard.appendChild(cell);
        }
    }
}

// 更新棋盘
function updateChessBoard(board) {
    chessBoard.innerHTML = '';
    
    // 创建棋盘网格
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.classList.add('board-cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 添加棋子（如果有）
            if (board[row][col]) {
                const piece = document.createElement('div');
                piece.classList.add('chess-piece', board[row][col].color);
                piece.textContent = getPieceSymbol(board[row][col]);
                cell.appendChild(piece);
            }
            
            chessBoard.appendChild(cell);
        }
    }
}

// 获取棋子符号
function getPieceSymbol(piece) {
    const symbols = {
        'general': piece.color === 'red' ? '帅' : '将',
        'advisor': piece.color === 'red' ? '仕' : '士',
        'elephant': piece.color === 'red' ? '相' : '象',
        'horse': piece.color === 'red' ? '马' : '马',
        'chariot': piece.color === 'red' ? '车' : '车',
        'cannon': piece.color === 'red' ? '炮' : '炮',
        'soldier': piece.color === 'red' ? '兵' : '卒'
    };
    return symbols[piece.type] || '';
}

// 更新玩家列表
function updatePlayersList(players) {
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.username} (${player.color === 'red' ? '红方' : '黑方'})`;
        playersList.appendChild(li);
    });
}

// 更新观战者列表
function updateSpectatorsList(spectators) {
    spectatorsList.innerHTML = '';
    spectatorCount.textContent = spectators.length;
    spectators.forEach(spectator => {
        const li = document.createElement('li');
        li.textContent = spectator.username;
        spectatorsList.appendChild(li);
    });
}

// 事件监听器
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    addMessage('欢迎来到象棋房间！', 'system');
});