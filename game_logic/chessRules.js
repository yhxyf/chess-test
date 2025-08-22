/**
 * 中国象棋游戏规则实现
 */

// 棋盘尺寸
const BOARD_ROWS = 10;
const BOARD_COLS = 9;

// 九宫范围
const RED_PALACE = { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 };
const BLACK_PALACE = { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 };

// 楚河汉界
const RIVER_ROW_RED = 4;
const RIVER_ROW_BLACK = 5;

/**
 * 检查位置是否在棋盘内
 */
function isInBoard(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

/**
 * 检查位置是否在九宫内
 */
function isInPalace(row, col, color) {
  const palace = color === 'red' ? RED_PALACE : BLACK_PALACE;
  return row >= palace.rowMin && row <= palace.rowMax && 
         col >= palace.colMin && col <= palace.colMax;
}

/**
 * 检查是否过河
 */
function hasCrossedRiver(row, color) {
  if (color === 'red') {
    return row > RIVER_ROW_RED;
  } else {
    return row < RIVER_ROW_BLACK;
  }
}

/**
 * 获取帅/将的合法移动位置
 */
function getGeneralMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 可能的移动方向：上、下、左、右
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dRow, dCol] of directions) {
    const newRow = row + dRow;
    const newCol = col + dCol;
    
    // 检查是否在九宫内
    if (isInPalace(newRow, newCol, color)) {
      // 检查目标位置是否为空或者有敌方棋子
      const targetPiece = board[newRow][newCol];
      if (!targetPiece || targetPiece.color !== color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }
  
  // 检查飞将规则
  const opponentGeneralRow = findOpponentGeneralRow(board, color);
  if (opponentGeneralRow !== -1) {
    // 检查是否在同一条直线上
    if (col === board[opponentGeneralRow][4].col) {
      // 检查中间是否有棋子
      let hasPieceBetween = false;
      const startRow = Math.min(row, opponentGeneralRow) + 1;
      const endRow = Math.max(row, opponentGeneralRow);
      
      for (let r = startRow; r < endRow; r++) {
        if (board[r][col]) {
          hasPieceBetween = true;
          break;
        }
      }
      
      // 如果中间没有棋子，不能移动到会导致飞将的位置
      if (!hasPieceBetween) {
        // 移除会导致飞将的移动
        moves = moves.filter(move => move.col !== col);
      }
    }
  }
  
  return moves;
}

/**
 * 查找对方帅/将的行位置
 */
function findOpponentGeneralRow(board, color) {
  const opponentColor = color === 'red' ? 'black' : 'red';
  const opponentRow = opponentColor === 'red' ? 0 : 9;
  
  // 在对方九宫中查找帅/将
  for (let r = opponentRow; r <= opponentRow + 2; r++) {
    for (let c = 3; c <= 5; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'general' && piece.color === opponentColor) {
        return r;
      }
    }
  }
  
  return -1;
}

/**
 * 获取仕/士的合法移动位置
 */
function getAdvisorMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 可能的移动方向：四个对角线方向
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const [dRow, dCol] of directions) {
    const newRow = row + dRow;
    const newCol = col + dCol;
    
    // 检查是否在九宫内
    if (isInPalace(newRow, newCol, color)) {
      // 检查目标位置是否为空或者有敌方棋子
      const targetPiece = board[newRow][newCol];
      if (!targetPiece || targetPiece.color !== color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }
  
  return moves;
}

/**
 * 获取相/象的合法移动位置
 */
function getElephantMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 可能的移动方向：四个"田"字方向
  const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
  
  for (const [dRow, dCol] of directions) {
    const newRow = row + dRow;
    const newCol = col + dCol;
    
    // 检查是否在棋盘内
    if (isInBoard(newRow, newCol)) {
      // 检查是否过河
      if ((color === 'red' && newRow <= RIVER_ROW_RED) || 
          (color === 'black' && newRow >= RIVER_ROW_BLACK)) {
        // 检查象眼是否被堵住
        const eyeRow = row + dRow / 2;
        const eyeCol = col + dCol / 2;
        if (!board[eyeRow][eyeCol]) {
          // 检查目标位置是否为空或者有敌方棋子
          const targetPiece = board[newRow][newCol];
          if (!targetPiece || targetPiece.color !== color) {
            moves.push({ row: newRow, col: newCol });
          }
        }
      }
    }
  }
  
  return moves;
}

/**
 * 获取马的合法移动位置
 */
function getHorseMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 马的走法：先直走一格，再斜走一格
  // 可能的移动方向
  const directions = [
    // 先向上走
    { leg: [-1, 0], moves: [[-1, -1], [-1, 1]] },
    // 先向下走
    { leg: [1, 0], moves: [[1, -1], [1, 1]] },
    // 先向左走
    { leg: [0, -1], moves: [[-1, -1], [1, -1]] },
    // 先向右走
    { leg: [0, 1], moves: [[-1, 1], [1, 1]] }
  ];
  
  for (const direction of directions) {
    const [legRow, legCol] = direction.leg;
    const legPosRow = row + legRow;
    const legPosCol = col + legCol;
    
    // 检查马腿是否被堵住
    if (isInBoard(legPosRow, legPosCol) && !board[legPosRow][legPosCol]) {
      // 计算可能的移动位置
      for (const [dRow, dCol] of direction.moves) {
        const newRow = row + dRow;
        const newCol = col + dCol;
        
        // 检查是否在棋盘内
        if (isInBoard(newRow, newCol)) {
          // 检查目标位置是否为空或者有敌方棋子
          const targetPiece = board[newRow][newCol];
          if (!targetPiece || targetPiece.color !== color) {
            moves.push({ row: newRow, col: newCol });
          }
        }
      }
    }
  }
  
  return moves;
}

/**
 * 获取车的合法移动位置
 */
function getChariotMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 四个方向：上、下、左、右
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dRow, dCol] of directions) {
    let newRow = row + dRow;
    let newCol = col + dCol;
    
    // 沿着一个方向一直走，直到遇到棋子或边界
    while (isInBoard(newRow, newCol)) {
      const targetPiece = board[newRow][newCol];
      
      if (!targetPiece) {
        // 空位，可以移动
        moves.push({ row: newRow, col: newCol });
      } else {
        // 有棋子
        if (targetPiece.color !== color) {
          // 敌方棋子，可以吃掉
          moves.push({ row: newRow, col: newCol });
        }
        // 无论是己方还是敌方棋子，都不能继续往前走
        break;
      }
      
      newRow += dRow;
      newCol += dCol;
    }
  }
  
  return moves;
}

/**
 * 获取炮的合法移动位置
 */
function getCannonMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  // 四个方向：上、下、左、右
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dRow, dCol] of directions) {
    let newRow = row + dRow;
    let newCol = col + dCol;
    let hasScreen = false; // 是否已经越过了炮架
    
    // 沿着一个方向一直走，直到遇到边界
    while (isInBoard(newRow, newCol)) {
      const targetPiece = board[newRow][newCol];
      
      if (!targetPiece) {
        // 空位
        if (!hasScreen) {
          // 还没有炮架，可以移动
          moves.push({ row: newRow, col: newCol });
        }
      } else {
        // 有棋子
        if (!hasScreen) {
          // 遇到第一个棋子，作为炮架
          hasScreen = true;
        } else {
          // 已经有炮架了
          if (targetPiece.color !== color) {
            // 敌方棋子，可以吃掉
            moves.push({ row: newRow, col: newCol });
          }
          // 无论是否吃掉，都不能继续往前走
          break;
        }
      }
      
      newRow += dRow;
      newCol += dCol;
    }
  }
  
  return moves;
}

/**
 * 获取兵/卒的合法移动位置
 */
function getSoldierMoves(piece, board) {
  const moves = [];
  const { row, col, color } = piece;
  
  if (color === 'red') {
    // 红方兵的移动方向是向下（行数增加）
    // 向前移动
    const forwardRow = row + 1;
    if (isInBoard(forwardRow, col)) {
      const targetPiece = board[forwardRow][col];
      if (!targetPiece || targetPiece.color !== color) {
        moves.push({ row: forwardRow, col: col });
      }
    }
    
    // 如果已经过河，可以横向移动
    if (hasCrossedRiver(row, color)) {
      // 向左移动
      const leftCol = col - 1;
      if (isInBoard(row, leftCol)) {
        const targetPiece = board[row][leftCol];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: row, col: leftCol });
        }
      }
      
      // 向右移动
      const rightCol = col + 1;
      if (isInBoard(row, rightCol)) {
        const targetPiece = board[row][rightCol];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: row, col: rightCol });
        }
      }
    }
  } else {
    // 黑方卒的移动方向是向上（行数减少）
    // 向前移动
    const forwardRow = row - 1;
    if (isInBoard(forwardRow, col)) {
      const targetPiece = board[forwardRow][col];
      if (!targetPiece || targetPiece.color !== color) {
        moves.push({ row: forwardRow, col: col });
      }
    }
    
    // 如果已经过河，可以横向移动
    if (hasCrossedRiver(row, color)) {
      // 向左移动
      const leftCol = col - 1;
      if (isInBoard(row, leftCol)) {
        const targetPiece = board[row][leftCol];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: row, col: leftCol });
        }
      }
      
      // 向右移动
      const rightCol = col + 1;
      if (isInBoard(row, rightCol)) {
        const targetPiece = board[row][rightCol];
        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: row, col: rightCol });
        }
      }
    }
  }
  
  return moves;
}

/**
 * 获取棋子的合法移动位置
 */
function getValidMoves(piece, board) {
  if (!piece) return [];
  
  switch (piece.type) {
    case 'general':
      return getGeneralMoves(piece, board);
    case 'advisor':
      return getAdvisorMoves(piece, board);
    case 'elephant':
      return getElephantMoves(piece, board);
    case 'horse':
      return getHorseMoves(piece, board);
    case 'chariot':
      return getChariotMoves(piece, board);
    case 'cannon':
      return getCannonMoves(piece, board);
    case 'soldier':
      return getSoldierMoves(piece, board);
    default:
      return [];
  }
}

/**
 * 验证移动是否合法
 */
function isValidMove(fromRow, fromCol, toRow, toCol, playerColor, board) {
  // 检查起始位置是否有棋子
  const piece = board[fromRow][fromCol];
  if (!piece) {
    return false;
  }
  
  // 检查是否是当前玩家的棋子
  if (piece.color !== playerColor) {
    return false;
  }
  
  // 获取该棋子的所有合法移动位置
  const validMoves = getValidMoves(piece, board);
  
  // 检查目标位置是否在合法移动位置中
  return validMoves.some(move => move.row === toRow && move.col === toCol);
}

/**
 * 检查是否将军
 */
function isCheck(color, board) {
  // 找到当前玩家的帅/将
  let generalPos = null;
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'general' && piece.color === color) {
        generalPos = { row, col };
        break;
      }
    }
    if (generalPos) break;
  }
  
  if (!generalPos) return false;
  
  // 检查对方是否有棋子可以攻击到帅/将
  const opponentColor = color === 'red' ? 'black' : 'red';
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.color === opponentColor) {
        const validMoves = getValidMoves(piece, board);
        if (validMoves.some(move => move.row === generalPos.row && move.col === generalPos.col)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 检查是否将死
 */
function isCheckmate(color, board) {
  // 如果没有被将军，就不是将死
  if (!isCheck(color, board)) {
    return false;
  }
  
  // 检查当前玩家是否还有任何合法的移动可以解除将军
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const validMoves = getValidMoves(piece, board);
        for (const move of validMoves) {
          // 模拟移动
          const newBoard = JSON.parse(JSON.stringify(board));
          newBoard[move.row][move.col] = piece;
          newBoard[row][col] = null;
          
          // 检查移动后是否还被将军
          if (!isCheck(color, newBoard)) {
            // 如果有一步移动可以解除将军，就不是将死
            return false;
          }
        }
      }
    }
  }
  
  // 如果所有可能的移动都不能解除将军，就是将死
  return true;
}

module.exports = {
  getValidMoves,
  isValidMove,
  isCheck,
  isCheckmate,
  BOARD_ROWS,
  BOARD_COLS
};