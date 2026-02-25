import React, { memo } from 'react';
import PropTypes from 'prop-types';
import OutfitCard from '../OutfitCard/OutfitCard';
import './OutfitGrid.css';

const OutfitGrid = ({ outfits, wardrobeItems, onAddClick, onOutfitClick }) => {
  return (
    <section className="outfits-section">
      <div className="grid-header">
        <h2 className="grid-title">Your Outfit{outfits.length !== 1 && "s"}</h2>
        <span className="grid-count">{outfits.length} combination{outfits.length !== 1 && "s"}</span>
      </div>

      <div className="outfits-grid">
        {outfits.map((outfit) => (
          <OutfitCard
            key={outfit.id}
            outfit={outfit}
            wardrobeItems={wardrobeItems}
            onClick={onOutfitClick}
          />
        ))}
        
        <button className="add-outfit-card" onClick={onAddClick}>
          <div className="add-icon">+</div>
          <div className="add-text">Generate New Outfit</div>
        </button>
      </div>
    </section>
  );
};

OutfitGrid.propTypes = {
  outfits: PropTypes.arrayOf(PropTypes.object).isRequired,
  wardrobeItems: PropTypes.array.isRequired,
  onAddClick: PropTypes.func.isRequired,
  onOutfitClick: PropTypes.func.isRequired
};

export default memo(OutfitGrid);
