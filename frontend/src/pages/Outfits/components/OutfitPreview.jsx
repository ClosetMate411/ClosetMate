import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Group, Stack, Text, Badge, Divider } from '@mantine/core';
import './OutfitPreview.css';

const OutfitPreview = ({ outfits, wardrobeItems, onSave, onCancel, saving }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentOutfit = outfits[currentIndex];
  
  // Resolve item details
  const items = currentOutfit?.item_ids
    .map(id => wardrobeItems.find(item => item.id === id))
    .filter(Boolean) || [];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % outfits.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + outfits.length) % outfits.length);
  };

  const handleSave = () => {
    onSave(currentOutfit);
  };

  if (!currentOutfit) return <Text>No outfits generated.</Text>;

  return (
    <div className="outfit-preview">
      <Stack spacing="lg">
        <div className="preview-pagination">
          <Button variant="subtle" onClick={handlePrev} size="xs">← Previous</Button>
          <Text size="sm" weight={600}>Outfit {currentIndex + 1} of {outfits.length}</Text>
          <Button variant="subtle" onClick={handleNext} size="xs">Next →</Button>
        </div>

        <div className="preview-display">
          <div className="preview-items-grid">
            {items.map(item => (
              <div key={item.id} className="preview-item">
                <img src={item.image} alt={item.name} referrerPolicy="no-referrer" />
                <Text size="xs" align="center" mt={4}>{item.name}</Text>
              </div>
            ))}
          </div>
        </div>

        <div className="preview-details">
          <Group position="apart" mb="xs">
            <h3 className="preview-name">{currentOutfit.name}</h3>
            <Badge color="green" variant="light" size="lg">Cohesion: {currentOutfit.cohesion_score}/10</Badge>
          </Group>
          
          <Group spacing="xs" mb="md">
            <Badge variant="outline" color="gray">{currentOutfit.style}</Badge>
            <Badge variant="outline" color="gray">{currentOutfit.occasion}</Badge>
            <Badge variant="outline" color="gray">{currentOutfit.season}</Badge>
          </Group>

          <Text size="sm" color="dimmed" mb="lg">
            {currentOutfit.reasoning}
          </Text>

          <Divider mb="xl" />

          <Group grow>
            <Button variant="default" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button className="save-outfit-btn" onClick={handleSave} loading={saving}>Save to Collection</Button>
          </Group>
        </div>
      </Stack>
    </div>
  );
};

OutfitPreview.propTypes = {
  outfits: PropTypes.arrayOf(PropTypes.object).isRequired,
  wardrobeItems: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool
};

export default OutfitPreview;
