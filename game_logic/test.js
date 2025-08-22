const { getValidMoves, isValidMove, isCheck, isCheckmate } = require('./chessRules');

// 创建一个初始棋盘
function createInitialBoard() {
  // 创建一个空的10x9棋盘 (0-9行, 0-8列)
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  
  // 设置红方棋子 (棋盘下方，第0行和第2行、第3行)
  // 第0行：车 马 相 仕 帅 仕 相 马 车
  board[0][0] = { color: 'red', type: 'chariot', row: 0, col: 0 };   // 车
  board[0][1] = { color: 'red', type: 'horse', row: 0, col: 1 };     // 马
  board[0][2] = { color: 'red', type: 'elephant', row: 0, col: 2 };  // 相
  board[0][3] = { color: 'red', type: 'advisor', row: 0, col: 3 };   // 仕
  board[0][4] = { color: 'red', type: 'general', row: 0, col: 4 };   // 帅
  board[0][5] = { color: 'red', type: 'advisor', row: 0, col: 5 };   // 仕
  board[0][6] = { color: 'red', type: 'elephant', row: 0, col: 6 };  // 相
  board[0][7] = { color: 'red', type: 'horse', row: 0, col: 7 };     // 马
  board[0][8] = { color: 'red', type: 'chariot', row: 0, col: 8 };   // 车
  
  // 第2行：炮 炮
  board[2][1] = { color: 'red', type: 'cannon', row: 2, col: 1 };    // 炮
  board[2][7] = { color: 'red', type: 'cannon', row: 2, col: 7 };    // 炮
  
  // 第3行：兵 兵 兵 兵 兵
  board[3][0] = { color: 'red', type: 'soldier', row: 3, col: 0 };   // 兵
  board[3][2] = { color: 'red', type: 'soldier', row: 3, col: 2 };   // 兵
  board[3][4] = { color: 'red', type: 'soldier', row: 3, col: 4 };   // 兵
  board[3][6] = { color: 'red', type: 'soldier', row: 3, col: 6 };   // 兵
  board[3][8] = { color: 'red', type: 'soldier', row: 3, col: 8 };   // 兵
  
  // 设置黑方棋子 (棋盘上方，第9行和第7行、第6行)
  // 第9行：车 马 象 士 将 士 象 马 车
  board[9][0] = { color: 'black', type: 'chariot', row: 9, col: 0 };   // 车
  board[9][1] = { color: 'black', type: 'horse', row: 9, col: 1 };     // 马
  board[9][2] = { color: 'black', type: 'elephant', row: 9, col: 2 };  // 象
  board[9][3] = { color: 'black', type: 'advisor', row: 9, col: 3 };   // 士
  board[9][4] = { color: 'black', type: 'general', row: 9, col: 4 };   // 将
  board[9][5] = { color: 'black', type: 'advisor', row: 9, col: 5 };   // 士
  board[9][6] = { color: 'black', type: 'elephant', row: 9, col: 6 };  // 象
  board[9][7] = { color: 'black', type: 'horse', row: 9, col: 7 };     // 马
  board[9][8] = { color: 'black', type: 'chariot', row: 9, col: 8 };   // 车
  
  // 第7行：炮 炮
  board[7][1] = { color: 'black', type: 'cannon', row: 7, col: 1 };    // 炮
  board[7][7] = { color: 'black', type: 'cannon', row: 7, col: 7 };    // 炮
  
  // 第6行：卒 卒 卒 卒 卒
  board[6][0] = { color: 'black', type: 'soldier', row: 6, col: 0 };   // 卒
  board[6][2] = { color: 'black', type: 'soldier', row: 6, col: 2 };   // 卒
  board[6][4] = { color: 'black', type: 'soldier', row: 6, col: 4 };   // 卒
  board[6][6] = { color: 'black', type: 'soldier', row: 6, col: 6 };   // 卒
  board[6][8] = { color: 'black', type: 'soldier', row: 6, col: 8 };   // 卒
  
  return board;
}

// 测试帅的移动
function testGeneralMoves() {
  console.log('测试帅的移动...');
  const board = createInitialBoard();
  const general = board[0][4]; // 红方帅
  const moves = getValidMoves(general, board);
  console.log('红方帅的合法移动:', moves);
}

// 测试车的移动
function testChariotMoves() {
  console.log('测试车的移动...');
  const board = createInitialBoard();
  const chariot = board[0][0]; // 红方车
  const moves = getValidMoves(chariot, board);
  console.log('红方车的合法移动:', moves);
}

// 测试马的移动
function testHorseMoves() {
  console.log('测试马的移动...');
  const board = createInitialBoard();
  const horse = board[0][1]; // 红方马
  const moves = getValidMoves(horse, board);
  console.log('红方马的合法移动:', moves);
}

// 测试兵的移动
function testSoldierMoves() {
  console.log('测试兵的移动...');
  const board = createInitialBoard();
  const soldier = board[3][0]; // 红方兵
  const moves = getValidMoves(soldier, board);
  console.log('红方兵的合法移动:', moves);
}

// 测试移动验证
function testMoveValidation() {
  console.log('测试移动验证...');
  const board = createInitialBoard();
  
  // 测试合法移动
  const isValid1 = isValidMove(0, 0, 0, 1, 'red', board); // 车向右移动一格
  console.log('车向右移动一格是否合法:', isValid1);
  
  // 测试非法移动
  const isValid2 = isValidMove(0, 0, 0, 2, 'red', board); // 车向右移动两格（被马阻挡）
  console.log('车向右移动两格是否合法:', isValid2);
}

// 运行测试
console.log('开始测试中国象棋游戏逻辑...\n');

testGeneralMoves();
console.log();

testChariotMoves();
console.log();

testHorseMoves();
console.log();

testSoldierMoves();
console.log();

testMoveValidation();
console.log();

console.log('测试完成。');