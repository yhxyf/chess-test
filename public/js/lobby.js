// lobby.js - 大厅页面的 JavaScript

document.addEventListener('DOMContentLoaded', () => {

    function applyCustomSettings() {
        const pageTitleHeader = document.getElementById('pageTitleHeader');
        const defaultSettings = {
            title: '实时网页象棋',
            redColor: '#c0392b',
            blackColor: '#2c3e50',
            boardBg: '#e6c5a1',
            boardLine: '#6b4724'
        };
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        
        // 更新浏览器标签页标题和页面H1标题
        const titleText = savedSettings.title || defaultSettings.title;
        document.title = titleText + " - 大厅";
        if (pageTitleHeader) {
            pageTitleHeader.textContent = titleText;
        }

        document.documentElement.style.setProperty('--red-piece-text', savedSettings.redColor || defaultSettings.redColor);
        document.documentElement.style.setProperty('--black-piece-text', savedSettings.blackColor || defaultSettings.blackColor);
        document.documentElement.style.setProperty('--board-bg', savedSettings.boardBg || defaultSettings.boardBg);
        document.documentElement.style.setProperty('--line-color', savedSettings.boardLine || defaultSettings.boardLine);
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
        // 确保用户名已设置
        let username = localStorage.getItem('chessUsername');
        if (!username) {
            username = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
            localStorage.setItem('chessUsername', username);
        }
        const roomName = prompt('请输入房间名称:', `房间 ${roomId}`);
        
        if (roomName) {
            window.location.href = `/room/${roomId}`;
        }
    });

    // 将 joinRoom 函数挂载到 window 对象上，以便 HTML onclick 可以调用
    window.joinRoom = function(roomId) {
        // 确保用户名已设置
        let username = localStorage.getItem('chessUsername');
        if (!username) {
            username = prompt('请输入您的用户名:') || '游客' + Math.floor(Math.random() * 1000);
            localStorage.setItem('chessUsername', username);
        }
        window.location.href = `/room/${roomId}`;
    }

    // 监听服务器的房间列表更新
    socket.on('roomListUpdate', (rooms) => {
        roomListEl.innerHTML = ''; // 清空现有列表

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

    // 页面加载时请求一次房间列表
    socket.emit('getRoomList');
});