import React, { memo } from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import "./ClothingCard.css";

const ClothingCard = ({ item, index = 0, onClick }) => {
  const { image, name, isMuted = false } = item;

  return (
    <motion.div
      className="fc-card"
      onClick={() => onClick(item)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.05, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover="hovered"
      layout
    >
      {/* Image zone — same bg as page */}
      <div className="fc-image-zone">
        <motion.img
          src={image}
          alt={name}
          className="fc-image"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
          referrerPolicy="no-referrer"
          variants={{ hovered: { scale: 1.05 } }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Hover overlay — very subtle purple tint */}
        <motion.div
          className="fc-hover-layer"
          variants={{ hovered: { opacity: 1 } }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <span className="fc-view-label">View Details</span>
        </motion.div>
      </div>

      {/* Name footer */}
      <div className="fc-footer">
        <span className={`fc-name ${isMuted ? "fc-name--muted" : ""}`}>{name}</span>
      </div>
    </motion.div>
  );
};

ClothingCard.propTypes = {
  item: PropTypes.shape({
    image: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    isMuted: PropTypes.bool,
  }).isRequired,
  index: PropTypes.number,
  onClick: PropTypes.func.isRequired,
};

export default memo(ClothingCard);
