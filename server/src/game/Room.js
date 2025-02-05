import Game from './Game.js';

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map(); // 存储玩家信息
    this.game = null;         // 游戏实例
    this.isStarted = false;   // 游戏是否开始
  }

  addPlayer(playerId, playerInfo) {
    if (this.players.size >= 4) {
      throw new Error('房间已满');
    }
    this.players.set(playerId, {
      ...playerInfo,
      position: this.players.size // 分配位置 0-3
    });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  isReady() {
    return this.players.size === 4;
  }

  startGame() {
    if (!this.isReady()) {
      throw new Error('玩家人数不足');
    }
    
    // 创建新的游戏实例
    this.game = new Game(this.players);
    this.isStarted = true;
    
    return this.game;
  }

  // 添加处理叫主的方法
  handleBid(playerId, bid) {
    if (!this.game) {
      throw new Error('游戏尚未开始');
    }
    
    try {
      return this.game.bid(playerId, bid);
    } catch (error) {
      console.error('叫主错误:', {
        gamePhase: this.game.gamePhase,
        playerId,
        error: error.message
      });
      throw error;
    }
  }

  // 获取游戏状态
  getGameState() {
    if (!this.game) {
      return null;
    }
    return this.game.getGameState();
  }
}

export default Room; 