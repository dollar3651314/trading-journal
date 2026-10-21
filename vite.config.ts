import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/web',
  publicDir: false,
  build: { outDir: '../../dist', emptyOutDir: true },
  define: { __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'local') },
});
