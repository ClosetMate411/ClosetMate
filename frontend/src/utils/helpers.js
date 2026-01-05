/**
 * Utility functions for the application
 */

/**
 * Transforms store items to display format
 * @param {Array} items - Items from store or backend
 * @returns {Array} - Transformed items for display
 */
export const transformItemsForDisplay = (items) => {
  // Safety check: ensure items is an array
  if (!Array.isArray(items)) {
    console.warn('transformItemsForDisplay: items is not an array', items);
    return [];
  }
  
  return items.map((item) => {
    // Use processed image (PNG with background removed) as primary
    const imageUrl = item.image_url || item.original_image_url || item.image || item.preview;
    
    return {
      image: imageUrl,
      // Handle backend (item_name), local (itemName), or fallback (name)
      name: item.item_name || item.itemName || item.name || 'Untitled',
      weather: item.weather || item.season || item.item_weather || 'Untitled',
      id: item.id || item._id
    };
  });
};

/**
 * Creates an image preview URL from a file
 * @param {File} file - The image file
 * @returns {string} - Object URL for preview
 */
export const createImagePreview = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Revokes an image preview URL to free memory
 * @param {string} url - The URL to revoke
 */
export const revokeImagePreview = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Validates if a string is empty or whitespace
 * @param {string} str - String to validate
 * @returns {boolean} - True if empty/whitespace
 */
export const isEmpty = (str) => {
  return !str || str.trim().length === 0;
};

/**
 * Gets a safe value or default
 * @param {any} value - The value to check
 * @param {any} defaultValue - Default if value is falsy
 * @returns {any} - Value or default
 */
export const getValueOrDefault = (value, defaultValue) => {
  return value || defaultValue;
};

/**
 * Validates item name
 * @param {string} name - Item name to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateItemName = (name) => {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Item name cannot be empty' };
  }
  
  if (name.trim().length < 2) {
    return { isValid: false, error: 'Item name must be at least 2 characters' };
  }
  
  if (name.trim().length > 50) {
    return { isValid: false, error: 'Item name must be less than 50 characters' };
  }
  
  // Check for invalid characters (only allow letters, numbers, spaces, and basic punctuation)
  const validNamePattern = /^[a-zA-Z0-9\s\-',.()]+$/;
  if (!validNamePattern.test(name)) {
    return { isValid: false, error: 'Item name contains invalid characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Robust image validation for format (JPEG, PNG, HEIC) and size (10MB)
 * @param {File} file - File object to validate
 * @returns {Object} - { isValid: boolean, error: string, code: string }
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'No file selected', code: 'no-file' };
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];
  const fileName = file.name.toLowerCase();
  
  const isValidFormat = allowedTypes.includes(file.type) || allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!isValidFormat) {
    return { 
      isValid: false, 
      error: 'Please upload a JPEG, PNG, or HEIC image.', 
      code: 'file-invalid-type' 
    };
  }

  const maxSizeInBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return { 
      isValid: false, 
      error: 'File is too large. Maximum size is 10MB.', 
      code: 'file-too-large' 
    };
  }

  return { isValid: true, error: null, code: null };
};

