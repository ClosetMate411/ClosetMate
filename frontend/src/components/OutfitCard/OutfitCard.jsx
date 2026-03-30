import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import './OutfitCard.css';

const OutfitCard = ({ outfit, wardrobeItems, onClick }) => {
  const { name, item_ids, is_favorite, cohesion_score, style, occasion } = outfit;

  // Resolve item details from wardrobeStore
  const items = useMemo(() =>
    item_ids.map(id => wardrobeItems.find(item => item.id === id)).filter(Boolean),
    [item_ids, wardrobeItems]
  );

  const handleClick = () => {
    onClick(outfit);
  };

  return (
    <button className="outfit-card" onClick={handleClick}>
      <div className="outfit-collage">
        {items.slice(0, 4).map((item, index) => (
          <div key={item.id} className={`collage-item collage-item--${index + 1}`}>
            <img src={item.image} alt={item.name} referrerPolicy="no-referrer" />
          </div>
        ))}
        {items.length > 4 && (
          <div className="collage-more">+{items.length - 4}</div>
        )}
      </div>
      
      <div className="outfit-info">
        <div className="outfit-header">
          <h3 className="outfit-name">{name}</h3>
          {is_favorite && <span className="favorite-badge">★</span>}
        </div>
        
        <div className="outfit-meta">
          {style && <span className="meta-tag">{style}</span>}
          {occasion && <span className="meta-tag">{occasion}</span>}
          {cohesion_score && (
            <div className="cohesion-score">
              <span className="score-label">Cohesion:</span>
              <span className="score-value">{cohesion_score}/10</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

OutfitCard.propTypes = {
  outfit: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    item_ids: PropTypes.arrayOf(PropTypes.string).isRequired,
    is_favorite: PropTypes.bool,
    cohesion_score: PropTypes.number,
    style: PropTypes.string,
    occasion: PropTypes.string
  }).isRequired,
  wardrobeItems: PropTypes.array.isRequired,
  onClick: PropTypes.func.isRequired
};

export default memo(OutfitCard);
