import { cp, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await access('out/index.html');
await mkdir('mobile-www', { recursive: true });
// Keep the web basePath so map links, icons and notification URLs resolve identically.
await cp('out', 'mobile-www/CareRoute', { recursive: true, force: true });
await cp('out/index.html', 'mobile-www/index.html');
