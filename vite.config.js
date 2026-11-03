import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['pdfjs-dist', 'pdf-lib'],
          'vendor-docs': ['docx-preview', 'mammoth', 'jszip']
        }
      }
    }
  }
});
