import { create } from 'zustand';
import apiService from '../services/api.service';
import { transformItemsForDisplay } from '../utils/helpers';

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

const sortNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.createdAt || a?.updated_at || a?.updatedAt || 0).getTime();
    const bTime = new Date(b?.created_at || b?.createdAt || b?.updated_at || b?.updatedAt || 0).getTime();
    return bTime - aTime;
  });

const useWardrobeStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  openModal: null,
  currentItemId: null,
  aiLabels: {},

  setOpenModal: (modalName) => set({ openModal: modalName }),
  setCurrentItemId: (id) => set({ currentItemId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setAiLabels: (labels) => set((state) => ({ aiLabels: { ...state.aiLabels, ...labels } })),

  fetchItems: async () => {
    if (get().loading || get().items.length > 0) return get().items;
    set({ loading: true, error: null });
    try {
      const response = await withTimeout(
        apiService.getAllItems(),
        12000,
        'Fetching wardrobe timed out. Please check your connection and retry.'
      );

      let rawItems = [];
      if (response && response.success && Array.isArray(response.data)) {
        rawItems = response.data;
      } else if (Array.isArray(response)) {
        rawItems = response;
      } else if (response?.items) {
        rawItems = response.items;
      }

      if (__DEV__ && rawItems.length > 0) {
        console.log('[WARDROBE DEBUG] Sample raw item keys:', Object.keys(rawItems[0]));
        console.log('[WARDROBE DEBUG] Sample raw item:', JSON.stringify(rawItems[0], null, 2));
      }

      const normalizedItems = sortNewestFirst(transformItemsForDisplay(rawItems));
      set({ items: normalizedItems, loading: false });
      return normalizedItems;
    } catch (error) {
      set({ error: error.message, loading: false, items: [] });
      throw error;
    }
  },

  addItem: async (imageFile, itemName = '', weather = '') => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.createItem({
        name: itemName,
        season: weather,
        image: imageFile,
      });

      const rawItem = response.data || response;
      const newItem = transformItemsForDisplay([rawItem])[0];

      set((state) => ({
        items: Array.isArray(state.items) ? [newItem, ...state.items] : [newItem],
        loading: false,
      }));

      return newItem.id;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateItem: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedData = {};
      if (updates.itemName !== undefined) updatedData.name = updates.itemName;
      if (updates.weather !== undefined) updatedData.season = updates.weather;
      if (updates.file) updatedData.image = updates.file;
      if (updates.name !== undefined) updatedData.name = updates.name;
      if (updates.season !== undefined) updatedData.season = updates.season;
      if (updates.image) updatedData.image = updates.image;

      const response = await apiService.updateItem(id, updatedData);
      const rawItem = response.data || response;
      const updatedItem = transformItemsForDisplay([rawItem])[0];

      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updatedItem : item)),
        loading: false,
      }));

      return updatedItem;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  removeItem: async (id) => {
    set({ loading: true, error: null });
    try {
      await apiService.deleteItem(id);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearItems: () => {
    set({ items: [], error: null });
  },
}));

export default useWardrobeStore;
