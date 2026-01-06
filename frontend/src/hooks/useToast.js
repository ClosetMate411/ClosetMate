import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Toast state and methods
 */
const useToast = () => {
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Show the toast
    setToast({
      isVisible: true,
      message,
      type
    });

    // Auto-hide after 3 seconds
    timerRef.current = setTimeout(() => {
      setToast(prev => ({
        ...prev,
        isVisible: false
      }));
    }, 3000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showSuccess = useCallback((message) => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message) => {
    showToast(message, 'error');
  }, [showToast]);

  return useMemo(() => ({
    toast,
    showSuccess,
    showError
  }), [toast, showSuccess, showError]);
};

export default useToast;
