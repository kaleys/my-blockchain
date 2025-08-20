import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 导入 Tailwind Vite 插件

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()], // 添加插件到 plugins 数组
  define: {
    global: 'globalThis',
    Buffer: ['buffer', 'Buffer'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})