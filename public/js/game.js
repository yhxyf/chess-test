// game.js - 游戏房间页面的 JavaScript

const socket = io();

const roomId = window.location.pathname.split('/')[2];
let myUsername = '';
let myRole = '';
let selectedPiece = null;

const roomInfoEl = document.getElementById('roomInfo');
const chessBoardEl = document.getElementById('chessBoard');
const playersListEl = document.getElementById('playersList');
const spectatorsListEl = document.getElementById('spectatorsList');
const spectatorCountEl = document.getElementById('spectatorCount');
const chatMessagesEl = document.getElementById('chatMessages');
const messageInputEl = document.getElementById('messageInput');
const sendMessageBtnEl = document.getElementById('sendMessageBtn');

// 获取用户名
const promptedUsername = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
myUsername = promptedUsername;

// 加入房间
socket.emit('joinRoom', { roomId, username: myUsername });


// --- SOCKET.IO 事件监听 ---

socket.on('usernameUpdated', ({ newUsername }) => {
    myUsername = newUsername;
    alert(`用户名已存在，您的用户名已更新为: ${myUsername}`);
});

socket.on('roomInfo', ({ room, role, username }) => {
    myUsername = username;
    myRole = role;
    updateRoomInfo(room, role);
    renderBoard(room.gameState.board);
    updatePlayersList(room.players);
    updateSpectatorsList(room.spectators);
});

socket.on('chatHistory', (messages) => {
    chatMessagesEl.innerHTML = '';
    messages.reverse().forEach(msg => addMessageToBox(msg.username, msg.message, 'user'));
});

socket.on('userJoined', ({ username, role }) => {
    addMessageToBox(username, `以 ${role === 'player' ? '玩家' : '观战者'} 身份加入了房间`, 'system');
});

socket.on('userLeft', ({ username }) => {
    addMessageToBox(username, '离开了房间', 'system');
});

socket.on('userRoleChanged', ({ username, newRole }) => {
    if (username === myUsername) {
        myRole = newRole;
        // 重新获取房间信息来更新UI
        socket.emit('getRoomInfo', { roomId });
    }
    addMessageToBox(username, `切换角色为 ${newRole === 'player' ? '玩家' : '观战者'}`, 'system');
});


socket.on('playersListUpdate', updatePlayersList);
socket.on('spectatorsListUpdate', updateSpectatorsList);

socket.on('gameStateUpdate', (gameState) => {
    renderBoard(gameState.board);
    document.querySelector('.side-panel').classList.toggle('red-turn', gameState.currentPlayer === 'red');
    document.querySelector('.side-panel').classList.toggle('black-turn', gameState.currentPlayer === 'black');
});

socket.on('newMessage', ({ username, message }) => {
    addMessageToBox(username, message, 'user');
});

socket.on('moveRejected', ({ reason }) => {
    alert(`移动被拒绝: ${reason}`);
    selectedPiece = null; 
    clearHighlights();
});

socket.on('roleSwitchRejected', ({ reason }) => alert(`角色切换失败: ${reason}`));

socket.on('gameOver', ({ winner, reason }) => {
    const winnerName = winner === 'red' ? '红方' : '黑方';
    let message = `游戏结束！${winnerName} 获胜！`;
    if (reason) {
        message += ` (${reason})`;
    }
    setTimeout(() => alert(message), 100); // 延迟确保棋盘渲染
});


// --- DOM 操作函数 ---

function updateRoomInfo(room, role) {
    roomInfoEl.innerHTML = `
        <h2>${room.name}</h2>
        <p>状态: <span class="status-text">${room.status}</span></p>
        <p>您的身份: ${role === 'player' ? '玩家' : '观战者'} (${myUsername})</p>
    `;
    // 只有等待时才显示切换按钮
    if (room.status === 'waiting') {
        const switchBtn = document.createElement('button');
        switchBtn.className = 'btn';
        switchBtn.textContent = '切换角色';
        switchBtn.onclick = () => socket.emit('switchRole', { roomId, username: myUsername });
        roomInfoEl.appendChild(switchBtn);
    }
}

function renderBoard(board) {
    chessBoardEl.innerHTML = '';
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            const pieceData = board[r][c];
            if (pieceData) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `chess-piece ${pieceData.color}`;
                pieceEl.textContent = getPieceSymbol(pieceData);
                pieceEl.dataset.row = r;
                pieceEl.dataset.col = c;
                cell.appendChild(pieceEl);
            }
            chessBoardEl.appendChild(cell);
        }
    }
    addBoardFeatures();
}


function addBoardFeatures() {
    // 添加九宫斜线
    const palaceTop = document.createElement('div');
    palaceTop.className = 'palace palace-top';
    chessBoardEl.appendChild(palaceTop);
    
    const palaceBottom = document.createElement('div');
    palaceBottom.className = 'palace palace-bottom';
    chessBoardEl.appendChild(palaceBottom);
}

function getPieceSymbol(piece) {
    if (!piece) return '';
    const symbols = {
        'general': piece.color === 'red' ? '帅' : '将',
        'advisor': piece.color === 'red' ? '仕' : '士',
        'elephant': piece.color === 'red' ? '相' : '象',
        'horse': piece.color === 'red' ? '馬' : '馬',
        'chariot': piece.color === 'red' ? '車' : '車',
        'cannon': piece.color === 'red' ? '炮' : '炮',
        'soldier': piece.color === 'red' ? '兵' : '卒'
    };
    return symbols[piece.type];
}


function updatePlayersList(players) {
    playersListEl.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        const colorText = p.color === 'red' ? ' (红方)' : ' (黑方)';
        li.textContent = p.username + colorText;
        if(p.username === myUsername) li.style.fontWeight = 'bold';
        playersListEl.appendChild(li);
    });
}

function updateSpectatorsList(spectators) {
    spectatorsListEl.innerHTML = '';
    spectatorCountEl.textContent = spectators.length;
    spectators.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s.username;
        if(s.username === myUsername) li.style.fontWeight = 'bold';
        spectatorsListEl.appendChild(li);
    });
}

function sendMessage() {
    const message = messageInputEl.value.trim();
    if (message) {
        socket.emit('sendMessage', { roomId, message, username: myUsername });
        messageInputEl.value = '';
    }
}

function addMessageToBox(username, message, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${type}`;
    const timestamp = new Date().toLocaleTimeString('it-IT');
    msgDiv.innerHTML = `<span class="timestamp">[${timestamp}]</span> <strong>${username}:</strong> <span>${message}</span>`;
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function clearHighlights() {
    document.querySelectorAll('.selected, .valid-move').forEach(el => {
        el.classList.remove('selected', 'valid-move');
    });
}

// --- 事件绑定 ---
sendMessageBtnEl.addEventListener('click', sendMessage);
messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

chessBoardEl.addEventListener('click', (e) => {
    if (myRole !== 'player') return;

    const target = e.target.closest('.chess-piece, .board-cell');
    if (!target) return;

    const row = parseInt(target.dataset.row);
    const col = parseInt(target.dataset.col);

    if (target.classList.contains('chess-piece')) {
        selectedPiece = { pieceEl: target, row, col };
        clearHighlights();
        target.classList.add('selected');
    } else if (selectedPiece) { // 点击棋盘空位
        socket.emit('playerMove', {
            roomId,
            from: { row: selectedPiece.row, col: selectedPiece.col },
            to: { row, col }
        });
        selectedPiece = null;
        clearHighlights();
    }
});

addMessageToBox('系统', '欢迎来到象棋房间！', 'system');