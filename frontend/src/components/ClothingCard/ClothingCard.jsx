import React, { memo } from "react";
import PropTypes from "prop-types";
import "./ClothingCard.css";

const ClothingCard = ({ item, onClick }) => {
  const { image, name, isMuted = false } = item;
  
  const handleImageError = (e) => {
    e.target.style.backgroundColor = '#f0f0f0';
    e.target.alt = 'Image failed to load';
  };

  const handleClick = () => {
    onClick(item);
  };

  return (
    <button className="clothing-card" type="button" onClick={handleClick}>
      <div className="clothing-thumb">
        <img 
          src={image} 
          alt={name} 
          loading="lazy"
          onError={handleImageError}
          referrerPolicy="no-referrer"
        />
      </div>
      <div className={`clothing-name ${isMuted ? "clothing-name--muted" : ""}`}>
        {name}
      </div>
    </button>
  );
};

ClothingCard.propTypes = {
  item: PropTypes.shape({
    image: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    isMuted: PropTypes.bool
  }).isRequired,
  onClick: PropTypes.func.isRequired
};

export default memo(ClothingCard);

