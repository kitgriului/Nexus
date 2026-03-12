import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['all', '.manus.computer'],
    proxy: {
      '^/api/': {
        target: process.env.VITE_API_TARGET || 'http://gateway:8000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      }
    }
  },
  plugins: [react()]
});
