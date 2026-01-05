import { useCallback, useMemo } from 'react';
import useWardrobeStore from '../store/wardrobeStore';
import { DEFAULT_ITEM_NAME, DEFAULT_WEATHER, MODAL_TYPES } from '../constants';

/**
 * Custom hook for wardrobe business logic
 * Separates business logic from UI components
 */
const useWardrobeHandlers = (modal) => {
  const { openModal, closeModal, getModalData } = modal;
  
  const addItem = useWardrobeStore((state) => state.addItem);
  const updateItem = useWardrobeStore((state) => state.updateItem);
  const removeItem = useWardrobeStore((state) => state.removeItem);
  const setOpenModal = useWardrobeStore((state) => state.setOpenModal);
  const setCurrentItemId = useWardrobeStore((state) => state.setCurrentItemId);
  const currentItemId = useWardrobeStore((state) => state.currentItemId);

  // Upload handlers - Create item with file and details
  const handleApply = useCallback(async (file, itemName = '', weather = '') => {
    try {
      // Create item with the file (backend will process it)
      const newItemId = await addItem(file, itemName, weather);
      setCurrentItemId(newItemId);
      return newItemId;
    } catch (error) {
      console.error("Failed to add item:", error);
      throw error;
    }
  }, [addItem, setCurrentItemId]);

  const handleCancel = useCallback(() => {
    setOpenModal(null);
  }, [setOpenModal]);

  // Details handlers
  const handleSaveDetails = useCallback(async (details) => {
    if (currentItemId) {
      try {
        await updateItem(currentItemId, {
          itemName: details?.itemName || DEFAULT_ITEM_NAME,
          weather: details?.weather || DEFAULT_WEATHER
        });
      } catch (error) {
        console.error("Failed to save details:", error);
        // TODO: Show error toast
      }
    }
    
    setOpenModal(null);
    setCurrentItemId(null);
  }, [currentItemId, updateItem, setOpenModal, setCurrentItemId]);

  const confirmSaveDetails = useCallback(() => {
    const details = getModalData(MODAL_TYPES.CONFIRM_SAVE);
    
    const hasDetails = details?.itemName || details?.weather;
    
    if (currentItemId && hasDetails) {
      updateItem(currentItemId, {
        itemName: details.itemName || DEFAULT_ITEM_NAME,
        weather: details.weather || DEFAULT_WEATHER
      });
    }
    
    setOpenModal(null);
    setCurrentItemId(null);
    closeModal(MODAL_TYPES.CONFIRM_SAVE);
  }, [currentItemId, updateItem, setOpenModal, setCurrentItemId, closeModal, getModalData]);

  const handleSkipDetails = useCallback(() => {
    openModal(MODAL_TYPES.CONFIRM_SKIP);
  }, [openModal]);

  const confirmSkipDetails = useCallback(() => {
    setOpenModal(null);
    setCurrentItemId(null);
    closeModal(MODAL_TYPES.CONFIRM_SKIP);
  }, [setOpenModal, setCurrentItemId, closeModal]);

  const handleDetailsModalClose = useCallback(async () => {
    console.log("Details modal closed without saving");
    if (currentItemId) {
      try {
        await removeItem(currentItemId);
      } catch (error) {
        console.error("Failed to delete item:", error);
      }
    }
    setOpenModal(null);
    setCurrentItemId(null);
  }, [currentItemId, removeItem, setOpenModal, setCurrentItemId]);

  // Edit handlers
  const handleSaveEdit = useCallback(async (itemId, updates) => {
    // Double check if anything changed before calling the store action
    const currentItems = useWardrobeStore.getState().items;
    const originalItem = currentItems.find(i => i.id === itemId);
    
    if (originalItem) {
      const nameChanged = updates.itemName !== undefined && updates.itemName.trim() !== (originalItem.name || '').trim();
      const weatherChanged = updates.weather !== undefined && updates.weather.trim() !== (originalItem.weather || '').trim();
      const imageChanged = updates.file !== undefined;

      if (!nameChanged && !weatherChanged && !imageChanged) {
        return;
      }
    }

    try {
      await updateItem(itemId, updates);
    } catch (error) {
      console.error("Failed to save edit:", error);
      throw error;
    }
  }, [updateItem]);

  // Delete handlers
  const handleDeleteRequest = useCallback((item) => {
    openModal(MODAL_TYPES.CONFIRM_DELETE, item);
  }, [openModal]);

  const confirmDelete = useCallback(async (itemId) => {
    if (itemId) {
      try {
        await removeItem(itemId);
      } catch (error) {
        console.error("Failed to delete item:", error);
        throw error;
      }
    }
  }, [removeItem]);

  return useMemo(() => ({
    handleApply,
    handleCancel,
    handleSaveDetails,
    confirmSaveDetails,
    handleSkipDetails,
    confirmSkipDetails,
    handleDetailsModalClose,
    handleSaveEdit,
    handleDeleteRequest,
    confirmDelete,
  }), [
    handleApply,
    handleCancel,
    handleSaveDetails,
    confirmSaveDetails,
    handleSkipDetails,
    confirmSkipDetails,
    handleDetailsModalClose,
    handleSaveEdit,
    handleDeleteRequest,
    confirmDelete,
  ]);
};

export default useWardrobeHandlers;

