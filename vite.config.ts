import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        sourcemap: false,
        minify: 'esbuild',
        esbuild: {
          drop: ['console', 'debugger']
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // PILAR 6: Enable Web Workers
      worker: {
        format: 'es',
        plugins: () => [react()]
      },
      optimizeDeps: {
        exclude: ['workers/planningWorker.ts']
      }
    };
});
