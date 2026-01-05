import React, { memo } from 'react';
import PropTypes from 'prop-types';
import './Toast.css';

const Toast = ({ message, type = 'success', isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
      <span className="toast-message">{message}</span>
    </div>
  );
};

Toast.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  isVisible: PropTypes.bool
};

export default memo(Toast);

