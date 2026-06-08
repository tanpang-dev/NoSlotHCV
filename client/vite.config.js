import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies all /mushiking/* (data, images, config, card-feed) to the
// Node server on :3001. In production the Node server serves the built UI and
// these routes itself, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/mushiking': 'http://localhost:3001',
    },
  },
});
