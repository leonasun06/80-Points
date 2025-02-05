// 定义游戏常量
export const GAME_CONSTANTS = {
  PLAYERS_COUNT: 4,        // 4个玩家
  CARDS_PER_PLAYER: 25,    // 每人25张牌
  TARGET_SCORE: 80,        // 目标分数80分
  TEAMS: {                 // 两个队伍
    TEAM_A: [0, 2],       // 玩家0和2是一队
    TEAM_B: [1, 3]        // 玩家1和3是一队
  }
};

// 定义主牌等级
export const LEVEL_RANKS = {
  2: ['2'],
  3: ['2', '3'],
  4: ['2', '3', '4'],
  5: ['2', '3', '4', '5'],
  6: ['2', '3', '4', '5', '6'],
  7: ['2', '3', '4', '5', '6', '7'],
  8: ['2', '3', '4', '5', '6', '7', '8'],
  9: ['2', '3', '4', '5', '6', '7', '8', '9'],
  10: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
  J: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J'],
  Q: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'],
  K: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
  A: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'],
};

// 检查是否为有效的出牌
export const isValidPlay = (cards, currentLevel, trumpSuit) => {
  // 检查大小王
  const jokers = cards.filter(card => card.suit === '🃏');
  if (jokers.length === 1) {
    return false; // 大小王必须一起出
  }
  if (jokers.length === 2) {
    // 检查是否是一对大小王
    const hasRedJoker = jokers.some(card => card.rank === 'JOKER');
    const hasBlackJoker = jokers.some(card => card.rank === 'joker');
    return hasRedJoker && hasBlackJoker;
  }
  
  // 其他牌型检查逻辑...
  return true;
};

// 计算得分
export const calculateScore = (cards) => {
  let score = 0;
  cards.forEach(card => {
    if (card.rank === '5') score += 5;
    if (card.rank === '10') score += 10;
    if (card.rank === 'K') score += 10;
  });
  return score;
};

// 修改计算叫主强度的逻辑
export const calculateBidStrength = (cards, bidOrder) => {
  let baseStrength = 0;
  
  // 大小王的处理
  const jokers = cards.filter(card => card.suit === '🃏');
  if (jokers.length === 2) {
    // 一对大小王最大
    baseStrength = 20;
  }
  
  // 其他计算逻辑...
  const orderBonus = Math.max(0, 3 - bidOrder);
  return baseStrength + orderBonus;
}; 