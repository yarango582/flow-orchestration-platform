import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/flows': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/flows/, '/api/v1')
      },
      '/api/scheduler': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scheduler/, '/api/v1')
      },
      '/api/catalog': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/catalog/, '/api/v1')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})