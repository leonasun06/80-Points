// 创建一副牌
export function createDeck() {
    const suits = ['♠', '♥', '♣', '♦'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    // 添加普通牌
    for (let i = 0; i < 2; i++) { // 两副牌
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ suit, rank });
            }
        }
        // 添加大小王
        deck.push({ suit: 'JOKER', rank: 'JOKER' });  // 大王
        deck.push({ suit: 'joker', rank: 'joker' });  // 小王
    }

    return deck;
}

// 洗牌
export function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 比较两张牌
export function compareCards(card1, card2) {
    const rankOrder = {
        'JOKER': 17, 'joker': 16,
        'A': 14, 'K': 13, 'Q': 12, 'J': 11,
        '10': 10, '9': 9, '8': 8, '7': 7,
        '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
    };

    // 先比较点数
    const rankDiff = rankOrder[card1.rank] - rankOrder[card2.rank];
    if (rankDiff !== 0) return rankDiff;

    // 点数相同时比较花色
    const suitOrder = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
    return suitOrder[card1.suit] - suitOrder[card2.suit];
} 