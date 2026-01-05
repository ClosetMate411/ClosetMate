import React, { useCallback, memo } from "react";
import PropTypes from "prop-types";
import { ClothingCard, AddItemButton, ClothingDetail } from '../';
import "./ClothingGrid.css";

const ClothingGrid = ({ items, onAddClick, selectedItem, onCardClick, onBack, onSave, onDelete, onProcessImage, isEditingItem, onEditToggle }) => {
  // Memoize individual card click handlers to prevent re-creating on every render
  const handleCardClick = useCallback((item) => {
    onCardClick(item);
  }, [onCardClick]);

  return (
    <section className="wardrobe-section">
      <div className="wardrobe-container">
        {!selectedItem ? (
          <>
            <div className="grid-header">
              <h2 className="grid-title">Your Item{items.length > 1 && "s"}</h2>
              <span className="grid-count">{items.length} item{items.length > 1 && "s"}</span>
            </div>

            <div className="clothing-grid">
              {items.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  onClick={handleCardClick}
                />
              ))}
            </div>

            <div className="add-item-container">
              <AddItemButton onClick={onAddClick} />
            </div>
          </>
        ) : (
          <ClothingDetail
            item={selectedItem}
            onBack={onBack}
            onSave={onSave}
            onDelete={onDelete}
            onProcessImage={onProcessImage}
            isEditingItem={isEditingItem}
            onEditToggle={onEditToggle}
          />
        )}
      </div>
    </section>
  );
};

ClothingGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    weather: PropTypes.string,
    isMuted: PropTypes.bool
  })).isRequired,
  onAddClick: PropTypes.func.isRequired,
  selectedItem: PropTypes.object,
  onCardClick: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onProcessImage: PropTypes.func,
  isEditingItem: PropTypes.bool,
  onEditToggle: PropTypes.func
};

export default memo(ClothingGrid);

