import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  const isGitHubPages = mode === 'github';
  const isSMD = mode === 'smd';
  const isDev = command === 'serve';

  let base = '/';
  if (isGitHubPages) base = '/OCR-Frontend/';
  else if (isSMD) base = '/Test/';  // SMD deployment path
  // Dev mode should use root path for proper public asset serving

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      open: true,
      // Listen on all network interfaces to allow mobile/network testing
      host: true, 
      port: 5175,
      strictPort: false, // Fallback to 5176 if 5175 is busy
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '192.168.*',      // Allow any local network IP
      ],
      proxy: {

        '/api': {
          target: 'http://localhost:5004/OCRTest',
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
