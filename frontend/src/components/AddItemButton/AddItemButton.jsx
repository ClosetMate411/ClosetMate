import React, { memo } from "react";
import PropTypes from "prop-types";
import "./AddItemButton.css";

const AddItemButton = ({ onClick }) => {
  return (
    <button
      className="add-item-button"
      onClick={onClick}
      type="button"
    >
      <span className="btn-icon">＋</span>
      Add Clothing Item
    </button>
  );
};

AddItemButton.propTypes = {
  onClick: PropTypes.func.isRequired
};

export default memo(AddItemButton);

