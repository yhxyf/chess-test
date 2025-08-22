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

    function generateRoomId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    createRoomBtn.addEventListener('click', () => {
        const roomId = generateRoomId();
        let username = localStorage.getItem('chessUsername');
        if (!username) {
            username = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
            localStorage.setItem('chessUsername', username);
        }
        const roomName = prompt('请输入房间名称:', `${username}的房间`);
        
        if (roomName) {
            // 在这里我们不直接跳转，而是通知服务器创建房间
            // 服务器创建成功后，可以通过一个回调或者事件来跳转
            // 为了简单起见，我们还是直接跳转，服务器端处理房间的创建
            window.location.href = `/room/${roomId}?name=${encodeURIComponent(roomName)}`;
        }
    });

    window.joinRoom = function(roomId) {
        let username = localStorage.getItem('chessUsername');
        if (!username) {
            username = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
            localStorage.setItem('chessUsername', username);
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
