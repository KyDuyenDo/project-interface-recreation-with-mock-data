import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', 
    port: 5173,  
  },
  optimizeDeps: {
    include: [
      '@fortune-sheet/react',
      '@fortune-sheet/core',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/@fortune-sheet/, /node_modules/],
    },
  },
})

