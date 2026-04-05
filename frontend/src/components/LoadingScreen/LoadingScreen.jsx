import React, { memo } from 'react';
import PropTypes from 'prop-types';
import FloatingEmojiBg from '../FloatingEmojiBg/FloatingEmojiBg';
import './LoadingScreen.css';

const LoadingScreen = ({ message, submessage }) => {
  return (
    <div className="loading-screen-overlay">
      <FloatingEmojiBg />
      <div className="loading-screen-content">
        <div className="loading-spinner"></div>
        {message && <h3 className="loading-message">{message}</h3>}
      </div>
    </div>
  );
};

LoadingScreen.propTypes = {
  message: PropTypes.string,
  submessage: PropTypes.string
};

export default memo(LoadingScreen);

