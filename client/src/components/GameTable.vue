<template>
  <div class="game-table">
    <div class="players">
      <!-- 南家（自己） -->
      <div class="player-0">
        <div class="hand-container">
          <div class="hand">
            <div 
              v-for="(card, index) in sortedPlayerHand" 
              :key="`${card.suit}${card.rank}-${index}`"
              class="card"
              :class="{ selected: isSelected(card, index) }"
              :data-suit="card.suit"
              :data-rank="card.rank"
              @click="() => $emit('select-card', card, index)"
            >
              <!-- 左上角 -->
              <div class="card-corner card-corner-top">
                <span class="card-rank">{{ card.rank }}</span>
                <span class="card-corner-suit">{{ card.suit }}</span>
              </div>

              <!-- 中央 -->
              <span class="card-content">
                {{ card.rank === 'JOKER' || card.rank === 'joker' ? 'JOKER' : card.suit }}
              </span>

              <!-- 右下角 -->
              <div class="card-corner card-corner-bottom">
                <span class="card-rank">{{ card.rank }}</span>
                <span class="card-corner-suit">{{ card.suit }}</span>
              </div>
            </div>
          </div>
          <button 
            class="play-button"
            @click="$emit('play')" 
            :disabled="!canPlay"
          >出牌</button>
        </div>
      </div>

      <!-- 东家 -->
      <div class="player-1">
        <div class="hand-container">
          <div class="hand">
            <div 
              v-for="n in (otherPlayers[1]?.handSize || 0)" 
              :key="n"
              class="card card-back"
            ></div>
          </div>
        </div>
      </div>

      <!-- 北家 -->
      <div class="player-2">
        <div class="hand-container">
          <div class="hand">
            <div 
              v-for="n in (otherPlayers[2]?.handSize || 0)" 
              :key="n"
              class="card card-back"
            ></div>
          </div>
        </div>
      </div>

      <!-- 西家 -->
      <div class="player-3">
        <div class="hand-container">
          <div class="hand">
            <div 
              v-for="n in (otherPlayers[3]?.handSize || 0)" 
              :key="n"
              class="card card-back"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前出牌区域 -->
    <div class="table-center">
      <div v-if="currentTrick.length" class="current-trick">
        <div 
          v-for="play in currentTrick" 
          :key="play.playerId"
          class="played-cards"
        >
          <div 
            v-for="(card, index) in play.cards" 
            :key="cardKey(card, index)"
            class="card"
            :data-suit="card.suit"
            :data-rank="card.rank"
          >
            <!-- 左上角 -->
            <div class="card-corner card-corner-top">
              <span class="card-rank">{{ card.rank }}</span>
              <span class="card-corner-suit">{{ card.suit }}</span>
            </div>

            <!-- 中央 -->
            <span class="card-content">
              {{ card.rank === 'JOKER' || card.rank === 'joker' ? 'JOKER' : card.suit }}
            </span>

            <!-- 右下角 -->
            <div class="card-corner card-corner-bottom">
              <span class="card-rank">{{ card.rank }}</span>
              <span class="card-corner-suit">{{ card.suit }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 埋牌界面移到底部 -->
    <div v-if="showBuryingUI" class="burying-ui-bottom">
      <h3>请选择8张牌埋底</h3>
      <div class="countdown">
        剩余时间: {{ formatCountdown }}秒
      </div>
      <button 
        class="bury-button"
        @click="buryCards"
        :disabled="selectedCards.size !== 8"
      >
        埋牌
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  gameState: Object,
  playerId: String,
  selectedCards: Set,
  canPlay: Boolean,
  countdown: Number
});

const emit = defineEmits(['select-card', 'play', 'bury-cards']);

const sortedPlayerHand = computed(() => {
  if (!props.gameState?.players) return [];
  
  const currentPlayer = props.gameState.players.find(p => p.id === props.playerId);
  if (!currentPlayer?.hand) return [];

  const currentLevel = props.gameState.currentLevel?.toString();
  const trumpSuit = props.gameState.trumpSuit;

  console.log('开始排序手牌:', {
    currentLevel,
    trumpSuit,
    hand: currentPlayer.hand
  });

  return [...currentPlayer.hand].sort((a, b) => {
    // 添加调试日志
    console.log('比较:', {
      a: { suit: a.suit, rank: a.rank },
      b: { suit: b.suit, rank: b.rank },
      isJoker: a.suit === '🃏' || b.suit === '🃏'
    });

    // 首先处理大小王（最左边）
    const isAJoker = a.suit === '🃏' || a.rank === 'JOKER' || a.rank === 'joker';
    const isBJoker = b.suit === '🃏' || b.rank === 'JOKER' || b.rank === 'joker';
    
    if (isAJoker || isBJoker) {
      if (isAJoker && isBJoker) {
        // 大王在小王左边
        const result = a.rank === 'JOKER' ? -1 : 1;
        console.log('大小王比较结果:', result);
        return result;
      }
      // 王牌排在最左边
      const result = isAJoker ? -1 : 1;
      console.log('王牌与普通牌比较结果:', result);
      return result;
    }

    // 然后处理主牌等级
    const isATrumpLevel = a.rank === currentLevel;
    const isBTrumpLevel = b.rank === currentLevel;
    if (isATrumpLevel !== isBTrumpLevel) {
      return isBTrumpLevel ? 1 : -1;
    }

    // 处理主牌花色
    const isATrumpSuit = a.suit === trumpSuit;
    const isBTrumpSuit = b.suit === trumpSuit;
    if (isATrumpSuit !== isBTrumpSuit) {
      // 修改这里：主牌花色应该排在非主牌花色左边
      return isBTrumpSuit ? 1 : -1;
    }

    // 按照花色排序：黑桃 > 红桃 > 梅花 > 方片
    const suitOrder = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
    if (a.suit !== b.suit) {
      return suitOrder[b.suit] - suitOrder[a.suit];
    }

    // 同花色按点数排序
    const rankOrder = {
      'JOKER': -2,  // 大王最左
      'joker': -1,  // 小王次左
      'A': 14, 'K': 13, 'Q': 12, 'J': 11,
      '10': 10, '9': 9, '8': 8, '7': 7,
      '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
    };

    // 如果是主牌花色，调整主牌等级的顺序
    if (isATrumpSuit && currentLevel) {
      rankOrder[currentLevel] = -3;  // 主牌等级比大小王还要靠左
    }

    return rankOrder[b.rank] - rankOrder[a.rank];
  });
});

const otherPlayers = computed(() => {
  if (!props.gameState?.players) return [];
  const players = props.gameState.players;
  const playerIndex = players.findIndex(p => p.id === props.playerId);
  const result = [];
  for (let i = 0; i < 4; i++) {
    result[i] = players[(playerIndex + i) % 4];
  }
  return result;
});

const currentTrick = computed(() => {
  return props.gameState?.currentTrick || [];
});

function cardKey(card, index) {
  return `${card.suit}${card.rank}-${index}`;
}

function isSelected(card, index) {
  return props.selectedCards.has(`${card.suit}${card.rank}-${index}`);
}

function toggleCard(card) {
  emit('select-card', card);
}

// 是否显示埋牌界面
const showBuryingUI = computed(() => {
  console.log('检查是否显示埋牌界面:', {
    gamePhase: props.gameState?.gamePhase,
    dealer: props.gameState?.dealer,
    playerId: props.playerId,
    isDealer: props.gameState?.dealer === props.playerId
  });
  return props.gameState?.gamePhase === 'BURYING' && 
         props.gameState?.dealer === props.playerId;
});

// 修改倒计时显示
const formatCountdown = computed(() => {
  return props.countdown?.toString() || '0';
});

// 修改埋牌方法，添加错误处理
const buryCards = () => {
  console.log('尝试埋牌:', {
    selectedCardsSize: props.selectedCards.size,
    selectedCards: Array.from(props.selectedCards)
  });

  if (props.selectedCards.size !== 8) {
    alert('请选择8张牌');
    return;
  }
  
  const cards = Array.from(props.selectedCards).map(key => {
    const [suitRank] = key.split('-');
    if (suitRank === 'JOKER' || suitRank === 'joker') {
      return { suit: '🃏', rank: suitRank };
    }
    const suit = suitRank[0];
    const rank = suitRank.slice(1);
    return { suit, rank };
  });

  console.log('准备发送埋牌数据:', cards);
  emit('bury-cards', cards);
};
</script>

<style scoped>
.game-table {
  flex: 1;
  position: relative;
  background: #076324;
  border-radius: 0;
  padding: 20px 200px;
  min-height: 700px;
  margin: 0 100px;
  overflow: hidden;
}

.players {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px;
}

.player-0 {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
}

.player-0 .hand {
  justify-content: center;
}

.player-0 .card {
  margin-right: -40px;
}

.player-1 {
  position: absolute;
  right: -500px;
  top: 50%;
  transform: translateY(-50%) rotate(180deg);
  transform-origin: left center;
  width: 400px;
}

.player-1 .hand, .player-3 .hand {
  flex-direction: column;
  gap: -80px;
}

.player-1 .card, .player-3 .card {
  margin-right: 0;
  margin-bottom: -80px;
}

.player-1 .card:last-child, .player-3 .card:last-child {
  margin-bottom: 0;
}

.player-2 {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) rotate(180deg);
  width: 800px;
}

.player-2 .hand {
  justify-content: center;
}

.player-2 .card {
  margin-right: -40px;
}

.player-3 {
  position: absolute;
  left: -500px;
  top: 50%;
  transform: translateY(-50%) rotate(180deg);
  transform-origin: right center;
  width: 400px;
}

.hand-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.hand {
  display: flex;
  gap: -30px;
  flex-wrap: nowrap;
  justify-content: center;
}

.card {
  position: relative;
  width: 60px;
  height: 84px;
  margin: 5px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background-color: white;
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.card.selected {
  transform: translateY(-10px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.card[data-suit="♥"],
.card[data-suit="♦"] {
  color: red;
}

.card[data-suit="♠"],
.card[data-suit="♣"] {
  color: black;
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  line-height: 1;
}

.card-corner-top {
  top: 5px;
  left: 5px;
}

.card-corner-bottom {
  bottom: 5px;
  right: 5px;
  transform: rotate(180deg);
}

.card-rank {
  font-weight: bold;
}

.card-corner-suit {
  font-size: 14px;
}

.card-content {
  font-size: 24px;
}

.card-back {
  background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 50%, #931515 100%);
  color: transparent;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.play-button {
  padding: 5px 15px;
  font-size: 14px;
  margin-top: 10px;
}

.table-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.current-trick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 20px;
  width: 100%;
  height: 100%;
}

.played-cards {
  display: flex;
  justify-content: center;
  align-items: center;
}

.played-cards .card {
  margin-right: -20px;
  transform: scale(0.8);
}

.burying-ui-bottom {
  position: absolute;
  bottom: 220px;  /* 增加与底部的距离，避免遮挡手牌 */
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 30px;
  border-radius: 10px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 20px;
  z-index: 100;
}

.burying-ui-bottom h3 {
  margin: 0;
  font-size: 16px;
}

.burying-ui-bottom .countdown {
  margin: 0;
  font-size: 20px;
  font-weight: bold;
}

.bury-button {
  padding: 10px 20px;
  font-size: 18px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  min-width: 100px;
}

.bury-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style> 