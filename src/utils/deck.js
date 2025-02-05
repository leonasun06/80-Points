// 创建扑克牌花色和点数
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const JOKERS = ['JOKER', 'joker'];  // 大小王

// 创建两副扑克牌
export const createDeck = () => {
  const deck = [];
  // 创建两副牌
  for (let i = 0; i < 2; i++) {
    // 添加普通牌
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
    // 修改大小王的创建方式
    deck.push({ suit: '🃏', rank: 'JOKER' });  // 大王
    deck.push({ suit: '🃏', rank: 'joker' });  // 小王
  }
  return deck;  // 返回 108 张牌
};

// 洗牌函数
export const shuffleDeck = (deck) => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// 牌的大小顺序
export const RANK_ORDER = {
  'JOKER': -2,  // 大王最左
  'joker': -1,  // 小王次左
  'A': 14,
  'K': 13,
  'Q': 12,
  'J': 11,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2
};

// 花色顺序
export const SUIT_ORDER = {
  '♥': 4,    // 红桃最大
  '♠': 3,    // 黑桃次之
  '♦': 2,    // 方片第三
  '♣': 1,    // 梅花最小
  '🃏': 5    // 王牌仍然最大
};

// 排序函数
export const compareCards = (a, b) => {
  // 如果都是王牌
  if (a.suit === '🃏' && b.suit === '🃏') {
    // 大王 > 小王
    if (a.rank === 'JOKER' && b.rank === 'joker') return -1;
    if (a.rank === 'joker' && b.rank === 'JOKER') return 1;
    return 0; // 相同的王
  }
  
  // 王牌比其他牌大
  if (a.suit === '🃏') return -1;
  if (b.suit === '🃏') return 1;
  
  // 先比较花色
  if (SUIT_ORDER[a.suit] !== SUIT_ORDER[b.suit]) {
    return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
  }
  // 花色相同比较点数
  return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
}; 