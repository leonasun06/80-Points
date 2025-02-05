import { createDeck, shuffleDeck, compareCards } from '../utils/deck.js';

class Game {
  constructor(players, options = {}) {
    this.players = players;          // Map 对象，存储玩家信息
    this.currentPlayer = 0;          // 当前玩家索引
    this.currentLevel = options.startLevel || 2;           // 当前等级
    this.trumpSuit = null;           // 主牌花色
    this.scores = [0, 0];            // 队伍得分 [A队(南北), B队(东西)]
    this.currentTrick = [];          // 当前一轮的出牌
    this.lastValidPlay = null;       // 上一个有效的出牌
    this.bottomCards = [];           // 底牌
    this.dealer = null;              // 庄家
    this.gamePhase = 'BIDDING';      // 游戏阶段：叫主阶段(BIDDING)、出牌阶段(PLAYING)
    this.bids = [];                  // 记录叫主情况
    this.gameStartTime = Date.now();
    this.roundNumber = 1;
    this.roundHistory = [];
    this.spectators = new Set();  // 观战者列表
    this.isPaused = false;        // 游戏是否暂停
    this.pauseReason = null;      // 暂停原因
    this.errors = [];             // 错误记录
    this.gameOptions = {          // 游戏配置选项
      allowSpectators: options.allowSpectators ?? true,
      autoRestart: options.autoRestart ?? false,
      maxScore: options.maxScore ?? 200,      // 单局最高分限制
      timeLimit: options.timeLimit ?? 0,       // 每局时间限制（秒），0表示无限制
      ...options
    };
    this.initializeGame();
  }

  initializeGame() {
    const deck = shuffleDeck(createDeck());
    const hands = [
      deck.slice(0, 25).sort(compareCards),
      deck.slice(25, 50).sort(compareCards),
      deck.slice(50, 75).sort(compareCards),
      deck.slice(75, 100).sort(compareCards)
    ];
    this.bottomCards = deck.slice(100, 108);

    const playerIds = Array.from(this.players.keys());
    playerIds.forEach((playerId, index) => {
      const player = this.players.get(playerId);
      player.hand = hands[index];
      player.canBid = true;  // Allow all players to bid initially
    });

    // Remove currentPlayer since all players can bid simultaneously
    this.currentPlayer = null;
  }

  // 叫主
  bid(playerId, bid) {
    if (this.gamePhase !== 'BIDDING') {
      throw new Error('不在叫主阶段');
    }

    // 修改卡牌数据规范化处理函数
    const normalizeCard = (card) => {
      // 处理从客户端传来的可能被错误解析的大小王
      if (typeof card === 'string') {
        if (card.includes('JOKER')) {
          return { suit: '🃏', rank: 'JOKER' };
        }
        if (card.includes('joker')) {
          return { suit: '🃏', rank: 'joker' };
        }
        // 处理普通牌的情况
        const [suit, rank] = card.split('-');
        return { suit, rank };
      }

      // 处理大小王的各种可能格式
      if (card.suit === 'J' && card.rank === 'OKERJOKER') {
        return { suit: '🃏', rank: 'JOKER' };
      }
      if (card.suit === 'j' && card.rank === 'okerjoker') {
        return { suit: '🃏', rank: 'joker' };
      }
      if (card.suit === 'JOKER' || card.rank === 'JOKER') {
        return { suit: '🃏', rank: 'JOKER' };
      }
      if (card.suit === 'joker' || card.rank === 'joker') {
        return { suit: '🃏', rank: 'joker' };
      }

      // 如果是正常格式，直接返回
      if (card.suit === '🃏' && (card.rank === 'JOKER' || card.rank === 'joker')) {
        return card;
      }

      return card;
    };

    // 规范化花色
    const normalizeSuit = (suit) => {
      if (suit === 'J' || suit === 'JOKER') return '🃏';
      if (suit === 'j' || suit === 'joker') return '🃏';
      return suit;
    };

    const normalizedCards = bid.cards.map(normalizeCard);
    
    const bidInfo = {
      playerId,
      suit: normalizeSuit(bid.suit),
      cards: normalizedCards,
      strength: bid.skip ? -1 : this.calculateBidStrength(normalizedCards, this.bids.length),
      bidTime: Date.now(),
      skip: bid.skip || false
    };

    this.bids.push(bidInfo);

    // 检查是否所有玩家都已叫主
    if (this.bids.length === 4) {
      // 如果所有玩家都不叫，使用默认设置
      const allSkipped = this.bids.every(b => b.skip);
      if (allSkipped) {
        console.log('所有玩家都不叫主，使用默认设置');
        const defaultBid = {
          playerId: this.bids[0].playerId, // 第一个玩家做庄
          suit: '♦',  // 默认方块
          strength: 0,
          skip: true
        };
        this.bids.push(defaultBid);
      }

      const result = this.finishBidding();
      return {
        success: true,
        phase: 'PLAYING',
        ...result
      };
    }

    return {
      success: true,
      phase: 'BIDDING',
      bids: this.bids,
      currentBid: bidInfo
    };
  }

  // 计算叫主的强度
  calculateBidStrength(cards, bidOrder) {
    let baseStrength = 0;
    
    // 大小王的处理
    const jokers = cards.filter(card => 
      card.suit === '🃏' || 
      card.suit === 'JOKER' || 
      card.suit === 'joker' ||
      card.rank === 'JOKER' ||
      card.rank === 'joker' ||
      (card.suit === 'J' && card.rank === 'OKERJOKER') ||
      (card.suit === 'j' && card.rank === 'okerjoker')
    );

    // 处理2和王牌的情况
    if (jokers.length === 2) {
      // 处理一对王
      const isAllBigJokers = jokers.every(card => card.rank === 'JOKER');
      const isAllSmallJokers = jokers.every(card => card.rank === 'joker');
      
      if (isAllBigJokers) {
        baseStrength = 40; // 一对大王最大
      } else if (isAllSmallJokers) {
        baseStrength = 30; // 一对小王次之
      }
    } else if (cards.length === 2) {
      // 处理一对当前等级的牌
      const isCurrentLevel = cards.every(card => card.rank === this.currentLevel.toString());
      const isSameSuit = cards[0].suit === cards[1].suit;
      
      if (isCurrentLevel && isSameSuit) {
        baseStrength = 20; // 一对同花色当前等级
      }
    } else if (cards.length === 1) {
      // 处理单张当前等级的牌
      if (cards[0].rank === this.currentLevel.toString()) {
        baseStrength = 10; // 单只当前等级
      }
    }

    const orderBonus = Math.max(0, 3 - bidOrder);
    const finalStrength = baseStrength + orderBonus;

    // 始终输出计算叫主强度的日志
    console.log('计算叫主强度:', {
      currentLevel: this.currentLevel,
      baseStrength,
      orderBonus,
      finalStrength,
      jokerTypes: jokers.map(j => j.rank),
      cardTypes: cards.map(c => `${c.suit}${c.rank}`)
    });

    // 如果不是有效的叫主组合，返回-1
    if (baseStrength === 0) {
      return -1;
    }

    return finalStrength;
  }

  // 检查是否可以结束叫主
  canFinishBidding() {
    // 如果没有人叫主，继续叫主
    if (this.bids.length === 0) return false;

    // 获取最高叫主
    const maxBid = this.bids.reduce((max, bid) => 
      bid.strength > max.strength ? bid : max
    , this.bids[0]);

    // 如果有人叫出了两张大王或两张小王，直接结束
    if (maxBid.strength >= 60) return true;

    // 如果已经转了一圈（每个玩家都有机会叫主）
    const uniquePlayers = new Set(this.bids.map(bid => bid.playerId));
    if (uniquePlayers.size === 4) return true;

    // 如果最高叫主后没人加注，也可以结束
    const maxBidIndex = this.bids.findIndex(bid => bid.strength === maxBid.strength);
    return this.bids.length >= maxBidIndex + 4;
  }

  // 结束叫主阶段
  finishBidding() {
    // 找出最高叫主
    let highestBid = this.bids.reduce((highest, current) => {
      return (current.strength > highest.strength) ? current : highest;
    }, this.bids[0]);

    this.trumpSuit = highestBid.suit;
    this.dealer = highestBid.playerId;
    this.gamePhase = 'PLAYING';
    this.currentPlayer = this.dealer;

    console.log('叫主结束:', {
      trumpSuit: this.trumpSuit,
      dealer: this.dealer,
      gamePhase: this.gamePhase
    });

    return {
      trumpSuit: this.trumpSuit,
      dealer: this.dealer,
      gamePhase: this.gamePhase,
      currentPlayer: this.currentPlayer
    };
  }

  // 检查出牌是否合法
  isValidPlay(cards, playerId) {
    // 检查是否轮到该玩家
    if (playerId !== this.currentPlayer) {
      console.log('不是当前玩家的回合');
      return false;
    }

    const player = this.players.get(playerId);
    if (!player) {
      console.log('找不到玩家');
      return false;
    }

    // 检查玩家是否有这些牌
    if (!this.playerHasCards(player, cards)) {
      console.log('玩家没有这些牌');
      return false;
    }

    // 如果不是第一手，检查是否符合上一手牌的规则
    if (this.currentTrick.length > 0 && this.lastValidPlay) {
      return this.matchesLastPlay(cards);
    }

    return true;
  }

  // 检查玩家是否有这些牌
  playerHasCards(player, cards) {
    const handCards = new Set(player.hand.map(card => `${card.suit}${card.rank}`));
    return cards.every(card => handCards.has(`${card.suit}${card.rank}`));
  }

  // 获取牌型
  getCardPattern(cards) {
    if (!cards || cards.length === 0) return null;

    // 按点数分组
    const rankGroups = new Map();
    cards.forEach(card => {
      const count = rankGroups.get(card.rank) || 0;
      rankGroups.set(card.rank, count + 1);
    });

    // 单张
    if (cards.length === 1) {
      return { 
        type: 'single', 
        rank: cards[0].rank, 
        suit: cards[0].suit 
      };
    }

    // 对子
    if (cards.length === 2 && rankGroups.size === 1) {
      return { 
        type: 'pair', 
        rank: cards[0].rank,
        suits: cards.map(card => card.suit) 
      };
    }

    // 拖拉机（两对或以上相连的对子）
    if (cards.length >= 4 && this.isTractor(cards)) {
      return {
        type: 'tractor',
        rank: cards[0].rank,
        length: cards.length / 2  // 几对
      };
    }

    return null;
  }

  // 判断是否是拖拉机
  isTractor(cards) {
    // 必须是偶数张牌
    if (cards.length % 2 !== 0) return false;

    // 按点数分组并检查每组是否都是对子
    const rankGroups = new Map();
    cards.forEach(card => {
      const count = rankGroups.get(card.rank) || 0;
      rankGroups.set(card.rank, count + 1);
    });

    // 检查每个点数是否都是对子
    for (const count of rankGroups.values()) {
      if (count !== 2) return false;
    }

    // 检查点数是否连续
    const ranks = Array.from(rankGroups.keys());
    const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const rankIndices = ranks.map(rank => rankOrder.indexOf(rank)).sort((a, b) => a - b);

    // 检查是否连续
    for (let i = 1; i < rankIndices.length; i++) {
      if (rankIndices[i] - rankIndices[i - 1] !== 1) return false;
    }

    return true;
  }

  // 比较两手牌的大小
  comparePatterns(pattern1, pattern2) {
    if (pattern1.type !== pattern2.type) return false;

    switch (pattern1.type) {
      case 'single':
        return this.compareSingleCards(pattern1, pattern2);
      case 'pair':
        return this.comparePairs(pattern1, pattern2);
      case 'tractor':
        return this.compareTractors(pattern1, pattern2);
      default:
        return false;
    }
  }

  // 比较单张牌
  compareSingleCards(card1, card2) {
    // 如果有主牌，主牌大于副牌
    if (this.trumpSuit) {
      if (card1.suit === this.trumpSuit && card2.suit !== this.trumpSuit) return true;
      if (card1.suit !== this.trumpSuit && card2.suit === this.trumpSuit) return false;
    }
    return this.compareRanks(card1.rank, card2.rank);
  }

  // 比较点数
  compareRanks(rank1, rank2) {
    const rankOrder = {
      'JOKER': 17, 'joker': 16, 'A': 14, 'K': 13, 'Q': 12, 'J': 11,
      '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '2': 3, '3': 2
    };
    return rankOrder[rank1] > rankOrder[rank2];
  }

  // 比较对子
  comparePairs(pair1, pair2) {
    // 如果有主牌，主牌对子大于副牌对子
    if (this.trumpSuit) {
      const pair1HasTrump = pair1.suits.includes(this.trumpSuit);
      const pair2HasTrump = pair2.suits.includes(this.trumpSuit);
      if (pair1HasTrump && !pair2HasTrump) return true;
      if (!pair1HasTrump && pair2HasTrump) return false;
    }
    return this.compareRanks(pair1.rank, pair2.rank);
  }

  // 比较拖拉机
  compareTractors(tractor1, tractor2) {
    if (tractor1.length !== tractor2.length) return false;
    return this.compareRanks(tractor1.rank, tractor2.rank);
  }

  // 修改 matchesLastPlay 方法
  matchesLastPlay(cards) {
    if (!this.lastValidPlay) return true;

    const currentPattern = this.getCardPattern(cards);
    const lastPattern = this.getCardPattern(this.lastValidPlay);

    if (!currentPattern || !lastPattern) return false;
    if (currentPattern.type !== lastPattern.type) return false;
    if (currentPattern.length !== lastPattern.length) return false;

    return this.comparePatterns(currentPattern, lastPattern);
  }

  // 处理出牌
  playCards(playerId, cards) {
    // 验证是否是当前玩家的回合
    if (playerId !== this.currentPlayer) {
      throw new Error('不是当前玩家的回合');
    }

    // 验证出牌是否合法
    if (!this.isValidPlay(cards, playerId)) {
      throw new Error('出牌不合法');
    }

    // 记录这手牌
    this.currentTrick.push({
      playerId,
      cards
    });

    // 从玩家手中移除打出的牌
    const player = this.players.get(playerId);
    player.hand = player.hand.filter(card => 
      !cards.some(playedCard => 
        playedCard.suit === card.suit && playedCard.rank === card.rank
      )
    );

    // 更新当前玩家
    const playerIds = Array.from(this.players.keys());
    const currentIndex = playerIds.indexOf(playerId);
    if (currentIndex === -1) {
      console.error('找不到当前玩家:', playerId);
      throw new Error('找不到当前玩家');
    }

    // 确保下一个玩家索引有效
    const nextIndex = (currentIndex + 1) % playerIds.length;
    this.currentPlayer = playerIds[nextIndex];

    // 添加日志
    console.log('更新当前玩家:', {
      currentIndex,
      nextIndex,
      playerIds,
      newCurrentPlayer: this.currentPlayer
    });

    return {
      success: true,
      currentPlayer: this.currentPlayer,
      currentTrick: this.currentTrick,
      scores: this.scores
    };
  }

  // 判断是否是分牌
  isScoreCard(card) {
    return ['5', '10', 'K'].includes(card.rank);
  }

  // 获取牌的分数
  getCardScore(card) {
    if (card.rank === '5') return 5;
    if (card.rank === '10' || card.rank === 'K') return 10;
    return 0;
  }

  // 计算一组牌的总分
  calculateCardsScore(cards) {
    return cards.reduce((sum, card) => sum + this.getCardScore(card), 0);
  }

  // 获取抠底倍数
  getKoudiMultiplier(cards) {
    const pattern = this.getCardPattern(cards);
    if (!pattern) return 2; // 默认单张抠底

    switch (pattern.type) {
      case 'single':
        return 2;
      case 'pair':
        return 4;
      case 'tractor': {
        // 两连对6倍，每多1对加2倍
        const pairs = pattern.length;
        if (pairs >= 2) {
          return 6 + (pairs - 2) * 2;
        }
        return 4;
      }
      default:
        return 2;
    }
  }

  // 计算一轮的得分
  calculateTrickScore() {
    if (this.currentTrick.length !== 4) return;

    // 找出最大的牌
    let winningPlay = this.currentTrick[0];
    for (let i = 1; i < this.currentTrick.length; i++) {
      const currentPattern = this.getCardPattern(this.currentTrick[i].cards);
      const winningPattern = this.getCardPattern(winningPlay.cards);
      if (this.comparePatterns(currentPattern, winningPattern)) {
        winningPlay = this.currentTrick[i];
      }
    }

    // 计算这一轮的分数
    let roundScore = 0;
    this.currentTrick.forEach(play => {
      roundScore += this.calculateCardsScore(play.cards);
    });

    // 判断是否是最后一轮（通过检查所有玩家手牌是否为空）
    const isLastTrick = Array.from(this.players.values()).every(player => player.hand.length === 0);
    
    // 如果是最后一轮，需要计算底牌分数和抠底
    if (isLastTrick) {
      const bottomScore = this.calculateCardsScore(this.bottomCards);
      
      // 判断赢家是否是闲家
      const isWinnerNonDealer = winningPlay.playerId !== this.dealer;
      
      if (isWinnerNonDealer) {
        // 闲家赢得最后一轮，计算抠底
        const koudiMultiplier = this.getKoudiMultiplier(winningPlay.cards);
        roundScore += bottomScore * koudiMultiplier;
      } else {
        // 庄家赢得最后一轮，直接加上底牌分数
        roundScore += bottomScore;
      }
    }

    // 判断赢家所属队伍（0为南北队，1为东西队）
    const winningTeam = this.getPlayerTeam(winningPlay.playerId);
    this.scores[winningTeam] += roundScore;

    // 清空当前一轮
    this.currentTrick = [];
    this.lastValidPlay = null;

    // 如果是最后一轮，处理局结束逻辑
    if (isLastTrick) {
      this.handleRoundEnd();
    }
  }

  // 处理一局结束
  handleRoundEnd() {
    const nonDealerTeam = this.getPlayerTeam(this.dealer) === 0 ? 1 : 0;
    const nonDealerScore = this.scores[nonDealerTeam];
    const dealerTeam = this.getPlayerTeam(this.dealer);
    const dealerScore = this.scores[dealerTeam];

    // 记录本轮历史
    this.recordRoundHistory();

    // 更新轮数
    this.roundNumber = (this.roundNumber || 1) + 1;

    // 判断是否过庄
    const isPassDealer = this.checkPassDealer(nonDealerScore);

    if (isPassDealer) {
      // 庄家过庄，下一局由庄家对家坐庄
      this.dealer = (this.dealer + 2) % 4;
    } else {
      // 庄家未过庄，下一局由庄家下家坐庄
      this.dealer = (this.dealer + 1) % 4;
    }

    // 处理升级
    this.handleLevelUpgrade();
  }

  // 判断是否过庄
  checkPassDealer(nonDealerScore) {
    // 闲家得分小于等于35分时，庄家过庄
    return nonDealerScore <= 35;
  }

  // 处理一局结束后的升级
  handleLevelUpgrade() {
    const nonDealerTeam = this.getPlayerTeam(this.dealer) === 0 ? 1 : 0;
    const nonDealerScore = this.scores[nonDealerTeam];
    
    // 两副牌的升级规则
    if (nonDealerScore <= -40) {
      // 庄家升四级
      this.currentLevel += 4;
    } else if (nonDealerScore === 0) {
      // 庄家升三级（大光）
      this.currentLevel += 3;
    } else if (nonDealerScore <= 35) {
      // 庄家升两级（小光）
      this.currentLevel += 2;
    } else if (nonDealerScore <= 75) {
      // 庄家升一级
      this.currentLevel += 1;
    } else if (nonDealerScore <= 115) {
      // 闲家上台
      // 庄家已在 handleRoundEnd 中更新
    } else if (nonDealerScore <= 155) {
      // 闲家上台并升一级
      this.currentLevel += 1;
    } else if (nonDealerScore <= 195) {
      // 闲家上台并升两级
      this.currentLevel += 2;
    } else {
      // 闲家上台并升三级
      this.currentLevel += 3;
    }

    // 检查是否达到游戏结束条件（A）
    if (this.currentLevel > 14) {
      this.gamePhase = 'FINISHED';
      return;
    }

    // 重置游戏状态，准备下一局
    this.resetForNextRound();
  }

  // 重置游戏状态，准备下一局
  resetForNextRound() {
    this.scores = [0, 0];
    this.currentTrick = [];
    this.lastValidPlay = null;
    this.bottomCards = [];
    this.trumpSuit = null;
    this.gamePhase = 'BIDDING';
    this.bids = [];
    // 不重置 roundNumber 和 roundHistory
    this.initializeGame();
  }

  // 获取玩家所属队伍（0为南北队，1为东西队）
  getPlayerTeam(playerId) {
    const playerPosition = Array.from(this.players.keys()).indexOf(playerId);
    return playerPosition % 2;
  }

  // 获取游戏状态
  getGameState() {
    const gameState = {
      // 基本信息
      currentPlayer: this.currentPlayer,
      currentLevel: this.currentLevel,
      trumpSuit: this.trumpSuit,
      scores: this.scores,
      currentTrick: this.currentTrick,
      gamePhase: this.gamePhase,
      dealer: this.dealer,

      // 叫主阶段信息
      bids: this.bids,
      
      // 玩家信息
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        handSize: player.hand.length,
        team: this.getPlayerTeam(id),
        isDealer: id === this.dealer,
        hand: player.hand  // 注意：实际使用时可能需要隐藏其他玩家的手牌
      })),

      // 底牌信息
      bottomCardsSize: this.bottomCards.length,
      bottomCards: this.gamePhase === 'PLAYING' ? this.bottomCards : [], // 只在出牌阶段显示底牌

      // 游戏进度信息
      roundNumber: this.roundNumber || 1,
      roundHistory: this.roundHistory || [],
      
      // 如果游戏结束，包含结束统计
      ...(this.gamePhase === 'FINISHED' ? this.getGameEndStats() : {}),

      // 游戏配置信息
      options: this.gameOptions,
      
      // 游戏状态信息
      isPaused: this.isPaused,
      pauseReason: this.pauseReason,
      spectatorCount: this.spectators.size,
      
      // 时间信息
      elapsedTime: Date.now() - this.gameStartTime,
      remainingTime: this.gameOptions.timeLimit > 0 
        ? Math.max(0, this.gameOptions.timeLimit * 1000 - (Date.now() - this.gameStartTime))
        : null,
        
      // 错误信息
      lastError: this.errors[this.errors.length - 1],
      
      // 其他状态
      canContinue: this.canContinue()
    };

    return gameState;
  }

  // 获取游戏结束统计信息
  getGameEndStats() {
    return {
      finalLevel: this.currentLevel,
      winningTeam: this.currentLevel > 14 ? this.getPlayerTeam(this.dealer) : null,
      roundsPlayed: this.roundNumber,
      levelProgression: this.roundHistory.map(round => round.level),
      dealerProgression: this.roundHistory.map(round => round.dealer),
      scoreHistory: this.roundHistory.map(round => round.scores),
      totalDuration: Date.now() - (this.gameStartTime || Date.now())
    };
  }

  // 记录每轮历史
  recordRoundHistory() {
    if (!this.roundHistory) {
      this.roundHistory = [];
    }

    this.roundHistory.push({
      roundNumber: this.roundNumber || 1,
      dealer: this.dealer,
      level: this.currentLevel,
      scores: [...this.scores],
      trumpSuit: this.trumpSuit,
      timestamp: Date.now()
    });
  }

  // 添加错误处理方法
  handleError(error, context) {
    const errorInfo = {
      timestamp: Date.now(),
      message: error.message,
      context,
      stack: error.stack,
      gameState: {
        phase: this.gamePhase,
        currentPlayer: this.currentPlayer,
        roundNumber: this.roundNumber
      }
    };
    this.errors.push(errorInfo);
    console.error('Game Error:', errorInfo);
    return errorInfo;
  }

  // 添加观战者
  addSpectator(spectatorId) {
    if (!this.gameOptions.allowSpectators) {
      throw new Error('当前游戏不允许观战');
    }
    this.spectators.add(spectatorId);
  }

  // 移除观战者
  removeSpectator(spectatorId) {
    this.spectators.delete(spectatorId);
  }

  // 暂停游戏
  pauseGame(reason = '游戏暂停') {
    if (this.isPaused) {
      throw new Error('游戏已经处于暂停状态');
    }
    this.isPaused = true;
    this.pauseReason = reason;
    this.pauseTime = Date.now();
    return { success: true, message: reason };
  }

  // 恢复游戏
  resumeGame() {
    if (!this.isPaused) {
      throw new Error('游戏不在暂停状态');
    }
    const pauseDuration = Date.now() - this.pauseTime;
    this.gameStartTime += pauseDuration;  // 调整游戏开始时间
    this.isPaused = false;
    this.pauseReason = null;
    this.pauseTime = null;
    return { success: true, message: '游戏已恢复' };
  }

  // 获取观战者视角的游戏状态
  getSpectatorGameState() {
    const gameState = this.getGameState();
    // 移除敏感信息
    delete gameState.bottomCards;
    gameState.players = gameState.players.map(player => ({
      ...player,
      hand: player.handSize  // 只显示手牌数量
    }));
    return gameState;
  }

  // 检查游戏是否可以继续
  canContinue() {
    if (this.isPaused) return false;
    
    // 检查时间限制
    if (this.gameOptions.timeLimit > 0) {
      const elapsed = (Date.now() - this.gameStartTime) / 1000;
      if (elapsed > this.gameOptions.timeLimit) {
        this.pauseGame('游戏时间已到');
        return false;
      }
    }
    
    return true;
  }
}

export default Game; 