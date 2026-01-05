import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    // Enable minification for production
    minify: 'esbuild',
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI library
          'mantine': ['@mantine/core', '@mantine/hooks', '@mantine/dropzone'],
          // Icons
          'icons': ['@tabler/icons-react', 'lucide-react'],
        }
      }
    },
    // Generate source maps for debugging
    sourcemap: false,
    // Target modern browsers
    target: 'es2020'
  }
})
