import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // THAM: Fix Firebase Auth popup (COOP/COEP)
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    }
  },

  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          xlsx: ['xlsx'],
          ui: ['lucide-react', 'clsx', 'tailwind-merge', 'react-hot-toast']
        }
      }
    }
  }
})

