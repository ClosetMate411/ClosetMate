import React, { memo } from 'react';
import PropTypes from 'prop-types';
import './ImageConfirmation.css';

const ImageConfirmation = ({ 
  imageUrl,
  onConfirm,
  onUploadDifferent,
  onCancel,
  isEditMode = false
}) => {
  return (
    <div className="image-confirmation-overlay">
      <div className="image-confirmation-content">
        <h2 className="confirmation-title">Check Your Processed Image</h2>
        
        <div className="confirmation-image-container">
          <div className="checkerboard-bg">
            <img 
              src={imageUrl} 
              alt="Processed clothing item" 
              className="confirmation-image"
            />
          </div>
        </div>
        
        <div className="confirmation-actions">
          <button 
            className="image-confirmation-btn image-confirmation-confirm" 
            onClick={onConfirm}
            type="button"
          >
            ✓ Confirm Image
          </button>
          
          <button 
            className="image-confirmation-btn image-confirmation-upload" 
            onClick={onUploadDifferent}
            type="button"
          >
            Upload Different Image
          </button>
          
          <button 
            className="image-confirmation-btn image-confirmation-cancel" 
            onClick={onCancel}
            type="button"
          >
            {isEditMode ? 'Back to Edit' : 'Return to Wardrobe'}
          </button>
        </div>
      </div>
    </div>
  );
};

ImageConfirmation.propTypes = {
  imageUrl: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onUploadDifferent: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isEditMode: PropTypes.bool
};

export default memo(ImageConfirmation);

