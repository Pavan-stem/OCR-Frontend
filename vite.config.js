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
      host: '0.0.0.0',  // Accept connections from all network interfaces
      port: 5173,       // Make port explicit
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '192.168.1.19',   // Current IP
        '192.168.1.*',    // Allow any 192.168.1.x
      ],
      proxy: {
        '/api': {
          target: 'http://localhost:5004/OCRtest',
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
