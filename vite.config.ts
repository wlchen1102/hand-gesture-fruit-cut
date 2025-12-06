import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 关键配置：设置为相对路径 './'，这样无论你的 GitHub 仓库叫什么名字，资源都能正确加载
  base: './',
  build: {
    outDir: 'dist',
  }
});