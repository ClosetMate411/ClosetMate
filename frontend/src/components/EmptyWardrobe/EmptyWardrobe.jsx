import React, { memo } from "react";
import PropTypes from "prop-types";
import { AddItemButton } from "../";
import "./EmptyWardrobe.css";

const EmptyWardrobe = ({ onAddClick }) => {
  return (
    <>
      <section className="wardrobe-hero">
        <div className="wardrobe-container">
          <h1 className="wardrobe-title">Wardrobe</h1>
          <p className="wardrobe-subtitle">
            Upload items to build your digital wardrobe.
          </p>
        </div>
      </section>
      <section className="empty-state">
        <p className="empty-text">
          Your wardrobe is empty. Start by adding your first clothing item!
        </p>
        <AddItemButton onClick={onAddClick} />
      </section>
    </>
  );
};

EmptyWardrobe.propTypes = {
  onAddClick: PropTypes.func.isRequired
};

export default memo(EmptyWardrobe);

