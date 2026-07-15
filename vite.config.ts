import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Proxy al dataset oficial de precios en surtidor (datos.energia.gob.ar).
// Evita mixed-content (la API es http) y deja la base misma-origen, igual que
// la expondría un backend propio en producción.
const energiaProxy = {
  '/api/energia': {
    target: 'http://datos.energia.gob.ar',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/energia/, ''),
  },
};

// App multi-página: cada pantalla del colorway Crepúsculo es un entrypoint HTML.
export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  server: { proxy: energiaProxy },
  preview: { proxy: energiaProxy },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        resultado: resolve(__dirname, 'src/resultado.html'),
        selector: resolve(__dirname, 'src/selector.html'),
      },
    },
  },
});
