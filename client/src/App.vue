<template>
 <div class="app">
   <h1>升级游戏</h1>
   
   <div class="debug-info" style="margin: 10px; padding: 10px; background: #f5f5f5;">
     <h4>调试信息:</h4>
     <p>Socket连接状态: {{ debug.socketConnected ? '已连接' : '未连接' }}</p>
     <p>玩家ID: {{ playerId }}</p>
     <p>游戏ID: {{ gameId }}</p>
     <p>游戏状态: {{ gameState ? '已创建' : '未创建' }}</p>
     <p>游戏阶段: {{ gameState?.gamePhase || '-' }}</p>
     <p>当前玩家: {{ gameState?.currentPlayer || '-' }}</p>
     <p>是否可以叫主: {{ canBid }}</p>
   </div>
   
   <div class="error" v-if="error" v-text="error"></div>
   <div class="success" v-if="success" v-text="success"></div>
   
   <div class="actions" v-if="!gameState">
     <button @click="createGame">创建游戏</button>
     <button @click="joinGame">加入游戏</button>
     <button @click="spectateGame">观战</button>
   </div>

   <div class="game-info" v-if="gameId">
     <p>游戏ID: {{ gameId }}</p>
     <p>玩家ID: {{ playerId }}</p>
     <p>状态: {{ gameState?.gamePhase || '等待开始' }}</p>
     <p>当前玩家数: {{ gameState?.players?.length || 1 }}/4</p>
     <p>当前级别: {{ gameState?.currentLevel || '2' }}</p>
     <p>主牌: {{ gameState?.trumpSuit || '-' }}</p>
     <p>分数: {{ gameState?.scores ? gameState.scores.join(' : ') : '0 : 0' }}</p>
     <p v-if="gameState?.currentPlayer" class="current-turn" :class="{ 'is-your-turn': gameState.currentPlayer === playerId }">
       {{ gameState.currentPlayer === playerId ? '轮到你了！' : '等待其他玩家...' }}
     </p>
   </div>

   <div class="waiting-players" v-if="gameId && (!gameState || gameState?.players?.length < 4)">
     <h3>等待其他玩家加入...</h3>
     <p>游戏 ID: {{ gameId }}</p>
     <p>当前玩家数: {{ gameState?.players?.length || 1 }}/4</p>
     <p class="tip">将游戏 ID 分享给其他玩家以邀请他们加入</p>
   </div>

   <!-- 游戏桌面 -->
   <GameTable
     v-if="gameState && gameState.players?.length === 4"
     :gameState="gameState"
     :playerId="playerId"
     :selectedCards="selectedCards"
     :canPlay="canPlay"
     @select-card="toggleCard"
     @play="playCards"
     @bury-cards="buryCards"
   />

   <div class="actions" v-if="gameState">
     <button 
       @click="bid" 
       :disabled="!canBid"
       :class="{ 
         'active-button': canBid,
         'disabled-button': !canBid 
       }"
     >叫主(选牌后点击)</button>
     
     <!-- 添加不叫主按钮 -->
     <button 
       @click="skipBid" 
       :disabled="!canBid"
       :class="{ 
         'skip-button': canBid,
         'disabled-button': !canBid 
       }"
     >不叫主</button>
   </div>

   <!-- 新增叫主倒计时和选项界面 -->
   <div class="bidding-section" v-if="gameState?.gamePhase === 'BIDDING'">
     <div class="timer">剩余时间: {{ countdown }}秒</div>
   </div>

   <div class="players-info" v-if="gameState?.players">
     <h3>玩家信息：</h3>
     <div 
       v-for="player in gameState.players" 
       :key="player.id"
       class="player-info"
     >
       <div>ID: {{ player.id }}</div>
       <div>队伍: {{ player.team === 0 ? '南北' : '东西' }}</div>
       <div>手牌数: {{ player.handSize }}</div>
       <div>{{ player.isDealer ? '庄家' : '闲家' }}</div>
       <div v-if="player.id === playerId">（你）</div>
     </div>
   </div>
 </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';
import GameTable from './components/GameTable.vue';

const socket = io('http://localhost:3001', {
 transports: ['websocket', 'polling'],
 reconnection: true,
 reconnectionAttempts: 5,
 reconnectionDelay: 1000,
 timeout: 10000
});

const gameId = ref(null);
const playerId = ref(null);
const gameState = ref(null);
const selectedCards = ref(new Set());
const error = ref(null);
const success = ref(null);

// 叫主倒计时相关
const countdown = ref(50);
const timer = ref(null);

// 添加一个状态记录是否已叫主
const hasBid = ref(false);

// 添加排序函数
const sortCards = (cards, trumpSuit) => {
  const rankOrder = {
    'JOKER': -2,  // 大王最左
    'joker': -1,  // 小王次左
    'A': 14, 'K': 13, 'Q': 12, 'J': 11,
    '10': 10, '9': 9, '8': 8, '7': 7,
    '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };

  const suitOrder = {
    '♠': 4, '♥': 3, '♦': 2, '♣': 1
  };

  return [...cards].sort((a, b) => {
    // 大小王排最左边
    if (a.rank === 'JOKER' || a.rank === 'joker' || 
        b.rank === 'JOKER' || b.rank === 'joker') {
      return rankOrder[a.rank] - rankOrder[b.rank];  // 注意这里改成 a - b
    }
    // ... 其他排序逻辑
  });
}

// 修改 playerHand 计算属性
const playerHand = computed(() => {
  if (!gameState.value?.players) return [];
  const player = gameState.value.players.find(p => p.id === playerId.value);
  if (!player?.hand) return [];
  
  // 使用排序函数对手牌进行排序
  return sortCards(player.hand, gameState.value.trumpSuit);
});

// 添加一个函数来检查选中的牌是否有效
function isValidBidCards() {
  const cards = Array.from(selectedCards.value).map(key => {
    const [suitRank] = key.split('-');
    if (suitRank === 'JOKER' || suitRank === 'joker') {
      return { suit: suitRank, rank: suitRank };
    }
    const suit = suitRank[0];
    const rank = suitRank.slice(1);
    return { suit, rank };
  });

  // 如果没有选牌，返回 false
  if (cards.length === 0) return false;

  // 检查是否选择了大小王
  const isJoker = cards.some(card => card.rank === 'JOKER' || card.rank === 'joker');
  
  if (isJoker) {
    // 如果选了大小王，必须是两张相同的
    if (cards.length !== 2) return false;
    return cards[0].rank === cards[1].rank;  // 必须是两张大王或两张小王
  }

  // 其他普通牌可以随意选择
  return true;
}

// 修改 canBid 计算属性
const canBid = computed(() => {
  return gameState.value?.gamePhase === 'BIDDING' && 
         !hasBid.value && 
         isValidBidCards();  // 添加牌型验证
});

// Fix timer by adding it to gameStarted event
socket.on('gameStarted', (state) => {
  console.log('Game started:', state);
  gameState.value = state;
  showSuccess('游戏开始！');
  hasBid.value = false;  // 重置叫主状态
  if (state.gamePhase === 'BIDDING') {
    startTimer();
  }
});

const canPlay = computed(() => {
  return gameState.value?.gamePhase === 'PLAYING' && 
         gameState.value?.currentPlayer === playerId.value;
});

function showError(message) {
 error.value = message;
 setTimeout(() => error.value = null, 3000);
}

function showSuccess(message) {
 success.value = message;
 setTimeout(() => success.value = null, 3000);
}

function cardKey(card, index) {
 return `${card.suit}${card.rank}-${index}`;
}

function isCardSelected(card, index) {
 return selectedCards.value.has(cardKey(card, index));
}

// 修改 toggleCard 函数，在每次选牌后重新计算 canBid
function toggleCard(card, index) {
  const key = cardKey(card, index);
  console.log('切换卡牌:', { card, key });
  console.log('当前已选卡牌:', Array.from(selectedCards.value));
  
  if (selectedCards.value.has(key)) {
    selectedCards.value.delete(key);
  } else {
    selectedCards.value.add(key);
  }
  
  // 检查是否选择了单张大小王
  const cards = Array.from(selectedCards.value).map(key => {
    const [suitRank] = key.split('-');
    return suitRank;
  });
  
  const jokerCount = cards.filter(card => card === 'JOKER' || card === 'joker').length;
  if (jokerCount === 1) {
    showError('大小王必须选择两张相同的');
  }
  
  console.log('切换后卡牌:', Array.from(selectedCards.value));
}

function createGame() {
 socket.emit('createGame', {
   options: {
     startLevel: 2,
     timeLimit: 0
   }
 });
}

function joinGame() {
 const id = prompt('请输入游戏ID:');
 if (id) {
   socket.emit('joinGame', { gameId: id });
 }
}

function spectateGame() {
 const id = prompt('请输入要观战的游戏ID:');
 if (id) {
   socket.emit('spectateGame', { gameId: id });
 }
}

// 叫主倒计时相关函数
function startTimer() {
  if (timer.value) {
    clearInterval(timer.value);
  }
  countdown.value = 50;
  timer.value = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer.value);
      timer.value = null;
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (gameState.value?.gamePhase !== 'BIDDING') {
    return; // 如果不在叫主阶段，直接返回
  }
  socket.emit('bid', {
    gameId: gameId.value,
    bid: {
      suit: '♦',
      cards: []
    }
  });
  selectedCards.value.clear();
}

// 修改 bid 函数
function bid() {
  if (!gameId.value) {
    showError('请先加入游戏');
    return;
  }
  if (gameState.value?.gamePhase !== 'BIDDING') {
    showError('现在不是叫主阶段');
    return;
  }
  if (hasBid.value) {
    showError('您已经叫过主了');
    return;
  }
  
  // 检查是否选择了牌
  if (selectedCards.value.size === 0) {
    showError('请先选择要用来叫主的牌');
    return;
  }
  
  console.log('叫主前的selectedCards:', {
    raw: selectedCards.value,
    asArray: Array.from(selectedCards.value)
  });
  
  const cards = Array.from(selectedCards.value).map(key => {
    console.log('处理key:', key);
    // 特殊处理大小王
    if (key.startsWith('JOKER-') || key.startsWith('joker-')) {
      const [rank] = key.split('-');
      return { suit: rank, rank };  // 大小王的 suit 和 rank 都是 JOKER/joker
    }
    
    const [suitRank] = key.split('-');  // 分割掉索引
    console.log('分割后的suitRank:', suitRank);
    const suit = suitRank[0];           // 取第一个字符作为花色
    const rank = suitRank.slice(1);     // 剩下的是点数
    console.log('解析结果:', { suit, rank });
    return { suit, rank };
  });

  console.log('转换后准备发送的cards:', cards);
  
  if (cards.length === 0) {
    showError('转换卡牌数据失败');
    return;
  }
  
  const suit = cards[0].suit;
  
  const bidData = { suit, cards };
  console.log('发送的叫主数据:', bidData);
  
  socket.emit('bid', {
    gameId: gameId.value,
    bid: bidData
  });

  selectedCards.value.clear();
  hasBid.value = true;
}

// 修改 skipBid 函数
function skipBid() {
  if (!gameId.value) {
    showError('请先加入游戏');
    return;
  }
  if (gameState.value?.gamePhase !== 'BIDDING') {
    showError('现在不是叫主阶段');
    return;
  }
  if (hasBid.value) {
    showError('您已经叫过主了');
    return;
  }

  // 只在第一次叫主时启动计时器
  if (!timer.value) {
    startTimer();
  }

  socket.emit('bid', {
    gameId: gameId.value,
    bid: {
      suit: '♦',
      cards: [],
      skip: true
    }
  });

  selectedCards.value.clear();
  hasBid.value = true;  // 标记已叫主
}

function playCards() {
  if (!canPlay.value) {
    console.log('不能出牌:', {
      gamePhase: gameState.value?.gamePhase,
      currentPlayer: gameState.value?.currentPlayer,
      playerId: playerId.value
    });
    showError('还没轮到你出牌');
    return;
  }

  if (selectedCards.value.size === 0) {
    showError('请先选择要出的牌');
    return;
  }

  const cards = Array.from(selectedCards.value).map(key => {
    const [suitRank] = key.split('-');
    const suit = suitRank[0];
    const rank = suitRank.slice(1);
    return { suit, rank };
  });

  socket.emit('playCards', {
    gameId: gameId.value,
    cards
  });

  selectedCards.value.clear();
}

// 修改 buryCards 方法
const buryCards = (cards) => {
  console.log('App.vue 收到埋牌请求:', {
    gameId: gameId.value,
    playerId: playerId.value,
    cards
  });
  
  if (!gameId.value || !playerId.value) {
    showError('游戏状态异常');
    return;
  }

  if (gameState.value?.gamePhase !== 'BURYING') {
    showError('现在不是埋牌阶段');
    return;
  }

  if (playerId.value !== gameState.value?.dealer) {
    showError('只有庄家可以埋牌');
    return;
  }

  socket.emit('bury-cards', {
    gameId: gameId.value,
    playerId: playerId.value,
    cards
  });
};

onMounted(() => {
  // ... 其他事件监听 ...

  // 修改埋牌结果的监听
  socket.on('buryCardsResult', ({ result }) => {
    console.log('收到埋牌结果:', result);
    if (result.success) {
      selectedCards.value.clear();
      showSuccess('埋牌成功');
    } else {
      showError(result.error || '埋牌失败');
    }
  });

  // 修改游戏状态更新的监听
  socket.on('gameState', (state) => {
    console.log('收到游戏状态更新:', {
      phase: state.gamePhase,
      dealer: state.dealer,
      buryingDeadline: state.buryingDeadline,
      currentTime: Date.now(),
      remaining: state.buryingDeadline ? Math.floor((state.buryingDeadline - Date.now()) / 1000) : null
    });
    
    // 如果进入埋牌阶段，清空已选择的牌
    if (state.gamePhase === 'BURYING' && gameState.value?.gamePhase !== 'BURYING') {
      selectedCards.value.clear();
    }
    
    gameState.value = state;
  });
});

onUnmounted(() => {
 if (timer.value) {
   clearInterval(timer.value);
   timer.value = null;
 }
});

// Socket.io event handlers
socket.on('connect', () => {
 console.log('Socket connected:', socket.id);
 playerId.value = socket.id;
 showSuccess('连接成功');
});

socket.on('gameCreated', (data) => {
 console.log('Game created:', data);
 gameId.value = data.gameId;
 showSuccess('游戏创建成功，ID: ' + data.gameId);
});

socket.on('gameJoined', (data) => {
 console.log('Game joined:', data);
 gameId.value = data.gameId;
 showSuccess('成功加入游戏');
});

socket.on('bidUpdate', (data) => {
  console.log('收到叫主更新:', data);
  if (data.error) {
    showError(data.error.message);
    return;
  }

  // 如果游戏阶段改变，重置所有状态
  if (data.gameState.gamePhase !== gameState.value?.gamePhase) {
    clearInterval(timer.value);
    timer.value = null;
    selectedCards.value.clear();
    countdown.value = 50;
    hasBid.value = false;  // 重置叫主状态
  }

  gameState.value = data.gameState;
  showSuccess('叫主成功');
});

socket.on('playUpdate', (data) => {
  console.log('收到出牌更新:', data);
  if (data.error) {
    showError(data.error.message);
    return;
  }
  gameState.value = data.gameState;
});

socket.on('error', (err) => {
 console.error('Game error:', err);
 showError(err.message);
});

// 调试信息显示
const debug = ref({
 socketConnected: false,
 lastEvent: null,
 lastError: null
});

socket.on('connect', () => {
 debug.value.socketConnected = true;
});

socket.on('disconnect', () => {
 debug.value.socketConnected = false;
});

socket.on('reconnect_attempt', (attemptNumber) => {
 console.log('尝试重新连接:', attemptNumber);
});

socket.on('reconnect', () => {
 console.log('重新连接成功');
 showSuccess('重新连接成功');
});

socket.on('reconnect_error', (error) => {
 console.error('重连失败:', error);
 showError('重连失败: ' + error.message);
});
</script>

<style scoped>
.app {
 max-width: 1600px;
 margin: 0 auto;
 padding: 20px;
 display: flex;
 flex-direction: column;
 min-height: 100vh;
}

.error {
 color: red;
 margin: 10px 0;
 padding: 10px;
 border: 1px solid red;
}

.success {
 color: green;
 margin: 10px 0;
 padding: 10px;
 border: 1px solid green;
}

.game-info {
 margin: 20px 0;
 padding: 10px;
 border: 1px solid #ccc;
}

.actions {
 margin: 20px 0;
}

button {
 margin: 5px;
 padding: 10px;
}

.timer {
 font-size: 24px;
 color: red;
 margin: 10px;
}

.player-info {
 display: inline-block;
 margin: 10px;
 padding: 10px;
 border: 1px solid #ddd;
 min-width: 150px;
}

.waiting-players {
 text-align: center;
 margin: 20px 0;
 padding: 20px;
 background: #f9f9f9;
 border: 1px solid #ddd;
 border-radius: 4px;
}

.waiting-players .tip {
 color: #666;
 font-style: italic;
 margin-top: 10px;
}

.current-turn {
 font-weight: bold;
 padding: 10px;
 border-radius: 4px;
 margin-top: 10px;
 text-align: center;
}

.is-your-turn {
 background-color: #4CAF50;
 color: white;
 animation: pulse 1.5s infinite;
}

.active-button {
 background-color: #4CAF50;
 color: white;
 cursor: pointer;
}

.disabled-button {
 background-color: #cccccc;
 cursor: not-allowed;
}

.skip-button {
  background-color: #ff9800;  /* 橙色 */
  color: white;
  cursor: pointer;
}

.skip-button:hover {
  background-color: #f57c00;
}

@keyframes pulse {
 0% {
   transform: scale(1);
 }
 50% {
   transform: scale(1.05);
 }
 100% {
   transform: scale(1);
 }
}
</style>