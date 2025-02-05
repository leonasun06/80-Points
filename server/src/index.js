import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Game from './game/Game.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite 默认端口
    methods: ["GET", "POST"]
  }
});

// 存储所有游戏实例
const games = new Map();

// 基本的 Express 中间件
app.use(cors());
app.use(express.json());

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 创建游戏
  socket.on('createGame', (data) => {
    console.log('创建游戏:', { socketId: socket.id, options: data.options });
    const gameId = Math.random().toString(36).substring(2, 15);
    const players = new Map();
    players.set(socket.id, { hand: [], id: socket.id });
    
    const game = new Game(players, data.options);
    games.set(gameId, game);
    
    console.log('游戏创建成功:', { 
      gameId, 
      playersCount: game.players.size,
      gameState: game.getGameState()
    });
    
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerId: socket.id });
  });

  // 加入游戏
  socket.on('joinGame', (data) => {
    console.log('尝试加入游戏:', { socketId: socket.id, gameId: data.gameId });
    const game = games.get(data.gameId);
    if (!game) {
      console.log('游戏不存在:', data.gameId);
      socket.emit('error', { message: '游戏不存在' });
      return;
    }

    if (game.players.size >= 4) {
      console.log('游戏人数已满:', { gameId: data.gameId, currentPlayers: game.players.size });
      socket.emit('error', { message: '游戏人数已满' });
      return;
    }

    game.players.set(socket.id, { hand: [], id: socket.id });
    socket.join(data.gameId);
    socket.emit('gameJoined', { gameId: data.gameId, playerId: socket.id });
    
    console.log('玩家加入成功:', {
      gameId: data.gameId,
      playerId: socket.id,
      currentPlayers: game.players.size
    });

    // 如果人数已满，开始游戏
    if (game.players.size === 4) {
      console.log('游戏开始:', {
        gameId: data.gameId,
        players: Array.from(game.players.keys())
      });
      game.initializeGame();
      io.to(data.gameId).emit('gameStarted', game.getGameState());
    } else {
      io.to(data.gameId).emit('waitingForPlayers', { 
        currentPlayers: game.players.size 
      });
    }
  });

  // 叫主
  socket.on('bid', (data) => {
    console.log('收到叫主:', { socketId: socket.id, gameId: data.gameId, bid: data.bid });
    const game = games.get(data.gameId);
    if (!game) {
      console.log('游戏不存在:', data.gameId);
      socket.emit('error', { message: '游戏不存在' });
      return;
    }

    try {
      const result = game.bid(socket.id, data.bid);
      console.log('叫主结果:', {
        gameId: data.gameId,
        playerId: socket.id,
        result
      });
      io.to(data.gameId).emit('bidUpdate', {
        ...result,
        gameState: game.getGameState()
      });
    } catch (error) {
      console.error('叫主错误:', {
        gameId: data.gameId,
        playerId: socket.id,
        error: error.message
      });
      socket.emit('error', { message: error.message });
    }
  });

  // 出牌
  socket.on('playCards', (data) => {
    console.log('收到出牌:', { socketId: socket.id, gameId: data.gameId, cards: data.cards });
    const game = games.get(data.gameId);
    if (!game) {
      console.log('游戏不存在:', data.gameId);
      socket.emit('error', { message: '游戏不存在' });
      return;
    }

    try {
      const result = game.playCards(socket.id, data.cards);
      console.log('出牌结果:', {
        gameId: data.gameId,
        playerId: socket.id,
        result
      });
      io.to(data.gameId).emit('playUpdate', {
        ...result,
        gameState: game.getGameState()
      });
    } catch (error) {
      console.error('出牌错误:', {
        gameId: data.gameId,
        playerId: socket.id,
        error: error.message
      });
      socket.emit('error', { message: error.message });
    }
  });

  // 观战
  socket.on('spectateGame', (data) => {
    const game = games.get(data.gameId);
    if (!game) {
      socket.emit('error', { message: '游戏不存在' });
      return;
    }

    try {
      game.addSpectator(socket.id);
      socket.join(data.gameId);
      socket.emit('spectateStarted', game.getSpectatorGameState());
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    // 处理玩家断开连接的逻辑
    for (const [gameId, game] of games.entries()) {
      if (game.players.has(socket.id)) {
        game.pauseGame('玩家断开连接');
        io.to(gameId).emit('playerDisconnected', {
          playerId: socket.id,
          gameState: game.getGameState()
        });
      }
      game.removeSpectator(socket.id);
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 