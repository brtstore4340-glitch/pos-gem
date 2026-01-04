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
})

