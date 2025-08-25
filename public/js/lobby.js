// lobby.js - 大厅页面的 JavaScript

document.addEventListener('DOMContentLoaded', () => {

    function applyCustomSettings() {
        const pageTitleHeader = document.getElementById('pageTitleHeader');
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
        document.title = titleText + " - 大厅";
        if (pageTitleHeader) {
            pageTitleHeader.textContent = titleText;
        }

        document.documentElement.style.setProperty('--red-piece-text', savedSettings.redColor || defaultSettings.redColor);
        document.documentElement.style.setProperty('--black-piece-text', savedSettings.blackColor || defaultSettings.blackColor);
        document.documentElement.style.setProperty('--red-piece-bg', savedSettings.redBg || defaultSettings.redBg);
        document.documentElement.style.setProperty('--black-piece-bg', savedSettings.blackBg || defaultSettings.blackBg);
        document.documentElement.style.setProperty('--piece-border', savedSettings.pieceBorder || defaultSettings.pieceBorder);
        document.documentElement.style.setProperty('--board-bg', savedSettings.boardBg || defaultSettings.boardBg);
        document.documentElement.style.setProperty('--line-color', savedSettings.boardLine || defaultSettings.boardLine);
        document.documentElement.style.setProperty('--border-color', savedSettings.boardBorder || defaultSettings.boardBorder);
    }

    applyCustomSettings();

    const socket = io();

    const createRoomBtn = document.getElementById('createRoomBtn');
    const roomListEl = document.getElementById('roomList');
    const noRoomsMessage = document.getElementById('noRoomsMessage');
    const authButtons = document.getElementById('authButtons');
    const userActions = document.getElementById('userActions');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const guestModeBtn = document.getElementById('guestModeBtn');

    let currentUser = null;

    // 检查登录状态
    fetch('/api/check-auth')
        .then(res => res.json())
        .then(data => {
            if (data.loggedIn) {
                currentUser = data.username;
                localStorage.setItem('chessUsername', currentUser);
                localStorage.removeItem('chessGuestName'); // 清除游客名
                updateUIForLoggedInUser();
            } else {
                updateUIForLoggedOutUser();
            }
        });

    function updateUIForLoggedInUser() {
        authButtons.style.display = 'none';
        userActions.style.display = 'inline-block';
        usernameDisplay.textContent = `欢迎, ${currentUser}`;
        guestModeBtn.style.display = 'none';
    }

    function updateUIForLoggedOutUser() {
        authButtons.style.display = 'inline-block';
        userActions.style.display = 'none';
        guestModeBtn.style.display = 'inline-block';
    }
    
    logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                currentUser = null;
                localStorage.removeItem('chessUsername');
                updateUIForLoggedOutUser();
            });
    });

    guestModeBtn.addEventListener('click', () => {
        let guestName = localStorage.getItem('chessGuestName');
        if (!guestName) {
            guestName = prompt('请输入您的游客昵称:', '游客' + Math.floor(Math.random() * 1000));
            if(guestName) {
                localStorage.setItem('chessGuestName', guestName);
                 alert(`欢迎，游客 ${guestName}！现在您可以创建或加入房间了。`);
            }
        } else {
            alert(`您当前以游客 ${guestName} 的身份活动。`);
        }
    });


    function generateRoomId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    function getUsername(isCreating) {
        if (currentUser) {
            return currentUser;
        }
        let guestName = localStorage.getItem('chessGuestName');
        if (guestName) {
            return guestName;
        }
        // 如果是创建房间，必须有名字
        if (isCreating) {
             guestName = prompt('作为游客，请输入一个昵称来创建房间:', '游客' + Math.floor(Math.random() * 1000));
             if(guestName) localStorage.setItem('chessGuestName', guestName);
             return guestName;
        }
        // 如果是加入房间，可以在房间页面再输入
        return null;
    }

    createRoomBtn.addEventListener('click', () => {
        const username = getUsername(true);
        if (!username) {
             alert('您需要一个昵称才能创建房间。');
             return;
        }

        const roomId = generateRoomId();
        const roomName = prompt('请输入房间名称:', `${username}的房间`);
        
        if (roomName) {
            window.location.href = `/room/${roomId}?name=${encodeURIComponent(roomName)}`;
        }
    });

    window.joinRoom = function(roomId) {
        const username = getUsername(false);
         if (!username && !currentUser) {
            alert('请先登录或进入游客模式以加入房间。');
            guestModeBtn.style.border = '2px solid red'; // 提示用户
            return;
        }
        window.location.href = `/room/${roomId}`;
    }

    socket.on('roomListUpdate', (rooms) => {
        roomListEl.innerHTML = ''; 

        if (rooms.length === 0) {
            noRoomsMessage.style.display = 'block';
        } else {
            noRoomsMessage.style.display = 'none';
            rooms.forEach(room => {
                const li = document.createElement('li');
                
                let statusText, statusClass;
                switch(room.status) {
                    case 'waiting':
                        statusText = '等待中';
                        statusClass = 'status-waiting';
                        break;
                    case 'playing':
                        statusText = '游戏中';
                        statusClass = 'status-playing';
                        break;
                    case 'finished':
                        statusText = '已结束';
                        statusClass = 'status-finished';
                        break;
                }

                const canJoin = room.status === 'waiting' && room.players < 2;
                const joinButtonHTML = `<button class="btn" onclick="joinRoom('${room.id}')">${canJoin ? '加入' : '观战'}</button>`;
                
                li.innerHTML = `
                    <div class="room-details">
                        <span class="room-name">${room.name}</span>
                        <span class="room-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="room-meta">
                        <span>玩家: ${room.players}/2</span>
                        <span>观战: ${room.spectators}</span>
                    </div>
                    <div class="room-actions">
                        ${joinButtonHTML}
                    </div>
                `;
                roomListEl.appendChild(li);
            });
        }
    });

    socket.emit('getRoomList');
});