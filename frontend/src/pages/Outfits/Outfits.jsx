import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Container, Text, Stack, Group, ActionIcon, Badge, Divider } from '@mantine/core';
import { IconArrowLeft, IconHeart, IconHeartFilled, IconTrash } from '@tabler/icons-react';
import useOutfitStore from '../../store/outfitStore';
import useWardrobeStore from '../../store/wardrobeStore';
import { OutfitGrid, OutfitGenerator, LoadingScreen, Toast, ConfirmModal } from '../../components';
import OutfitPreview from './components/OutfitPreview';
import { useToast, useModal } from '../../hooks';
import './Outfits.css';

const Outfits = () => {
  const { 
    outfits, 
    generatedOutfits, 
    loading, 
    fetchOutfits, 
    generateOutfits, 
    saveOutfit, 
    toggleFavorite, 
    deleteOutfit,
    clearGenerated
  } = useOutfitStore();
  
  const { items, fetchItems } = useWardrobeStore();
  const { toast, showSuccess, showError } = useToast();
  const modal = useModal();
  
  const [activeModal, setActiveModal] = useState(null); // 'generate' | 'preview' | 'detail'
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    fetchOutfits();
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateClick = () => {
    setActiveModal('generate');
  };

  const handleGenerate = async (filters) => {
    try {
      await generateOutfits(filters);
      setActiveModal('preview');
    } catch (error) {
      showError(error.message || 'Failed to generate outfits');
    }
  };

  const handleSaveOutfit = async (outfit) => {
    setIsSaving(true);
    try {
      await saveOutfit(outfit);
      showSuccess('Outfit saved to your collection!');
      setActiveModal(null);
      clearGenerated();
    } catch (error) {
      showError(error.message || 'Failed to save outfit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOutfitClick = (outfit) => {
    setSelectedOutfit(outfit);
    setActiveModal('detail');
  };

  const handleToggleFavorite = async (e, id) => {
    e.stopPropagation();
    try {
      await toggleFavorite(id);
    } catch (error) {
      showError('Failed to update favorite');
    }
  };

  const handleDeleteClick = () => {
    modal.openConfirmModal('delete', selectedOutfit, async () => {
      try {
        await deleteOutfit(selectedOutfit.id);
        showSuccess('Outfit deleted successfully');
        setActiveModal(null);
        setSelectedOutfit(null);
      } catch (error) {
        showError('Failed to delete outfit');
      }
    });
  };

  const handleBack = () => {
    setActiveModal(null);
    setSelectedOutfit(null);
  };

  const renderDetailItems = () => {
    if (!selectedOutfit) return null;
    const outfitItems = selectedOutfit.item_ids
      .map(id => items.find(item => item.id === id))
      .filter(Boolean);

    return (
      <div className="detail-items-grid">
        {outfitItems.map(item => (
          <div key={item.id} className="detail-item-card">
            <img src={item.image} alt={item.name} />
            <Text size="sm" weight={500}>{item.name}</Text>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="outfits-page-wrapper">
      <Container size="xl" py="xl">
        {loading && outfits.length === 0 ? (
          <LoadingScreen />
        ) : (
          <OutfitGrid 
            outfits={outfits} 
            wardrobeItems={items} 
            onAddClick={handleGenerateClick}
            onOutfitClick={handleOutfitClick}
          />
        )}
      </Container>

      {/* Generator Modal */}
      <Modal
        opened={activeModal === 'generate'}
        onClose={() => setActiveModal(null)}
        title="Generate Outfits"
        centered
        size="md"
      >
        <OutfitGenerator onGenerate={handleGenerate} loading={loading} />
      </Modal>

      {/* Preview Modal */}
      <Modal
        opened={activeModal === 'preview'}
        onClose={() => setActiveModal(null)}
        title="Curated Outfits"
        centered
        size="lg"
      >
        <OutfitPreview 
          outfits={generatedOutfits} 
          wardrobeItems={items} 
          onSave={handleSaveOutfit}
          onCancel={() => setActiveModal('generate')}
          saving={isSaving}
        />
      </Modal>

      {/* Detail Modal — wide so 5+ items lay out side-by-side without scroll */}
      <Modal
        opened={activeModal === 'detail'}
        onClose={() => setActiveModal(null)}
        title="Outfit Details"
        centered
        size="90%"
        styles={{
          modal: { maxWidth: 1280 },
          body: { paddingTop: 8 },
        }}
      >
        {selectedOutfit && (
          <Stack spacing="lg">
            <Group position="apart">
              <h2 className="detail-name">{selectedOutfit.name}</h2>
              <Group spacing="xs">
                <ActionIcon 
                  variant="subtle" 
                  color={selectedOutfit.is_favorite ? "red" : "gray"}
                  onClick={(e) => handleToggleFavorite(e, selectedOutfit.id)}
                  size="xl"
                >
                  {selectedOutfit.is_favorite ? <IconHeartFilled /> : <IconHeart />}
                </ActionIcon>
                <ActionIcon color="red" variant="subtle" onClick={handleDeleteClick} size="xl">
                  <IconTrash />
                </ActionIcon>
              </Group>
            </Group>

            {renderDetailItems()}

            <div className="detail-info">
              <Group spacing="xs" mb="md">
                <Badge size="lg" color="indigo" variant="filled">{selectedOutfit.style}</Badge>
                <Badge size="lg" color="teal" variant="filled">{selectedOutfit.occasion}</Badge>
                <Badge size="lg" color="orange" variant="filled">{selectedOutfit.season}</Badge>
              </Group>
              
              <Text size="md" color="dimmed" mb="md">
                {selectedOutfit.reasoning}
              </Text>
              
              <div className="cohesion-box">
                <Text weight={700}>Cohesion Score: {selectedOutfit.cohesion_score}/10</Text>
              </div>
            </div>
          </Stack>
        )}
      </Modal>

      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />

      <Toast {...toast} />
    </div>
  );
};

export default Outfits;
