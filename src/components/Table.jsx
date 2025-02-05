import React from 'react';
import Card from './Card';
import '../styles/Table.css';

const Table = ({ currentTrick }) => {
  return (
    <div className="table">
      <div className="table-center">
        {/* 显示当前一轮的出牌 */}
        <div className="current-trick">
          {currentTrick.map((play, index) => (
            <div key={index} className={`player-cards player-${play.playerId}`}>
              {play.cards.map((card, cardIndex) => (
                <Card
                  key={`${card.suit}-${card.rank}-${cardIndex}`}
                  suit={card.suit}
                  rank={card.rank}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Table; 