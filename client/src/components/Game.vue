// 发送叫主请求前的数据处理
const sendBid = (cards, suit) => {
  // 确保大小王的格式正确
  const normalizeCard = (card) => {
    // 处理大小王
    if (card.suit === '🃏' || 
        card.suit === 'JOKER' || 
        card.suit === 'joker' ||
        card.rank === 'JOKER' ||
        card.rank === 'joker') {
      return {
        suit: '🃏',
        rank: card.rank === 'JOKER' || card.suit === 'JOKER' ? 'JOKER' : 'joker'
      };
    }
    return card;
  };

  const normalizedCards = cards.map(normalizeCard);
  console.log('发送叫主数据:', {
    original: cards,
    normalized: normalizedCards
  });

  socket.emit('bid', {
    gameId,
    bid: {
      cards: normalizedCards,
      suit,
      skip: false
    }
  });
};

// 检查是否可以叫主
const canBid = computed(() => {
  const selectedCards = Array.from(selectedCards.value).map(key => {
    // 处理大小王的特殊情况
    if (key.includes('JOKER')) {
      return { suit: '🃏', rank: 'JOKER' };
    }
    if (key.includes('joker')) {
      return { suit: '🃏', rank: 'joker' };
    }
    // 处理普通牌
    const [suit, rank] = key.split('-');
    return { suit, rank };
  });

  // 检查选中的牌数量
  if (selectedCards.length === 0 || selectedCards.length > 2) {
    return false;
  }

  // 检查大小王的情况
  const jokers = selectedCards.filter(card => 
    card.suit === '🃏' || 
    card.rank === 'JOKER' || 
    card.rank === 'joker'
  );

  // 如果有王牌，必须是一对大王或一对小王
  if (jokers.length > 0) {
    if (jokers.length !== 2) {
      return false; // 单张王不能叫主
    }
    // 检查是否是一对大王或一对小王
    const isAllBigJokers = jokers.every(card => card.rank === 'JOKER');
    const isAllSmallJokers = jokers.every(card => card.rank === 'joker');
    return isAllBigJokers || isAllSmallJokers;
  }

  // 检查当前等级的牌
  const currentLevelCards = selectedCards.filter(card => 
    card.rank === gameState.currentLevel.toString()
  );
  
  if (selectedCards.length === 2) {
    // 检查是否是一对同花色当前等级
    return currentLevelCards.length === 2 && selectedCards[0].suit === selectedCards[1].suit;
  }

  if (selectedCards.length === 1) {
    // 检查是否是单张当前等级
    return selectedCards[0].rank === gameState.currentLevel.toString();
  }

  return false;
});

// 添加计算属性来显示提示信息
const bidButtonTooltip = computed(() => {
  if (!selectedCards.value.size) {
    return '请选择要叫主的牌';
  }
  
  const cards = Array.from(selectedCards.value).map(key => {
    // 处理大小王的特殊情况
    if (key.includes('JOKER')) {
      return { suit: '🃏', rank: 'JOKER' };
    }
    if (key.includes('joker')) {
      return { suit: '🃏', rank: 'joker' };
    }
    // 处理普通牌
    const [suit, rank] = key.split('-');
    return { suit, rank };
  });

  if (cards.length > 2) {
    return '最多只能选择两张牌';
  }

  // 检查是否是单张王
  const jokers = cards.filter(card => 
    card.suit === '🃏' || 
    card.rank === 'JOKER' || 
    card.rank === 'joker'
  );
  if (jokers.length === 1) {
    return '单张王不能叫主';
  }

  // 根据不同情况返回不同提示
  if (cards.length === 2) {
    if (cards.every(card => card.rank === gameState.currentLevel.toString()) && 
        cards[0].suit === cards[1].suit) {
      return `可以叫主：一对同花色${gameState.currentLevel}`;
    }
    if (cards.every(card => card.rank === 'JOKER')) {
      return '可以叫主：一对大王';
    }
    if (cards.every(card => card.rank === 'joker')) {
      return '可以叫主：一对小王';
    }
    return `只能叫主：一对同花色${gameState.currentLevel}、一对大王或一对小王`;
  }

  if (cards.length === 1) {
    if (cards[0].rank === gameState.currentLevel.toString()) {
      return `可以叫主：单张${gameState.currentLevel}`;
    }
    return `单张只能叫主${gameState.currentLevel}`;
  }

  return '请选择有效的叫主牌型';
});

// 修改叫主按钮的模板
<button 
  @click="handleBid" 
  :disabled="!canBid"
  :class="{ 'disabled': !canBid }"
  :title="bidButtonTooltip"
>
  叫主
</button>

// 添加相关样式
<style scoped>
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #ccc;
}

button {
  position: relative;
}

button:disabled:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
}
</style> 