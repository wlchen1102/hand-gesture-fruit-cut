import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/hand-gesture-fruit-cut/', // 新增这一行，仓库名必须和 GitHub 仓库名一致
  build: {
    outDir: 'dist',
  }
});