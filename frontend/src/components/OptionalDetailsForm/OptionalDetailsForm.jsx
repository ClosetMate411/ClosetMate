import React, { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { TextInput, Checkbox } from '@mantine/core';
import { WEATHER_TYPES } from '../../constants';
import { validateItemName } from '../../utils';
import './OptionalDetailsForm.css';

const OptionalDetailsForm = ({ onSave, onSkip }) => {
  const [itemName, setItemName] = useState('');
  const [selectedWeather, setSelectedWeather] = useState('');
  const [error, setError] = useState('');

  const handleWeatherChange = useCallback((weather) => {
    setSelectedWeather(prev => prev === weather ? '' : weather);
  }, []);

  const handleSave = useCallback(() => {
    // Validate item name if provided
    if (itemName.trim()) {
      const validation = validateItemName(itemName);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }
    }
    
    setError('');
    const details = {
      itemName: itemName.trim() || undefined,
      weather: selectedWeather || undefined
    };
    
    if (onSave) {
      onSave(details);
    }
  }, [itemName, selectedWeather, onSave]);

  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    }
  }, [onSkip]);

  const handleItemNameChange = useCallback((event) => {
    setItemName(event.currentTarget.value);
    if (error) setError(''); // Clear error when user types
  }, [error]);

  return (
    <div className="optional-details-wrapper">
      <TextInput
        label="Item Name"
        placeholder="Enter Item Name"
        value={itemName}
        onChange={handleItemNameChange}
        error={error}
        className="item-name-input"
        size="md"
      />

      <div className="weather-checkbox-container">
        <label className="input-label">Weather</label>
        <div className="checkbox-grid">
          {WEATHER_TYPES.map((weather) => (
            <Checkbox
              key={weather}
              checked={selectedWeather === weather}
              onChange={() => handleWeatherChange(weather)}
              label={weather}
              className="weather-checkbox"
            />
          ))}
        </div>
      </div>

      <div className="action-buttons">
        <button 
          className="skip-button" 
          onClick={handleSkip}
          type="button"
        >
          SKIP
        </button>
        <button 
          className="save-button" 
          onClick={handleSave}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
};

OptionalDetailsForm.propTypes = {
  onSave: PropTypes.func,
  onSkip: PropTypes.func
};

export default memo(OptionalDetailsForm);

