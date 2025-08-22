// game.js - 游戏房间页面的 JavaScript

document.addEventListener('DOMContentLoaded', () => {

    function applyCustomSettings() {
        const defaultSettings = {
            title: '实时网页象棋 - 房间',
            redColor: '#c0392b',
            blackColor: '#2c3e50',
            boardBg: '#e6c5a1',
            boardLine: '#6b4724'
        };
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        
        if (savedSettings.title) {
            document.title = savedSettings.title + " - 房间";
        } else {
            document.title = defaultSettings.title;
        }

        document.documentElement.style.setProperty('--red-piece-text', savedSettings.redColor || defaultSettings.redColor);
        document.documentElement.style.setProperty('--black-piece-text', savedSettings.blackColor || defaultSettings.blackColor);
        document.documentElement.style.setProperty('--board-bg', savedSettings.boardBg || defaultSettings.boardBg);
        document.documentElement.style.setProperty('--line-color', savedSettings.boardLine || defaultSettings.boardLine);
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
    let isBoardFlipped = false;

    // --- 从 localStorage 获取用户名 ---
    let myUsername = localStorage.getItem('chessUsername');
    if (!myUsername) {
        myUsername = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
        localStorage.setItem('chessUsername', myUsername);
    }

    // 加入房间
    socket.emit('joinRoom', { roomId, username: myUsername });


    // --- SOCKET.IO 事件监听 ---

    socket.on('usernameUpdated', ({ newUsername }) => {
        myUsername = newUsername;
        localStorage.setItem('chessUsername', newUsername);
        alert(`用户名已存在，您的用户名已更新为: ${myUsername}`);
    });

    socket.on('roomInfo', ({ room, role, username }) => {
        myUsername = username;
        myRole = role;
        currentRoomState = room;
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

    socket.on('playersListUpdate', (players) => {
        currentRoomState.players = players;
        updatePlayersList(players);
    });

    socket.on('spectatorsListUpdate', (spectators) => {
        currentRoomState.spectators = spectators;
        updateSpectatorsList(spectators);
    });

    socket.on('gameStateUpdate', (gameState) => {
        currentRoomState.gameState = gameState;
        renderBoard(gameState.board, gameState.currentPlayer);
        updateCapturedPieces(gameState.capturedPieces);
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
        if (reason) {
            message += ` (${reason})`;
        }
        setTimeout(() => {
            alert(message);
            if (myRole === 'player') {
                restartBtn.style.display = 'inline-block';
            }
        }, 100);
    });

    socket.on('undoRequest', ({ from }) => {
        const accepted = confirm(`${from} 请求悔棋，你是否同意？`);
        socket.emit('undoResponse', { roomId, accepted });
    });

    socket.on('systemMessage', ({ message }) => {
        addMessageToBox('系统', message, 'system');
    });

    socket.on('restartRequest', ({ from }) => {
        const accepted = confirm(`${from} 请求重新开始游戏，你是否同意？`);
        socket.emit('restartResponse', { roomId, accepted });
    });

    // --- DOM 操作函数 ---

    function updateRoomInfo(room, role) {
        roomInfoEl.innerHTML = `
            <h2>${room.name}</h2>
            <p>状态: <span id="roomStatusText" class="status-text">${room.status}</span></p>
            <p>您的身份: ${role === 'player' ? `玩家 (${myColor === 'red' ? '红方' : '黑方'})` : '观战者'} (${myUsername})</p>
        `;
    }

    socket.on('roomStatusUpdate', ({ status }) => {
        const statusEl = document.getElementById('roomStatusText');
        if(statusEl) statusEl.textContent = status;
        if (status === 'playing') {
            restartBtn.style.display = 'none';
        }
    });

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
                    if (pieceData.color === myColor && isMyTurn) {
                        pieceEl.classList.add('playable');
                    }
                    pieceEl.textContent = getPieceSymbol(pieceData);
                    pieceEl.dataset.row = r;
                    pieceEl.dataset.col = c;
                    
                    // 保持棋子翻转状态
                    if(isBoardFlipped) {
                        pieceEl.style.transform = 'translate(-50%, -50%) rotate(180deg)';
                    }

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
        if (!piece) return '';
        const symbols = {
            'general': piece.color === 'red' ? '帅' : '将', 'advisor': piece.color === 'red' ? '仕' : '士', 'elephant': piece.color === 'red' ? '相' : '象', 'horse': piece.color === 'red' ? '馬' : '馬', 'chariot': piece.color === 'red' ? '車' : '車', 'cannon': piece.color === 'red' ? '炮' : '炮', 'soldier': piece.color === 'red' ? '兵' : '卒'
        };
        return symbols[piece.type];
    }

    function updatePlayersList(players) {
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
            pieceEl.className = 'captured-piece red';
            pieceEl.textContent = getPieceSymbol({ type: pieceType, color: 'red' });
            redContainer.appendChild(pieceEl);
        });

        (captured.black || []).forEach(pieceType => {
            const pieceEl = document.createElement('div');
            pieceEl.className = 'captured-piece black';
            pieceEl.textContent = getPieceSymbol({ type: pieceType, color: 'black' });
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
        document.querySelectorAll('.selected, .valid-move').forEach(el => {
            el.classList.remove('selected', 'valid-move');
        });
    }

    // --- 事件绑定 ---
    sendMessageBtnEl.addEventListener('click', sendMessage);
    messageInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    undoBtn.addEventListener('click', () => {
        socket.emit('requestUndo', { roomId });
        addMessageToBox('系统', '已发送悔棋请求，等待对方同意...', 'system');
    });
    
    restartBtn.addEventListener('click', () => {
        socket.emit('requestRestart', { roomId });
        addMessageToBox('系统', '已发送重新开始请求...', 'system');
    });

    // 新增：翻转棋盘事件
    flipBoardBtn.addEventListener('click', () => {
        isBoardFlipped = !isBoardFlipped;
        chessBoardEl.style.transition = 'transform 0.5s ease-in-out';
        chessBoardEl.style.transform = isBoardFlipped ? 'rotate(180deg)' : 'rotate(0deg)';

        const pieces = chessBoardEl.querySelectorAll('.chess-piece');
        pieces.forEach(piece => {
            piece.style.transition = 'transform 0.5s ease-in-out';
            piece.style.transform = isBoardFlipped 
                ? 'translate(-50%, -50%) rotate(180deg)' 
                : 'translate(-50%, -50%) rotate(0deg)';
        });
    });


    let selectedPiece = null;
    chessBoardEl.addEventListener('click', (e) => {
        if (myRole !== 'player') return;

        const target = e.target.closest('.board-cell');
        if (!target) return;

        const row = parseInt(target.dataset.row);
        const col = parseInt(target.dataset.col);
        const pieceData = currentRoomState.gameState.board[row][col];

        if (pieceData) { // 点击的位置有棋子
            if (pieceData.color === myColor) {
                if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
                    selectedPiece = null;
                    clearHighlights();
                } else {
                    selectedPiece = { row, col };
                    clearHighlights();
                    target.querySelector('.chess-piece').classList.add('selected');
                }
            } else if (selectedPiece) {
                socket.emit('playerMove', {
                    roomId,
                    from: { row: selectedPiece.row, col: selectedPiece.col },
                    to: { row, col }
                });
                selectedPiece = null;
                clearHighlights();
            }
        } else if (selectedPiece) { 
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
});
