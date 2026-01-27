import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'github';

  return {
    base: isGitHubPages ? '/OCR-Frontend/' : '/', // '/OCR-Frontend/' for GitHub Pages, '/' for server
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      open: true,
      host: '0.0.0.0',  // Accept connections from all network interfaces
      port: 5173,       // Make port explicit
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '192.168.1.6',    // Your IP - add this
        '192.168.1.*',    // Allow any 192.168.1.x
      ],
      proxy: {
        '/api': {
          target: 'https://api.stemverse.api/OCR',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist', // Vite default (works with gh-pages -d dist)
    },
  };
});
