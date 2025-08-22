// game.js - 游戏房间页面的 JavaScript

document.addEventListener('DOMContentLoaded', () => {

    function applyCustomSettings() {
        const defaultSettings = {
            title: '实时网页象棋',
            redColor: '#c0392b',
            blackColor: '#2c3e50',
            redBg: '#ffdddd',
            blackBg: '#f0f0f0',
            pieceBorder: '#888888',
            boardBg: '#e6c5a1',
            boardLine: '#6b4724',
            boardBorder: '#8b5a2b'
        };
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        
        const titleText = savedSettings.title || defaultSettings.title;
        document.title = titleText + " - 房间";
        const pageTitleHeader = document.getElementById('pageTitleHeader');
        if (pageTitleHeader) pageTitleHeader.textContent = titleText;


        document.documentElement.style.setProperty('--red-piece-text', savedSettings.redColor);
        document.documentElement.style.setProperty('--black-piece-text', savedSettings.blackColor);
        document.documentElement.style.setProperty('--red-piece-bg', savedSettings.redBg);
        document.documentElement.style.setProperty('--black-piece-bg', savedSettings.blackBg);
        document.documentElement.style.setProperty('--piece-border', savedSettings.pieceBorder);
        document.documentElement.style.setProperty('--board-bg', savedSettings.boardBg);
        document.documentElement.style.setProperty('--line-color', savedSettings.boardLine);
        document.documentElement.style.setProperty('--border-color', savedSettings.boardBorder);
    }

    applyCustomSettings();

    const socket = io();

    const roomId = window.location.pathname.split('/')[2];
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
    const undoBtn = document.getElementById('undoBtn');
    const restartBtn = document.getElementById('restartBtn');
    const flipBoardBtn = document.getElementById('flipBoardBtn');
    const moveHistoryEl = document.getElementById('moveHistory');
    
    // 角色切换弹窗
    const roleSwitchModal = document.getElementById('roleSwitchModal');
    const switchToRedBtn = document.getElementById('switchToRedBtn');
    const switchToBlackBtn = document.getElementById('switchToBlackBtn');
    const switchToSpectatorBtn = document.getElementById('switchToSpectatorBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');


    let isBoardFlipped = false;

    let myUsername = localStorage.getItem('chessUsername');
    if (!myUsername) {
        myUsername = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
        localStorage.setItem('chessUsername', myUsername);
    }

    socket.emit('joinRoom', { roomId, username: myUsername });

    socket.on('usernameUpdated', ({ newUsername }) => {
        myUsername = newUsername;
        localStorage.setItem('chessUsername', newUsername);
        alert(`用户名已存在，您的用户名已更新为: ${newUsername}`);
    });

    socket.on('roomInfo', ({ room, role, username }) => {
        myUsername = username;
        myRole = role;
        currentRoomState = room;
        const meAsPlayer = room.players.find(p => p.username === myUsername && p.id);
        
        if (meAsPlayer) {
            myRole = 'player';
            myColor = meAsPlayer.color;
        } else {
            myRole = 'spectator';
            myColor = '';
        }

        updateRoomInfo(room, myRole);
        renderBoard(room.gameState.board, room.gameState.currentPlayer);
        updatePlayersList(room.players);
        updateSpectatorsList(room.spectators);
        updateMoveHistory(room.gameState.moveHistory);

        // 如果我是观战者且有空位，显示角色选择弹窗
        if (myRole === 'spectator' && room.players.filter(p => p.id).length < 2) {
            updateAndShowRoleModal(room.players);
        }
    });
    
    socket.on('roleChanged', ({ newRole, color }) => {
        myRole = newRole;
        myColor = color;
        roleSwitchModal.classList.remove('visible');
        updateRoomInfo(currentRoomState, myRole);
    });

    socket.on('gameStateUpdate', (gameState) => {
        currentRoomState.gameState = gameState;
        renderBoard(gameState.board, gameState.currentPlayer);
        updateCapturedPieces(gameState.capturedPieces);
        updateMoveHistory(gameState.moveHistory);
    });
    
    // 其他 socket.on 事件监听...
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

    socket.on('playersListUpdate', (players) => {
        currentRoomState.players = players;
        updatePlayersList(players);
        if (myRole === 'spectator' && players.filter(p => p.id).length < 2) {
             updateAndShowRoleModal(players);
        } else if (players.filter(p => p.id).length === 2) {
            roleSwitchModal.classList.remove('visible');
        }
    });

    socket.on('spectatorsListUpdate', (spectators) => {
        currentRoomState.spectators = spectators;
        updateSpectatorsList(spectators);
    });
    
    socket.on('newMessage', ({ username, message }) => {
        addMessageToBox(username, message, 'user');
    });

    socket.on('moveRejected', ({ reason }) => {
        alert(`移动被拒绝: ${reason}`);
        selectedPiece = null;
        clearHighlights();
    });

    socket.on('gameOver', ({ winner, reason }) => {
        let message = `游戏结束！${winner || '无人'} 获胜！`;
        if (reason) message += ` (${reason})`;
        alert(message);
        if (myRole === 'player') restartBtn.style.display = 'inline-block';
    });
    
    socket.on('undoRequest', ({ from }) => {
        if(confirm(`${from} 请求悔棋，你是否同意？`)) {
            socket.emit('undoResponse', { roomId, accepted: true });
        } else {
            socket.emit('undoResponse', { roomId, accepted: false });
        }
    });

    socket.on('systemMessage', ({ message }) => {
        addMessageToBox('系统', message, 'system');
    });
    
     socket.on('restartRequest', ({ from }) => {
        if(confirm(`${from} 请求重新开始游戏，你是否同意？`)) {
            socket.emit('restartResponse', { roomId, accepted: true });
        } else {
            socket.emit('restartResponse', { roomId, accepted: false });
        }
    });


    function updateRoomInfo(room, role) {
        roomInfoEl.innerHTML = `
            <h2>${room.name}</h2>
            <p>状态: <span id="roomStatusText" class="status-text">${room.status}</span></p>
            <p>您的身份: ${role === 'player' ? `玩家 (${myColor === 'red' ? '红方' : '黑方'})` : '观战者'} (${myUsername})</p>
        `;
    }

    // ... renderBoard, getPieceSymbol, 等其他函数保持不变 ...
    function renderBoard(board, currentPlayer) {
        chessBoardEl.innerHTML = '';
        const isMyTurn = myColor === currentPlayer && myRole === 'player';

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
                    if (isMyTurn) pieceEl.classList.add('playable');
                    pieceEl.textContent = getPieceSymbol(pieceData);
                    pieceEl.dataset.row = r;
                    pieceEl.dataset.col = c;
                    if(isBoardFlipped) pieceEl.style.transform = 'translate(-50%, -50%) rotate(180deg)';
                    cell.appendChild(pieceEl);
                }
                chessBoardEl.appendChild(cell);
            }
        }
        addBoardFeatures();
        const sidePanel = document.querySelector('.side-panel');
        sidePanel.classList.toggle('red-turn', currentPlayer === 'red');
        sidePanel.classList.toggle('black-turn', currentPlayer === 'black');
    }

    function addBoardFeatures() {
        // ... (内容不变)
        const palaceTop = document.createElement('div');
        palaceTop.className = 'palace palace-top';
        chessBoardEl.appendChild(palaceTop);
        const palaceBottom = document.createElement('div');
        palaceBottom.className = 'palace palace-bottom';
        chessBoardEl.appendChild(palaceBottom);
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
        // ... (内容不变)
        if (!piece) return '';
        const symbols = { 'general': '将', 'advisor': '士', 'elephant': '象', 'horse': '馬', 'chariot': '車', 'cannon': '炮', 'soldier': '卒' };
        const redSymbols = { 'general': '帅', 'advisor': '仕', 'elephant': '相', 'horse': '馬', 'chariot': '車', 'cannon': '炮', 'soldier': '兵' };
        return piece.color === 'red' ? redSymbols[piece.type] : symbols[piece.type];
    }
    
    function updatePlayersList(players) {
        // ... (内容不变)
        playersListEl.innerHTML = '';
        const blackPlayer = players.find(p => p.color === 'black');
        const redPlayer = players.find(p => p.color === 'red');
        const redColor = getComputedStyle(document.documentElement).getPropertyValue('--red-piece-text');
        const blackColor = getComputedStyle(document.documentElement).getPropertyValue('--black-piece-text');
        const createColorSwatch = (color) => `<span style="display: inline-block; width: 14px; height: 14px; background-color: ${color}; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>`;
        const blackLi = document.createElement('li');
        blackLi.innerHTML = `${createColorSwatch(blackColor)}黑方: ${blackPlayer ? `${blackPlayer.username} ${blackPlayer.id ? '' : '(离线)'}` : '(空位)'}`;
        if(blackPlayer && blackPlayer.username === myUsername) blackLi.style.fontWeight = 'bold';
        playersListEl.appendChild(blackLi);
        const redLi = document.createElement('li');
        redLi.innerHTML = `${createColorSwatch(redColor)}红方: ${redPlayer ? `${redPlayer.username} ${redPlayer.id ? '' : '(离线)'}` : '(空位)'}`;
        if(redPlayer && redPlayer.username === myUsername) redLi.style.fontWeight = 'bold';
        playersListEl.appendChild(redLi);
    }
    
    function updateMoveHistory(history) {
        // ... (内容不变)
        if (!history) return;
        moveHistoryEl.innerHTML = '';
        history.forEach((move, index) => {
            const moveItem = document.createElement('div');
            moveItem.className = 'move-history-item';
            const moveNumber = Math.floor(index / 2) + 1;
            if (index % 2 === 0) {
                moveItem.innerHTML = `<span class="move-number">${moveNumber}.</span> <span class="move-text">${move}</span>`;
            } else {
                const prevItem = moveHistoryEl.querySelector(`.move-history-item:last-child`);
                if (prevItem && prevItem.children.length === 2) {
                     prevItem.innerHTML += `<span class="move-text" style="margin-left: 20px;">${move}</span>`;
                } else {
                    moveItem.innerHTML = `<span class="move-number">${moveNumber}.</span> <span class="move-text" style="visibility: hidden;">...</span> <span class="move-text" style="margin-left: 20px;">${move}</span>`;
                    moveHistoryEl.appendChild(moveItem);
                }
            }
            if(index % 2 === 0) moveHistoryEl.appendChild(moveItem);
        });
        moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
    }
    
    // ... 其他辅助函数 ...
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
    
    function updateCapturedPieces(captured) {
        if (!captured) return;
        const redContainer = document.querySelector('#capturedForRed .pieces-container');
        const blackContainer = document.querySelector('#capturedForBlack .pieces-container');
        redContainer.innerHTML = '';
        blackContainer.innerHTML = '';
        (captured.red || []).forEach(pieceType => {
            const pieceEl = document.createElement('div');
            pieceEl.className = 'captured-piece black';
            pieceEl.textContent = getPieceSymbol({ type: pieceType, color: 'black' });
            redContainer.appendChild(pieceEl);
        });
        (captured.black || []).forEach(pieceType => {
            const pieceEl = document.createElement('div');
            pieceEl.className = 'captured-piece red';
            pieceEl.textContent = getPieceSymbol({ type: pieceType, color: 'red' });
            blackContainer.appendChild(pieceEl);
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
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    }
    
    // 角色选择弹窗逻辑
    function updateAndShowRoleModal(players) {
        const existingColors = players.filter(p=>p.id).map(p => p.color);
        switchToRedBtn.disabled = existingColors.includes('red');
        switchToBlackBtn.disabled = existingColors.includes('black');
        roleSwitchModal.classList.add('visible');
    }

    switchToRedBtn.addEventListener('click', () => socket.emit('switchRole', { roomId, username: myUsername, desiredRole: 'red' }));
    switchToBlackBtn.addEventListener('click', () => socket.emit('switchRole', { roomId, username: myUsername, desiredRole: 'black' }));
    switchToSpectatorBtn.addEventListener('click', () => roleSwitchModal.classList.remove('visible'));
    closeModalBtn.addEventListener('click', () => roleSwitchModal.classList.remove('visible'));


    // --- 事件绑定 ---
    sendMessageBtnEl.addEventListener('click', sendMessage);
    messageInputEl.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
    undoBtn.addEventListener('click', () => socket.emit('requestUndo', { roomId }));
    restartBtn.addEventListener('click', () => socket.emit('requestRestart', { roomId }));
    flipBoardBtn.addEventListener('click', () => {
        isBoardFlipped = !isBoardFlipped;
        chessBoardEl.style.transform = isBoardFlipped ? 'rotate(180deg)' : 'rotate(0deg)';
        chessBoardEl.querySelectorAll('.chess-piece').forEach(p => p.style.transform = isBoardFlipped ? 'translate(-50%, -50%) rotate(180deg)' : 'translate(-50%, -50%) rotate(0deg)');
    });

    let selectedPiece = null;
    chessBoardEl.addEventListener('click', (e) => {
        if (myRole !== 'player') return;
        const target = e.target.closest('.board-cell');
        if (!target) return;
        const row = parseInt(target.dataset.row), col = parseInt(target.dataset.col);
        const pieceData = currentRoomState.gameState.board[row][col];
        if (pieceData && pieceData.color === myColor) {
            selectedPiece = { row, col };
            clearHighlights();
            target.querySelector('.chess-piece').classList.add('selected');
        } else if (selectedPiece) {
            socket.emit('playerMove', { roomId, from: selectedPiece, to: { row, col } });
            selectedPiece = null;
            clearHighlights();
        }
    });

    addMessageToBox('系统', '欢迎来到象棋房间！', 'system');
});
