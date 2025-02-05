import { useState } from 'react';
import Card from './Card';

const Hand = ({ cards, isActive, onCardSelect, isHidden = false }) => {
  const [selectedCards, setSelectedCards] = useState([]);

  const handleCardClick = (card) => {
    if (!isActive) return;

    setSelectedCards(prev => {
      const isSelected = prev.some(c => 
        c.suit === card.suit && c.rank === card.rank
      );

      if (isSelected) {
        return prev.filter(c => 
          !(c.suit === card.suit && c.rank === card.rank)
        );
      } else {
        return [...prev, card];
      }
    });
  };

  const handlePlay = () => {
    if (selectedCards.length > 0) {
      onCardSelect(selectedCards);
      setSelectedCards([]);
    }
  };

  return (
    <div className="hand-container">
      <div className="hand">
        {cards.map((card, index) => (
          <Card 
            key={`${card.suit}-${card.rank}-${index}`}
            suit={card.suit}
            rank={card.rank}
            isHidden={isHidden}
            isSelected={selectedCards.some(c => 
              c.suit === card.suit && c.rank === card.rank
            )}
            onClick={() => handleCardClick(card)}
          />
        ))}
      </div>
      {isActive && selectedCards.length > 0 && (
        <button className="play-button" onClick={handlePlay}>出牌</button>
      )}
    </div>
  );
};

export default Hand; 