import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          excel: ['xlsx'],
          pdf: ['pdfjs-dist'],
          office: ['docxtemplater', 'pizzip', 'mammoth'],
          ui: ['lucide-react', 'clsx'],
        },
      },
    },
  },
})
