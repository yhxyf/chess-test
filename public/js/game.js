// game.js - 游戏房间页面的 JavaScript

const socket = io();

const roomId = window.location.pathname.split('/')[2];
let myUsername = '';
let myRole = '';
let myColor = '';
let currentRoomState = {};

const roomInfoEl = document.getElementById('roomInfo');
const chessBoardEl = document.getElementById('chessBoard');
const playersListEl = document.getElementById('playersList');
const spectatorsListEl = document.getElementById('spectatorsList');
const spectatorCountEl = document.getElementById('spectatorCount');
const chatMessagesEl = document.getElementById('chatMessages');
const messageInputEl = document.getElementById('messageInput');
const sendMessageBtnEl = document.getElementById('sendMessageBtn');

// 模态框元素
const roleSwitchModal = document.getElementById('roleSwitchModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalActions = document.getElementById('modalActions');
const switchToRedBtn = document.getElementById('switchToRedBtn');
const switchToBlackBtn = document.getElementById('switchToBlackBtn');
const switchToSpectatorBtn = document.getElementById('switchToSpectatorBtn');

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
    currentRoomState = room; // 保存房间状态
    const me = room.players.find(p => p.username === myUsername);
    myColor = me ? me.color : '';

    updateRoomInfo(room, role);
    renderBoard(room.gameState.board, room.gameState.currentPlayer);
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
        // 更新自身颜色
        const meAsPlayer = currentRoomState.players.find(p => p.username === myUsername);
        myColor = (newRole === 'player' && meAsPlayer) ? meAsPlayer.color : '';
    }
    addMessageToBox(username, `切换角色为 ${newRole === 'player' ? '玩家' : '观战者'}`, 'system');
});


socket.on('playersListUpdate', (players) => {
    currentRoomState.players = players; // 更新本地房间状态
    updatePlayersList(players);
});
socket.on('spectatorsListUpdate', (spectators) => {
    currentRoomState.spectators = spectators; // 更新本地房间状态
    updateSpectatorsList(spectators);
});

socket.on('gameStateUpdate', (gameState) => {
    currentRoomState.gameState = gameState;
    renderBoard(gameState.board, gameState.currentPlayer);
});

socket.on('newMessage', ({ username, message }) => {
    addMessageToBox(username, message, 'user');
});

socket.on('moveRejected', ({ reason }) => {
    alert(`移动被拒绝: ${reason}`);
    selectedPiece = null; 
    clearHighlights();
});

socket.on('roleSwitchError', ({ reason }) => alert(`角色切换失败: ${reason}`));

socket.on('roleSwitchRequest', ({ fromUser, targetRole }) => {
    const accepted = confirm(`${fromUser.username} 想成为 ${targetRole === 'red' ? '红方' : '黑方'}，您是否同意与他交换角色（您将成为观战者）？`);
    socket.emit('roleSwitchResponse', { accepted, fromUser, targetRole });
});


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
        <p>状态: <span id="roomStatusText" class="status-text">${room.status}</span></p>
        <p>您的身份: ${role === 'player' ? '玩家' : '观战者'} (${myUsername})</p>
    `;
    const switchBtn = document.createElement('button');
    switchBtn.id = 'openRoleSwitchModalBtn';
    switchBtn.className = 'btn';
    switchBtn.textContent = '切换角色';
    roomInfoEl.appendChild(switchBtn);

    switchBtn.addEventListener('click', openRoleSwitchModal);
}
socket.on('roomStatusUpdate', ({ status }) => {
    const statusEl = document.getElementById('roomStatusText');
    if(statusEl) statusEl.textContent = status;
});

function renderBoard(board, currentPlayer) {
    chessBoardEl.innerHTML = ''; // 清空棋盘
    const isMyTurn = myColor === currentPlayer;

    // 创建 10x9 的网格单元
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            // 在单元格上放置棋子
            const pieceData = board[r][c];
            if (pieceData) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `chess-piece ${pieceData.color}`;
                if (pieceData.color === myColor && isMyTurn) {
                    pieceEl.classList.add('playable');
                }
                pieceEl.textContent = getPieceSymbol(pieceData);
                pieceEl.dataset.row = r;
                pieceEl.dataset.col = c;
                cell.appendChild(pieceEl);
            }
            chessBoardEl.appendChild(cell);
        }
    }
    
    // 添加九宫格和楚河汉界文字
    addBoardFeatures();
    
    // 更新回合提示
    const sidePanel = document.querySelector('.side-panel');
    sidePanel.classList.toggle('red-turn', currentPlayer === 'red');
    sidePanel.classList.toggle('black-turn', currentPlayer === 'black');
}

function addBoardFeatures() {
    // 九宫
    const palaceTop = document.createElement('div');
    palaceTop.className = 'palace palace-top';
    chessBoardEl.appendChild(palaceTop);
    
    const palaceBottom = document.createElement('div');
    palaceBottom.className = 'palace palace-bottom';
    chessBoardEl.appendChild(palaceBottom);
    
    // 楚河汉界文字
    const chuHe = document.createElement('div');
    chuHe.className = 'river-text chu-he';
    chuHe.textContent = '楚 河';
    chessBoardEl.appendChild(chuHe);

    const hanJie = document.createElement('div');
    hanJie.className = 'river-text han-jie';
    hanJie.textContent = '漢 界';
    chessBoardEl.appendChild(hanJie);
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
    const blackPlayer = players.find(p => p.color === 'black');
    const redPlayer = players.find(p => p.color === 'red');

    const blackLi = document.createElement('li');
    blackLi.innerHTML = `黑方: ${blackPlayer ? `${blackPlayer.username} ${blackPlayer.id ? '' : '(离线)'}` : '(空位)'}`;
    if(blackPlayer && blackPlayer.username === myUsername) blackLi.style.fontWeight = 'bold';
    playersListEl.appendChild(blackLi);

    const redLi = document.createElement('li');
    redLi.innerHTML = `红方: ${redPlayer ? `${redPlayer.username} ${redPlayer.id ? '' : '(离线)'}` : '(空位)'}`;
    if(redPlayer && redPlayer.username === myUsername) redLi.style.fontWeight = 'bold';
    playersListEl.appendChild(redLi);
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

// --- 角色切换模态框逻辑 ---
function openRoleSwitchModal() {
    const onlinePlayers = currentRoomState.players.filter(p => p.id);
    const isRedOccupied = onlinePlayers.some(p => p.color === 'red');
    const isBlackOccupied = onlinePlayers.some(p => p.color === 'black');
    
    switchToRedBtn.disabled = myColor === 'red' || isRedOccupied;
    switchToBlackBtn.disabled = myColor === 'black' || isBlackOccupied;
    switchToSpectatorBtn.disabled = myRole === 'spectator';
    
    roleSwitchModal.classList.add('visible');
}

// --- 事件绑定 ---
sendMessageBtnEl.addEventListener('click', sendMessage);
messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

let selectedPiece = null;
chessBoardEl.addEventListener('click', (e) => {
    if (myRole !== 'player') return;

    const target = e.target.closest('.board-cell');
    if (!target) return;

    const row = parseInt(target.dataset.row);
    const col = parseInt(target.dataset.col);

    const pieceEl = target.querySelector('.chess-piece');

    if (pieceEl) {
        // 点击的是有棋子的位置
        const pieceColor = pieceEl.classList.contains('red') ? 'red' : 'black';
        if (pieceColor === myColor) {
            // 是自己的棋子，选中它
            if (selectedPiece && selectedPiece.pieceEl === pieceEl) {
                // 重复点击，取消选中
                selectedPiece = null;
                clearHighlights();
            } else {
                selectedPiece = { pieceEl, row, col };
                clearHighlights();
                pieceEl.classList.add('selected');
            }
        } else if (selectedPiece) {
            // 是对方的棋子，且已选中己方棋子，执行移动（吃子）
            socket.emit('playerMove', {
                roomId,
                from: { row: selectedPiece.row, col: selectedPiece.col },
                to: { row, col }
            });
            selectedPiece = null;
            clearHighlights();
        }
    } else if (selectedPiece) { 
        // 点击的是空位，且已选中棋子，执行移动
        socket.emit('playerMove', {
            roomId,
            from: { row: selectedPiece.row, col: selectedPiece.col },
            to: { row, col }
        });
        selectedPiece = null;
        clearHighlights();
    }
});


// 模态框事件绑定
closeModalBtn.addEventListener('click', () => roleSwitchModal.classList.remove('visible'));
switchToRedBtn.addEventListener('click', () => {
    socket.emit('requestRoleSwitch', { roomId, targetRole: 'red' });
    roleSwitchModal.classList.remove('visible');
});
switchToBlackBtn.addEventListener('click', () => {
    socket.emit('requestRoleSwitch', { roomId, targetRole: 'black' });
    roleSwitchModal.classList.remove('visible');
});
switchToSpectatorBtn.addEventListener('click', () => {
    socket.emit('requestRoleSwitch', { roomId, targetRole: 'spectator' });
    roleSwitchModal.classList.remove('visible');
});


addMessageToBox('系统', '欢迎来到象棋房间！', 'system');