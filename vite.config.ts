import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cloudflare Pages deploys to the root domain, so we don't need relative paths.
  // Default base is '/' which is perfect.
  build: {
    outDir: 'dist',
  }
});