import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shared UMD files (/shared) are written for both Node and the browser. Vite would treat them as
// CommonJS; this plugin makes them attach to `window` (RCMPConstants / RCMPValidators / RCMPRules) instead.
const sharedUmd = () => ({
  name: 'rcmp-shared-umd',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]shared[\\/](constants|validators|rules)\.js$/.test(id)) return null;
    return { code: code.replace("typeof module === 'object' && module.exports", 'false').replace("typeof self !== 'undefined' ? self : this", 'window'), map: null };
  }
});

// The API (Express) runs on :3000; during `npm run dev` Vite proxies /api to it.
export default defineConfig({
  plugins: [sharedUmd(), react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' }, fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false }
});
