# 实时网页象棋 (Real-time Express Chess)

一个基于 Node.js、Express 和 WebSocket 的实时在线中国象棋对战平台。

## 功能特性

- 创建游戏房间并邀请朋友对战
- 实时同步的在线对弈体验
- 观战模式，支持第三方用户实时观看对局
- 简单的聊天功能

## 技术栈

- 后端: Node.js, Express.js, Socket.IO
- 前端: HTML, CSS, JavaScript
- 实时通信: WebSocket (通过 Socket.IO)

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行项目

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 访问应用

打开浏览器访问 `http://localhost:3000`

## 项目结构

```
realtime-chess/
├── server.js          # 服务器入口文件
├── package.json       # 项目配置文件
├── README.md          # 项目说明文件
└── public/            # 静态资源目录
    ├── index.html     # 大厅页面
    ├── room.html      # 房间页面
    ├── css/
    │   └── style.css  # 样式文件
    └── js/
        ├── lobby.js   # 大厅页面逻辑
        └── game.js    # 游戏页面逻辑
```

## 开发计划

1. 完善核心游戏逻辑算法（棋子移动规则、将军判断等）
2. 实现完整的 WebSocket 事件处理
3. 添加游戏结束判断和通知逻辑
4. 优化用户界面和体验
5. 增加更多功能（悔棋、和棋判断等）