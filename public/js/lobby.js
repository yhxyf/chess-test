// lobby.js - 大厅页面的 JavaScript

const socket = io();

const createRoomBtn = document.getElementById('createRoomBtn');
const roomListEl = document.getElementById('roomList');
const noRoomsMessage = document.getElementById('noRoomsMessage');

function generateRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

createRoomBtn.addEventListener('click', () => {
    const roomId = generateRoomId();
    const roomName = prompt('请输入房间名称:', `房间 ${roomId}`);
    
    if (roomName) {
        window.location.href = `/room/${roomId}`;
    }
});

function joinRoom(roomId) {
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
            const joinButtonHTML = `<button class="btn btn-primary" onclick="joinRoom('${room.id}')">${canJoin ? '加入' : '观战'}</button>`;
            
            li.innerHTML = `
                <div class="room-details">
                    <span class="room-name">${room.name}</span>
                    <span class="room-status ${statusClass}">${statusText}</span>
                </div>
                <div class="room-meta">
                    <span><i class="icon-players"></i> ${room.players}/2</span>
                    <span><i class="icon-spectators"></i> ${room.spectators}</span>
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
document.addEventListener('DOMContentLoaded', () => {
    socket.emit('getRoomList');
});