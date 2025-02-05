import '../styles/Card.css';

const Card = ({ suit, rank, isHidden = false, isSelected = false, onClick }) => {
  const color = suit === '♥' || suit === '♦' ? 'red' : 'black';
  
  const getDisplayText = () => {
    if (suit === '🃏') {
      return rank === 'JOKER' ? '大王' : '小王';
    }
    return suit;
  };
  
  return (
    <div 
      className={`card ${isHidden ? 'hidden' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {!isHidden ? (
        <div className="card-content" style={{ color }}>
          <div className="card-corner top-left">
            <div className="card-rank">
              {suit === '🃏' ? (rank === 'JOKER' ? '大王' : '小王') : rank}
            </div>
            {suit !== '🃏' && <div className="card-suit">{suit}</div>}
          </div>
          <div className="card-center">{getDisplayText()}</div>
          <div className="card-corner bottom-right">
            <div className="card-rank">{rank}</div>
            <div className="card-suit">{suit}</div>
          </div>
        </div>
      ) : (
        <div className="card-back"></div>
      )}
    </div>
  );
};

export default Card; 