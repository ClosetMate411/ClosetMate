import { useState, useCallback, useMemo } from 'react';
import { CONFIRM_VARIANTS } from '../constants';

/**
 * Unified hook for managing all modals (regular and confirmation)
 * @returns {Object} Modal state, handlers, and configurations
 */
const useModal = () => {
  // Regular modals state
  const [modals, setModals] = useState({});
  const [modalData, setModalData] = useState({});

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    data: null,
    onConfirm: null,
  });

  // Regular modal handlers
  const openModal = useCallback((modalName, data = null) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
    if (data) {
      setModalData(prev => ({ ...prev, [modalName]: data }));
    }
  }, []);

  const closeModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
    setTimeout(() => {
      setModalData(prev => {
        const newData = { ...prev };
        delete newData[modalName];
        return newData;
      });
    }, 300);
  }, []);

  const isModalOpen = useCallback((modalName) => {
    return !!modals[modalName];
  }, [modals]);

  const getModalData = useCallback((modalName) => {
    return modalData[modalName];
  }, [modalData]);

  const closeAllModals = useCallback(() => {
    setModals({});
    setModalData({});
  }, []);

  // Confirmation modal handlers
  const openConfirmModal = useCallback((type, data, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      type,
      data,
      onConfirm,
    });
  }, []);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal({
      isOpen: false,
      type: null,
      data: null,
      onConfirm: null,
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmModal.onConfirm) {
      confirmModal.onConfirm();
    }
    closeConfirmModal();
  }, [confirmModal.onConfirm, closeConfirmModal]);

  // Get confirmation modal configuration based on type
  const confirmModalConfig = useMemo(() => {
    const { type, data } = confirmModal;

    switch (type) {
      case 'delete':
        return {
          title: 'Delete',
          message: `Are you sure that you want to delete "${data?.name}"?`,
          variant: CONFIRM_VARIANTS.DELETE,
        };
      
      case 'save-details':
        return {
          title: 'Save Details',
          message: 'Are you sure you want to save these details?',
          variant: CONFIRM_VARIANTS.SAVE,
        };
      
      case 'skip-details':
        return {
          title: 'Skip Details',
          message: 'Are you sure you want to skip adding details?',
          subtitle: 'Item will be saved with default values',
          variant: CONFIRM_VARIANTS.SAVE,
        };
      
      case 'unsaved-changes':
        return {
          title: 'Info',
          message: 'Are you sure you want to leave without saving changes?',
          subtitle: 'Unsaved changes will be lost',
          variant: CONFIRM_VARIANTS.UNSAVED,
        };
      
      case 'save-changes':
        return {
          title: 'Save Changes',
          message: 'Are you sure you want to save these changes?',
          variant: CONFIRM_VARIANTS.SAVE,
        };
      
      case 'error':
        return {
          title: data?.title || 'Error',
          message: data?.message || 'Something went wrong',
          variant: CONFIRM_VARIANTS.DELETE, // Uses the red alert style
        };
      
      default:
        return {
          title: data?.title || '',
          message: data?.message || '',
          variant: data?.variant || CONFIRM_VARIANTS.DELETE,
        };
    }
  }, [confirmModal.type, confirmModal.data]);

  return {
    // Regular modal methods
    openModal,
    closeModal,
    isModalOpen,
    getModalData,
    closeAllModals,
    
    // Confirmation modal methods
    openConfirmModal,
    closeConfirmModal,
    handleConfirm,
    isConfirmModalOpen: confirmModal.isOpen,
    confirmModalConfig,
  };
};

export default useModal;

