import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/Test/',  // ***IMPORTANT for GitHub Pages***
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    open: true,
    proxy: {
      '/api': {
        target: 'https://api.stemverse.api/OCRtest',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist', // Vite default (works with gh-pages -d dist)
  },
});
