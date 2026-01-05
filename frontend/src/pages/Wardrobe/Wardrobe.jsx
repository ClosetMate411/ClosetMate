import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Modal } from "@mantine/core";
import { 
  ClothingGrid, 
  EmptyWardrobe, 
  ClothingDropzone, 
  OptionalDetailsForm,
  ConfirmModal,
  Toast,
  LoadingScreen,
  ImageConfirmation
} from "../../components";
import useWardrobeStore from "../../store/wardrobeStore";
import { useModal, useWardrobeHandlers, useToast } from "../../hooks";
import apiService from "../../services/api.service";
import ProcessingError from "./components/ProcessingError";
import LoadingOverlay from "./components/LoadingOverlay";
import "./Wardrobe.css";

// Selector functions for better performance
const selectItems = (state) => state.items;
const selectLoading = (state) => state.loading;
const selectOpenModal = (state) => state.openModal;
const selectSetOpenModal = (state) => state.setOpenModal;
const selectFetchItems = (state) => state.fetchItems;

const Wardrobe = () => {
  const items = useWardrobeStore(selectItems);
  const loading = useWardrobeStore(selectLoading);
  const openModal = useWardrobeStore(selectOpenModal);
  const setOpenModal = useWardrobeStore(selectSetOpenModal);
  const fetchItems = useWardrobeStore(selectFetchItems);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  
  // Upload workflow states
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'processing' | 'saving' | 'updating' | 'deleting' | 'error' | 'confirming'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const modal = useModal();
  const { toast, showSuccess, showError } = useToast();
  const handlers = useWardrobeHandlers(modal);

  // Fetch items from backend on mount
  useEffect(() => {
    const initFetch = async () => {
      try {
        await fetchItems();
      } catch (error) {
        showError(error.message || 'Failed to load wardrobe');
      }
    };
    initFetch();
  }, [fetchItems, showError]);


  // Get the current selected item. 
  // We prioritize local 'selectedItem' state because it may contain un-saved 
  // UI updates (like a newly processed and confirmed image).
  const currentSelectedItem = useMemo(() => {
    if (!selectedItem) return null;
    const itemInStore = items.find(item => item.id === selectedItem.id);
    return itemInStore ? { ...itemInStore, ...selectedItem } : selectedItem;
  }, [items, selectedItem]);

  const isLoading = useMemo(() => 
    loading || ['processing', 'saving', 'updating', 'deleting'].includes(uploadState),
    [loading, uploadState]
  );

  // File handlers (for validation)
  const handleFilesAccepted = useCallback(() => {
    // Handle accepted files
  }, []);

  const handleFilesRejected = useCallback((rejections) => {
    const error = rejections[0]?.errors[0];
    if (error?.code === 'file-too-large') {
      showError('File is too large. Maximum size is 10MB.');
    } else if (error?.code === 'file-invalid-type') {
      showError('Invalid file format. Please upload JPEG, PNG, or HEIC.');
    } else {
      showError('Failed to upload image. Please try another file.');
    }
  }, [showError]);

  // Upload workflow handlers
  const handleApplyUpload = useCallback(async (uploadedFiles) => {
    const file = uploadedFiles[0].file;
    setUploadedFile(file);
    setOpenModal(null); // Close upload modal
    setUploadState('processing');
    setRetryCount(0);
    
    try {
      const result = await apiService.processImage(file);
      
      // Backend returns: { success: true, data: { processed_url, original_url, file_name, file_size } }
      const imageUrl = result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;
      
      if (!imageUrl) {
        throw new Error('No image URL in response');
      }
      
      setProcessedImageUrl(imageUrl);
      setUploadState('confirming');
      showSuccess('Background has been successfully removed');
    } catch (error) {
      console.error('Image processing failed:', error);
      showError(error.message || 'Failed to process image. Please try again.');
      setUploadState('error');
    }
  }, [setOpenModal, showError]);

  const handleRetryProcessing = useCallback(async () => {
    if (!uploadedFile || retryCount >= 2) return;
    
    setUploadState('processing');
    setRetryCount(prev => prev + 1);
    
    try {
      const result = await apiService.processImage(uploadedFile);
      const imageUrl = result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;
      setProcessedImageUrl(imageUrl);
      setUploadState('confirming');
      showSuccess('Background has been successfully removed');
    } catch (error) {
      console.error('Image processing retry failed:', error);
      showError(error.message || 'Processing failed. Please try again.');
      setUploadState('error');
    }
  }, [uploadedFile, retryCount, showError]);

  const handleUploadDifferent = useCallback(() => {
    setUploadState('idle');
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
    setOpenModal('upload');
  }, [setOpenModal]);

  const handleCancelUpload = useCallback(() => {
    setUploadState('idle');
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
  }, []);

  const handleConfirmImage = useCallback(() => {
    // Just move to details form - don't create item yet
    // Item will be created when user saves details
    setUploadState('idle');
    setOpenModal('details');
  }, [setOpenModal]);

  // UI interaction handlers
  const handleProcessEditImage = useCallback(async (file, tempEdits) => {
    if (!selectedItem) return;
    
    // Preserve unsaved form field changes (name/weather) 
    // before the ClothingDetail component unmounts for confirmation
    if (tempEdits) {
      setSelectedItem(prev => ({
        ...prev,
        name: tempEdits.name,
        weather: tempEdits.weather
      }));
    }
    
    setUploadState('processing');
    try {
      const result = await apiService.processImage(file);
      const imageUrl = result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;
      
      if (!imageUrl) throw new Error('No image URL in response');
      
      setProcessedImageUrl(imageUrl);
      setUploadedFile(file);
      setUploadState('confirming');
      showSuccess('Background has been successfully removed');
    } catch (error) {
      console.error('Image processing failed:', error);
      showError(error.message || 'Failed to process image.');
      setUploadState('error');
    }
  }, [selectedItem, showError, showSuccess]);

  // Consolidated Confirmation Handlers
  const handleConfirmAction = useCallback(() => {
    const isEditMode = !!(selectedItem && selectedItem.id);
    
    if (isEditMode) {
      // In Edit Mode, update the selectedItem state to reflect the new image
      setSelectedItem(prev => ({
        ...prev,
        image: processedImageUrl,
        processedFile: uploadedFile
      }));
      setUploadState('idle');
      setIsEditingItem(true);
      setUploadedFile(null);
      setProcessedImageUrl(null);
    } else {
      setUploadState('idle');
      setOpenModal('details');
    }
  }, [selectedItem, processedImageUrl, uploadedFile, setOpenModal]);

  const handleCancelAction = useCallback(() => {
    setUploadState('idle');
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
    // If we were in the middle of a new upload, we might want to return to the upload modal
    // but the user only asked to fix the edit flow, so we stay on current state.
  }, []);

  const handleUploadDifferentAction = useCallback(() => {
    const isEditMode = !!(selectedItem && selectedItem.id);
    
    setUploadState('idle');
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);

    if (isEditMode) {
      // Stay in edit mode, let the user pick again (the input is in ClothingDetail)
      // We don't need to do anything special here as ClothingDetail is already visible.
    } else {
      // Go back to the upload modal for new items
      setOpenModal('upload');
    }
  }, [selectedItem, setOpenModal]);

  const handleSaveEdit = useCallback(async (itemId, updates) => {
    // Check if anything actually changed before showing loader and sending request
    const originalItem = items.find(i => i.id === itemId);
    if (originalItem) {
      const nameChanged = (updates.itemName || '').trim() !== (originalItem.name || '').trim();
      const weatherChanged = (updates.weather || '').trim() !== (originalItem.weather || '').trim();
      const imageChanged = !!updates.file;

      if (!nameChanged && !weatherChanged && !imageChanged) {
        console.log("No changes detected in Wardrobe, skipping API call");
        setIsEditingItem(false); // Just exit edit mode
        return;
      }
    }

    try {
      setUploadState('updating');
      await handlers.handleSaveEdit(itemId, updates);
      await fetchItems(); // Await full list refresh
      setUploadState('idle');
      showSuccess('Item updated successfully!');
    } catch (error) {
      console.error("Failed to save edit:", error);
      showError(error.message || 'Failed to update item');
      setUploadState('idle');
    }
  }, [handlers, showSuccess, showError, fetchItems, items]);

  const handleCardClick = useCallback((item) => {
    setSelectedItem(item);
    setIsEditingItem(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setIsEditingItem(false);
  }, []);

  const handleDelete = useCallback(async () => {
    modal.openConfirmModal('delete', currentSelectedItem, async () => {
      try {
        setUploadState('deleting');
        await handlers.confirmDelete(currentSelectedItem.id);
        await fetchItems();
        setSelectedItem(null);
        setUploadState('idle');
        showSuccess('Item deleted successfully!');
      } catch (error) {
        showError(error.message || 'Failed to delete item.');
        setUploadState('idle');
      }
    });
  }, [modal, currentSelectedItem, handlers, showSuccess, showError, fetchItems]);

  // Override handlers to use unified modal
  const handleSaveDetails = useCallback(async (details) => {
    try {
      // Create item with the uploaded file and details
      if (uploadedFile) {
        setOpenModal(null); // Close modal immediately as requested
        setUploadState('saving');
        await handlers.handleApply(uploadedFile, details?.itemName || '', details?.weather || '');
        await fetchItems(); // Wait for items to refresh list and be visible
        setUploadState('idle');
        setUploadedFile(null);
        setProcessedImageUrl(null);
        showSuccess('Item saved successfully!');
      } else {
        // If no uploadedFile, it's an edit operation
        handlers.handleSaveDetails(details);
        showSuccess('Item saved successfully!');
      }
    } catch (error) {
      showError(error.message || 'Failed to save item');
      setUploadState('idle');
      setOpenModal(null);
    }
  }, [uploadedFile, handlers, showSuccess, showError, setOpenModal, fetchItems]);

  const handleSkipDetails = useCallback(async () => {
    try {
      // Create item with the uploaded file and no details
      if (uploadedFile) {
        setOpenModal(null); // Close modal immediately as requested
        setUploadState('saving');
        await handlers.handleApply(uploadedFile, '', '');
        await fetchItems(); // Wait for items to refresh list and be visible
        setUploadState('idle');
        setUploadedFile(null);
        setProcessedImageUrl(null);
        showSuccess('Item saved successfully!');
      } else {
        handlers.confirmSkipDetails();
        showSuccess('Item saved successfully!');
      }
    } catch (error) {
      showError(error.message || 'Failed to save item');
      setUploadState('idle');
      setOpenModal(null);
    }
  }, [uploadedFile, handlers, showSuccess, showError, setOpenModal, fetchItems]);

  const handleAddClick = useCallback(() => {
    setOpenModal('upload');
  }, [setOpenModal]);

  const handleCloseUpload = useCallback(() => {
    setOpenModal(null);
  }, [setOpenModal]);





  const renderContent = () => {
    if (isLoading) {
      return <LoadingOverlay uploadState={uploadState} loading={loading} />;
    }

    if (uploadState === 'error') {
      return (
        <ProcessingError 
          retryCount={retryCount}
          onRetry={handleRetryProcessing}
          onUploadDifferent={handleUploadDifferent}
          onReturn={handleCancelUpload}
        />
      );
    }

    if (uploadState === 'confirming' && processedImageUrl) {
      return (
        <ImageConfirmation
          imageUrl={processedImageUrl}
          onConfirm={handleConfirmAction}
          onUploadDifferent={handleUploadDifferentAction}
          onCancel={handleCancelAction}
          isEditMode={!!(selectedItem && selectedItem.id)}
        />
      );
    }

    if (!items.length || (items.length === 1 && openModal === 'details')) {
      return <EmptyWardrobe onAddClick={handleAddClick} />;
    }

    return (
      <ClothingGrid 
        items={items}
        selectedItem={currentSelectedItem}
        onCardClick={handleCardClick}
        onAddClick={handleAddClick}
        onBack={handleBack}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
        onProcessImage={handleProcessEditImage}
        isEditingItem={isEditingItem}
        onEditToggle={setIsEditingItem}
      />
    );
  };

  return (
    <div className="wardrobe-page-wrapper">
      {renderContent()}

      <Modal
        opened={openModal === 'upload'}
        onClose={handleCloseUpload}
        title="Upload Clothing Items"
        size="lg"
        centered
      >
        <ClothingDropzone
          onFilesAccepted={handleFilesAccepted}
          onFilesRejected={handleFilesRejected}
          onApply={handleApplyUpload}
          onCancel={handlers.handleCancel}
        />
      </Modal>

      {/* Details Modal */}
      <Modal
        opened={openModal === 'details'}
        onClose={handlers.handleDetailsModalClose}
        title="Optional Details"
        size="lg"
        centered
      >
        <OptionalDetailsForm
          onSave={handleSaveDetails}
          onSkip={handleSkipDetails}
        />
      </Modal>

      {/* Single Dynamic Confirmation Modal */}
      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />

      {/* Toast Notification */}
      <Toast {...toast} />
    </div>
  );
};

export default Wardrobe;
