import { create } from 'zustand';
import apiService from '../services/api.service';
import { transformItemsForDisplay } from '../utils/helpers';

const useWardrobeStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  openModal: null, // null | 'upload' | 'details'
  currentItemId: null,
  
  setOpenModal: (modalName) => set({ openModal: modalName }),
  setCurrentItemId: (id) => set({ currentItemId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  // ==================== Fetch Items ====================
  
  /**
   * Fetch all items from backend
   */
  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.getAllItems();
      
      // Handle different response formats and normalize data
      let rawItems = [];
      if (Array.isArray(response)) {
        rawItems = response;
      } else if (response?.items) {
        rawItems = response.items;
      } else if (response?.data) {
        rawItems = response.data;
      }
      
      const normalizedItems = transformItemsForDisplay(rawItems);
      set({ items: normalizedItems, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false, items: [] });
      console.error('Failed to fetch items:', error);
    }
  },
  
  // ==================== Add Item ====================
  
  /**
   * Add new item to backend
   * @param {File} imageFile - Image file
   * @param {string} itemName - Item name
   * @param {string} season - Season
   */
  addItem: async (imageFile, itemName = 'Untitled', weather = 'Untitled') => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.createItem({
        name: itemName,
        season: weather, // Backend still expects 'season'
        image: imageFile
      });
      
      const newItem = transformItemsForDisplay([response.data?.data || response.data || response])[0];
      
      set((state) => ({
        items: Array.isArray(state.items) ? [...state.items, newItem] : [newItem],
        loading: false
      }));
      
      return newItem.id;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to add item:', error);
      throw error;
    }
  },
  
  // ==================== Update Item ====================
  
  /**
   * Update existing item
   * @param {string} id - Item ID
   * @param {Object} updates - Updates object { itemName, season, file }
   */
  updateItem: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedData = {};
      if (updates.itemName !== undefined) updatedData.name = updates.itemName;
      if (updates.weather !== undefined) updatedData.season = updates.weather;
      if (updates.file) updatedData.image = updates.file;
      
      const response = await apiService.updateItem(id, updatedData);
      const updatedItem = transformItemsForDisplay([response.data?.data || response.data || response])[0];
      
      set((state) => ({
        items: state.items.map(item => item.id === id ? updatedItem : item),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to update item:', error);
      throw error;
    }
  },
  
  // ==================== Remove Item ====================
  
  /**
   * Delete item from backend
   * @param {string} id - Item ID
   */
  removeItem: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiService.deleteItem(id);
      
      set((state) => ({
        items: state.items.filter(item => item.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to delete item:', error);
      throw error;
    }
  },
  
  // ==================== Image Processing ====================
  
  /**
   * Process image (background removal, etc.)
   * @param {File} imageFile - Image file to process
   */
  processImage: async (imageFile) => {
    set({ loading: true, error: null });
    try {
      const result = await apiService.processImage(imageFile);
      set({ loading: false });
      return result;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to process image:', error);
      throw error;
    }
  },
  
  // ==================== Clear Items ====================
  
  clearItems: () => {
    set({ items: [], error: null });
  }
}));

export default useWardrobeStore;
