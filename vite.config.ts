import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Proxies misma-origen, igual que los expondría un backend propio en producción:
//  - /api/energia  → dataset oficial de precios en surtidor (evita mixed-content).
//  - /api/tollguru → API de peajes TollGuru, con la API key inyectada server-side
//    desde la env TOLLGURU_API_KEY (NO se expone en el bundle del cliente).
const apiProxy = {
  '/api/energia': {
    target: 'http://datos.energia.gob.ar',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/energia/, ''),
  },
  '/api/tollguru': {
    target: 'https://apis.tollguru.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/tollguru/, ''),
    headers: { 'x-api-key': process.env.TOLLGURU_API_KEY ?? '' },
  },
};

// App multi-página: cada pantalla del colorway Crepúsculo es un entrypoint HTML.
export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        resultado: resolve(__dirname, 'src/resultado.html'),
        selector: resolve(__dirname, 'src/selector.html'),
        comoFunciona: resolve(__dirname, 'src/como-funciona.html'),
        precios: resolve(__dirname, 'src/precios.html'),
        misViajes: resolve(__dirname, 'src/mis-viajes.html'),
      },
    },
  },
});
