#!/usr/bin/env node
/** [TEST DATA] Runs the frontend on http://localhost:3100 against the QA backend (4100). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { REPO } from './env.mjs';

const frontend = path.join(REPO, 'frontend');
const vite = path.join(frontend, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [vite, '--config', path.join(REPO, 'test-data', 'derm-qa', 'tools', 'vite.qa.config.mjs')], { cwd: frontend, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
