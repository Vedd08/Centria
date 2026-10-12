/**
 * [TEST DATA] Frontend for the isolated QA environment: same app, port 3100, API proxied
 * to the QA backend on 4100. Lives outside frontend/ so the app's own vite.config.ts is
 * untouched. Start with:  node test-data/derm-qa/tools/start-frontend.mjs
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'frontend');
const req = createRequire(path.join(frontend, 'package.json'));
const { default: react } = await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href);

export default {
  root: frontend,
  plugins: [react()],
  server: { port: 3100, strictPort: true, proxy: { '/api': { target: 'http://localhost:4100', changeOrigin: true } } },
};
