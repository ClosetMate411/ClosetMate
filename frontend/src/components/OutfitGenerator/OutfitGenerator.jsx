import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Select, NumberInput, Button, Group, Stack, Text } from '@mantine/core';
import './OutfitGenerator.css';

const SEASON_OPTIONS = [
  { value: 'all', label: 'All Seasons' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

const OCCASION_OPTIONS = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'work', label: 'Work' },
  { value: 'formal-event', label: 'Formal Event' },
  { value: 'date-night', label: 'Date Night' },
  { value: 'party', label: 'Party' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'gym', label: 'Gym' },
  { value: 'beach', label: 'Beach' },
  { value: 'travel', label: 'Travel' },
  { value: 'lounging', label: 'Lounging' },
  { value: 'wedding', label: 'Wedding' },
];

const STYLE_OPTIONS = [
  { value: 'any', label: 'Any Style' },
  { value: 'casual', label: 'Casual' },
  { value: 'formal', label: 'Formal' },
  { value: 'business-casual', label: 'Business Casual' },
  { value: 'smart-casual', label: 'Smart Casual' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'bohemian', label: 'Bohemian' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'preppy', label: 'Preppy' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'classic', label: 'Classic' },
  { value: 'athleisure', label: 'Athleisure' },
];

const OutfitGenerator = ({ onGenerate, loading }) => {
  const [filters, setFilters] = useState({
    season: 'all',
    occasion: 'everyday',
    style: 'any',
    count: 3
  });

  const handleChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    onGenerate(filters);
  };

  return (
    <div className="outfit-generator">
      <Stack spacing="md">
        <Text size="lg" weight={600}>Outfit Preferences</Text>
        <Text size="sm" color="dimmed">Select your preferences and Gemini will curate the best combinations from your wardrobe.</Text>
        
        <Select
          label="Season/Weather"
          placeholder="Pick a season"
          data={SEASON_OPTIONS}
          value={filters.season}
          onChange={(val) => handleChange('season', val)}
        />
        
        <Select
          label="Occasion"
          placeholder="What's the occasion?"
          data={OCCASION_OPTIONS}
          value={filters.occasion}
          onChange={(val) => handleChange('occasion', val)}
        />
        
        <Select
          label="Style"
          placeholder="Preferred style"
          data={STYLE_OPTIONS}
          value={filters.style}
          onChange={(val) => handleChange('style', val)}
        />
        
        <NumberInput
          label="Number of Outfits"
          placeholder="Max 10"
          value={filters.count}
          min={1}
          max={10}
          onChange={(val) => handleChange('count', val)}
        />
        
        <Button 
          onClick={handleGenerate} 
          loading={loading}
          size="md"
          fullWidth
          className="generate-btn"
        >
          {loading ? 'Analyzing Wardrobe...' : 'Generate Outfits'}
        </Button>
      </Stack>
    </div>
  );
};

OutfitGenerator.propTypes = {
  onGenerate: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default OutfitGenerator;
