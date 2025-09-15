import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist/renderer/main_window',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/index.html',
    },
  },
});