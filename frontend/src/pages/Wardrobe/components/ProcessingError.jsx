import React, { memo } from 'react';
import PropTypes from 'prop-types';
import './ProcessingError.css';

const ProcessingError = ({ retryCount, onRetry, onUploadDifferent, onReturn }) => {
  return (
    <div className="processing-error-container">
      <div className="error-content">
        <h2 className="error-title">Background Removal Failed</h2>
        <p className="error-message">
          We couldn't process your image. This could be due to a poor internet connection or an unsupported image format.
        </p>
        
        <div className="error-actions">
          {retryCount < 2 ? (
            <button className="error-btn retry-btn" onClick={onRetry}>
              Retry Processing ({retryCount}/2)
            </button>
          ) : (
            <button className="error-btn upload-different-btn" onClick={onUploadDifferent}>
              Upload Different Image
            </button>
          )}
          <button className="error-btn return-btn" onClick={onReturn}>
            Return to Wardrobe
          </button>
        </div>
      </div>
    </div>
  );
};

ProcessingError.propTypes = {
  retryCount: PropTypes.number.isRequired,
  onRetry: PropTypes.func.isRequired,
  onUploadDifferent: PropTypes.func.isRequired,
  onReturn: PropTypes.func.isRequired
};

export default memo(ProcessingError);
