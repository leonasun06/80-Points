import { useState, useEffect } from 'react';
import { createDeck, shuffleDeck, compareCards } from '../utils/deck';
import { GAME_CONSTANTS, calculateScore } from '../utils/gameRules';
import Hand from './Hand';
import Table from './Table';
import '../styles/Game.css';

const Game = () => {
  const [gameState, setGameState] = useState({
    deck: [],
    players: [[], [], [], []],    // 改为独立的空数组
    currentPlayer: 0,
    currentLevel: 2,
    trumpSuit: null,
    scores: [0, 0],
    currentTrick: [],
  });

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const newDeck = shuffleDeck(createDeck());  // 现在是108张牌
    const players = [
      newDeck.slice(0, 27).sort(compareCards),      // 27张
      newDeck.slice(27, 54).sort(compareCards),     // 27张
      newDeck.slice(54, 81).sort(compareCards),     // 27张
      newDeck.slice(81, 108).sort(compareCards)     // 27张
    ];

    // 详细打印每个玩家的牌数和具体内容
    console.log('Deck length:', newDeck.length);
    players.forEach((player, index) => {
      console.log(`Player ${index}:`, {
        length: player.length,
        cards: player
      });
    });

    setGameState(prev => ({
      ...prev,
      deck: newDeck,
      players,
    }));
  };

  const handleCardPlay = (playerId, cards) => {
    if (playerId !== gameState.currentPlayer) return;

    setGameState(prev => {
      const newPlayers = [...prev.players];
      // 移除打出的牌
      newPlayers[playerId] = newPlayers[playerId].filter(
        card => !cards.includes(card)
      );

      return {
        ...prev,
        players: newPlayers,
        currentTrick: [...prev.currentTrick, { playerId, cards }],
        currentPlayer: (playerId + 1) % 4,
      };
    });
  };

  return (
    <div className="game">
      <div className="game-info">
        <div>当前等级: {gameState.currentLevel}</div>
        <div>主牌花色: {gameState.trumpSuit || '未选择'}</div>
        <div>队伍A得分: {gameState.scores[0]}</div>
        <div>队伍B得分: {gameState.scores[1]}</div>
      </div>
      
      <div className="game-table">
        <div className="players">
          <div className="player-0">
            <Hand 
              cards={gameState.players[0]}
              isActive={gameState.currentPlayer === 0}
              onCardSelect={(cards) => handleCardPlay(0, cards)}
            />
          </div>
          <div className="player-1">
            <Hand 
              cards={gameState.players[1]}
              isActive={gameState.currentPlayer === 1}
              onCardSelect={(cards) => handleCardPlay(1, cards)}
              isHidden={true}
            />
          </div>
          <div className="player-2">
            <Hand 
              cards={gameState.players[2]}
              isActive={gameState.currentPlayer === 2}
              onCardSelect={(cards) => handleCardPlay(2, cards)}
              isHidden={true}
            />
          </div>
          <div className="player-3">
            <Hand 
              cards={gameState.players[3]}
              isActive={gameState.currentPlayer === 3}
              onCardSelect={(cards) => handleCardPlay(3, cards)}
              isHidden={true}
            />
          </div>
        </div>
        <Table currentTrick={gameState.currentTrick} />
      </div>
    </div>
  );
};

export default Game; 