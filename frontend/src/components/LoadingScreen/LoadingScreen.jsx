import React, { memo } from 'react';
import PropTypes from 'prop-types';
import './LoadingScreen.css';

const LoadingScreen = ({ message, submessage }) => {
  return (
    <div className="loading-screen-overlay">
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

