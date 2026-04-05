import React, { memo } from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import ClothingCard from "../ClothingCard/ClothingCard";
import "./ClothingGrid.css";

const ClothingGrid = ({ items, onCardClick }) => {
  return (
    <motion.div
      className="fc-grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {items.map((item, index) => (
        <ClothingCard
          key={item.id}
          item={item}
          index={index}
          onClick={onCardClick}
        />
      ))}
    </motion.div>
  );
};

ClothingGrid.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      image: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      isMuted: PropTypes.bool,
    })
  ).isRequired,
  onCardClick: PropTypes.func.isRequired,
};

export default memo(ClothingGrid);
