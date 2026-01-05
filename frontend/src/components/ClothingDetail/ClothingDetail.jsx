import React, { useState, useRef, useEffect, useMemo, memo } from "react";
import PropTypes from "prop-types";
import { TextInput, Checkbox } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { ConfirmModal } from '../';
import { WEATHER_TYPES, DEFAULT_ITEM_NAME, DEFAULT_WEATHER } from '../../constants';
import { createImagePreview, revokeImagePreview, validateItemName, validateImageFile } from '../../utils';
import { useModal } from '../../hooks';
import "./ClothingDetail.css";

const ClothingDetail = ({ item, onBack, onSave, onDelete, onSaveSuccess, onProcessImage, isEditingItem, onEditToggle }) => {
  const [isEditing, setIsEditing] = useState(isEditingItem || false);
  const [editState, setEditState] = useState({
    name: item.name,
    weather: item.weather || '',
    image: null
  });
  const [nameError, setNameError] = useState('');
  // Use item.image from transformed data (which comes from item.preview in store)
  const [previewImage, setPreviewImage] = useState(item.image);
  const originalImageRef = useRef(item.image); // Keep reference to original image
  const fileInputRef = useRef(null);
  const tempPreviewRef = useRef(null); // Track temporary preview URLs that need cleanup
  
  // Update preview when item changes (e.g., after save or when a new processed image is confirmed)
  useEffect(() => {
    // If we're NOT editing and the image URL truly changed from what we know
    if (!isEditing && item.image !== originalImageRef.current) {
      setPreviewImage(item.image);
      originalImageRef.current = item.image;
      tempPreviewRef.current = null;
    }
  }, [item.image, isEditing]);

  // Sync with newly processed image during edit mode
  useEffect(() => {
    if (isEditing && item.processedFile) {
      setPreviewImage(item.image);
      setEditState(prev => ({ 
        ...prev, 
        image: item.processedFile // Use the actual file object for the eventual save
      }));
    }
  }, [item.image, item.processedFile, isEditing]);

  // Use unified modal hook
  const modal = useModal();

  // Helper to normalize values (treat "Untitled" and empty as equivalent)
  const normalizeValue = (value) => {
    return value === DEFAULT_ITEM_NAME || value === DEFAULT_WEATHER || !value ? '' : value;
  };

  // Derive hasChanges from comparing current values with original item
  const hasChanges = useMemo(() => {
    if (!isEditing) return false;
    
    // Normalize both original and edited values to treat "Untitled" and empty as the same
    // Trim values to ignore whitespace-only changes
    const originalName = normalizeValue(item.name).trim();
    const editedName = normalizeValue(editState.name).trim();
    const originalWeather = normalizeValue(item.weather).trim();
    const editedWeather = normalizeValue(editState.weather).trim();
    
    const nameChanged = editedName !== originalName;
    const weatherChanged = editedWeather !== originalWeather;
    const imageChanged = editState.image !== null;
    
    return nameChanged || weatherChanged || imageChanged;
  }, [isEditing, editState.name, editState.weather, editState.image, item.name, item.weather]);

  // Cleanup temporary image preview URLs on unmount
  useEffect(() => {
    return () => {
      // Clean up any temporary preview URL that was created but not saved
      if (tempPreviewRef.current) {
        revokeImagePreview(tempPreviewRef.current);
      }
    };
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
    if (onEditToggle) onEditToggle(true);
  };

  const handleImageClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Utilize centralized validation
    const validation = validateImageFile(file);

    if (!validation.isValid) {
      modal.openConfirmModal('error', { 
        title: validation.code === 'file-too-large' ? 'File Too Large' : 'Invalid Format', 
        message: validation.error 
      }, () => {});
      return;
    }

    if (onProcessImage) {
      onProcessImage(file, {
        name: editState.name,
        weather: editState.weather
      });
    }
  };

  const handleWeatherChange = (weather) => {
    setEditState(prev => ({ 
      ...prev, 
      weather: prev.weather === weather ? '' : weather 
    }));
  };

  const resetEditState = (cleanupTemp = false) => {
    // Cleanup temporary preview URL if requested (when cancelling)
    if (cleanupTemp && tempPreviewRef.current) {
      revokeImagePreview(tempPreviewRef.current);
      tempPreviewRef.current = null;
    }
    
    setIsEditing(false);
    if (onEditToggle) onEditToggle(false);
    setEditState({
      name: item.name,
      weather: item.weather || '',
      image: null
    });
    // We use item.image here because at this point the item prop 
    // should have been updated either via store or via confirmation
    originalImageRef.current = item.image;
    setPreviewImage(item.image); 
  };

  const handleCancel = () => {
    if (hasChanges) {
      modal.openConfirmModal('unsaved-changes', null, () => {
        resetEditState(true); // Clean up temp preview when cancelling
        onBack();
      });
    } else {
      resetEditState();
    }
  };

  const handleSave = () => {
    if (hasChanges) {
      // Validate item name
      const name = editState.name?.trim();
      if (name) {
        const validation = validateItemName(name);
        if (!validation.isValid) {
          setNameError(validation.error);
          return;
        }
      }

      modal.openConfirmModal('save-changes', null, () => {
        const updates = {
          itemName: editState.name || DEFAULT_ITEM_NAME,
          weather: editState.weather || DEFAULT_WEATHER
        };
        
        if (editState.image) {
          updates.file = editState.image;
          updates.preview = previewImage;
          // Clear temp ref since URL is now owned by the store
          tempPreviewRef.current = null;
        }
        
        onSave(item.id, updates);
        resetEditState(); // Don't cleanup since URL is now in store
        onBack(); // Navigate back to grid after saving
      });
    } else {
      resetEditState();
    }
  };

  const handleBackClick = () => {
    if (isEditing && hasChanges) {
      modal.openConfirmModal('unsaved-changes', null, () => {
        resetEditState();
        onBack();
      });
    } else {
      onBack();
    }
  };

  return (
    <div className="clothing-detail-container">
      <div className="detail-content">
        <div className="detail-image-section">
          <div 
            className={`detail-image-wrapper ${isEditing ? 'editable' : ''}`}
            onClick={handleImageClick}
          >
            <img 
              src={previewImage} 
              alt={item.name} 
              className="detail-image"
            />
            {isEditing && (
              <div className="edit-overlay">
                <IconEdit size={32} stroke={2} />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />
        </div>

        <div className="detail-info-section">
          <div className="detail-info">
            {!isEditing ? (
              <>
                <div className="detail-field">
                  <label className="edit-weather-label">Item Name</label>
                  <h2 className="detail-name">{item.name}</h2>
                </div>
                <div className="detail-field">
                  <label className="edit-weather-label">Weather</label>
                  <p className="detail-weather">{item.weather}</p>
                </div>
              </>
            ) : (
              <>
                <TextInput
                  label="Item Name"
                  value={editState.name}
                  onChange={(e) => {
                    setEditState(prev => ({ ...prev, name: e.target.value }));
                    if (nameError) setNameError('');
                  }}
                  error={nameError}
                  placeholder="Enter item name"
                  size="md"
                  styles={{
                    input: {
                      fontSize: '1.125rem',
                      fontWeight: 600,
                    }
                  }}
                />
                
                <div className="edit-weather-section">
                  <label className="edit-weather-label">Weather</label>
                  <div className="edit-weather-checkboxes">
                    {WEATHER_TYPES.map((weather) => (
                      <Checkbox
                        key={weather}
                        label={weather}
                        checked={editState.weather === weather}
                        onChange={() => handleWeatherChange(weather)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="detail-actions">
            {!isEditing ? (
              <>
                <button className="detail-btn back-btn" onClick={handleBackClick}>
                  Back
                </button>
                <button className="detail-btn edit-btn" onClick={handleEdit}>
                  Edit
                </button>
                <button className="detail-btn delete-btn" onClick={onDelete}>
                  Delete
                </button>
              </>
            ) : (
              <>
                <button className="detail-btn cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button className="detail-btn save-btn" onClick={handleSave}>
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Single Dynamic Confirmation Modal */}
      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />
    </div>
  );
};

ClothingDetail.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    season: PropTypes.string,
    image: PropTypes.string.isRequired
  }).isRequired,
  onBack: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSaveSuccess: PropTypes.func,
  onProcessImage: PropTypes.func,
  isEditingItem: PropTypes.bool,
  onEditToggle: PropTypes.func
};

export default memo(ClothingDetail);
