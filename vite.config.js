import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync } from 'fs';

const pages = { main: 'index.html', modern: 'modern/index.html', pixel: 'pixel/index.html' };
const input = Object.fromEntries(Object.entries(pages).filter(([, p]) => existsSync(resolve(__dirname, p))).map(([k, p]) => [k, resolve(__dirname, p)]));

export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
  build: { rollupOptions: { input }, chunkSizeWarningLimit: 1500 },
});
