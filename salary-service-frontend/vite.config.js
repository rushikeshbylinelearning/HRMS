import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    tailwindcss(),
  ],
  server: {
    port: 5174,
    proxy: {
      // Dev proxy: forwards /api/* and /share/* to salary-service backend on 3012
      '/api': {
        target: 'http://127.0.0.1:3012',
        changeOrigin: true,
        secure: false,
        // Rewrite cookie domain so httpOnly refreshToken cookie works under localhost
        cookieDomainRewrite: { '127.0.0.1': 'localhost', '*': '' },
      },
      '/share': {
        target: 'http://127.0.0.1:3012',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        chunkFileNames:  'assets/js/[name]-[hash].js',
        entryFileNames:  'assets/js/[name]-[hash].js',
        assetFileNames:  'assets/[ext]/[name]-[hash][extname]',
      },
    },
  },
});
