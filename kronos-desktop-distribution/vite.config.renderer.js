import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react()
  ],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        external: ['electron', ...Object.keys(require.cache)]
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  preview: {
    port: 5174
  }
});