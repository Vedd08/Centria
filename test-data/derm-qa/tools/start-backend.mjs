#!/usr/bin/env node
/**
 * [TEST DATA] Runs the private backend build against the QA database on port 4100.
 * Working directory is runtime/, so document uploads land in runtime/uploads/.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { BACKEND, DB_URL, JWT_SECRET, PORT, RUNTIME } from './env.mjs';

const child = spawn(process.execPath, [path.join(RUNTIME, 'dist', 'main.js')], {
  cwd: RUNTIME,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_PATH: path.join(BACKEND, 'node_modules'),
    DATABASE_URL: DB_URL,
    PORT: String(PORT),
    JWT_SECRET,
    TZ: 'Asia/Kolkata',
    NODE_ENV: 'development',
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
