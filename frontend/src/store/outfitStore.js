import { create } from 'zustand';
import apiService from '../services/api.service';

const useOutfitStore = create((set, get) => ({
  outfits: [],
  generatedOutfits: [],
  loading: false,
  error: null,
  stats: null,
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  fetchOutfits: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.getOutfits();
      const outfits = response.data || [];
      set({ outfits, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to fetch outfits:', error);
    }
  },
  
  generateOutfits: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.generateOutfits(params);
      const generatedOutfits = response.data?.outfits || [];
      set({ generatedOutfits, loading: false });
      return generatedOutfits;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to generate outfits:', error);
      throw error;
    }
  },
  
  saveOutfit: async (outfitData) => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.saveOutfit(outfitData);
      const savedOutfit = response.data;
      set((state) => ({
        outfits: [savedOutfit, ...state.outfits],
        loading: false
      }));
      return savedOutfit;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Failed to save outfit:', error);
      throw error;
    }
  },
  
  toggleFavorite: async (id) => {
    try {
      const response = await apiService.toggleFavoriteOutfit(id);
      const updated = response.data;
      set((state) => ({
        outfits: state.outfits.map(o => o.id === id ? { ...o, is_favorite: updated.is_favorite } : o)
      }));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  },
  
  deleteOutfit: async (id) => {
    try {
      await apiService.deleteOutfit(id);
      set((state) => ({
        outfits: state.outfits.filter(o => o.id !== id)
      }));
    } catch (error) {
      console.error('Failed to delete outfit:', error);
      throw error;
    }
  },
  
  fetchStats: async () => {
    try {
      const response = await apiService.getWardrobeStats();
      set({ stats: response.data });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },

  clearGenerated: () => set({ generatedOutfits: [] })
}));

export default useOutfitStore;
