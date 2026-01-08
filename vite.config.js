import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // dist 폴더를 비우지 않음
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'main.js') // js 파일만 번들링
      },
      output: {
        format: 'iife',
        entryFileNames: 'bundle.js',
        inlineDynamicImports: true
      }
    }
  }
});
