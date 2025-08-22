// lobby.js - 大厅页面的 JavaScript

// 连接到 Socket.IO 服务器
const socket = io();

// 获取 DOM 元素
const createRoomBtn = document.getElementById('createRoomBtn');
const roomList = document.getElementById('roomList');

// 生成唯一的房间 ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// 创建房间
createRoomBtn.addEventListener('click', () => {
    const roomId = generateRoomId();
    const roomName = prompt('请输入房间名称:', `房间 ${roomId}`);
    
    if (roomName) {
        // 重定向到房间页面
        window.location.href = `/room/${roomId}`;
    }
});

// 获取房间列表（在实际应用中，这应该从服务器获取）
function loadRoomList() {
    // 模拟房间数据
    const rooms = [
        { id: 'ABC123', name: '快棋房', status: 'waiting', players: 1, spectators: 2 },
        { id: 'DEF456', name: '友谊赛', status: 'playing', players: 2, spectators: 5 },
        { id: 'GHI789', name: '高手对决', status: 'waiting', players: 1, spectators: 0 }
    ];
    
    // 清空房间列表
    roomList.innerHTML = '';
    
    // 添加房间到列表
    rooms.forEach(room => {
        const li = document.createElement('li');
        
        // 格式化状态显示
        let statusText = '';
        let statusClass = '';
        
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
        
        li.innerHTML = `
            <div>
                <span class="room-name">${room.name}</span>
                <span class="room-status ${statusClass}">${statusText}</span>
            </div>
            <div class="room-info">
                <span>玩家: ${room.players}/2</span>
                <span>观战: ${room.spectators}</span>
            </div>
            <div class="room-actions">
                <button class="btn btn-primary" onclick="joinRoom('${room.id}')">加入</button>
            </div>
        `;
        
        roomList.appendChild(li);
    });
}

// 加入房间
function joinRoom(roomId) {
    window.location.href = `/room/${roomId}`;
}

// 页面加载时获取房间列表
document.addEventListener('DOMContentLoaded', () => {
    loadRoomList();
});