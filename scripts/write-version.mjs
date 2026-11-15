import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Generate from final package metadata before every deployment/native web build.
const root = new URL('../', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(metadata.version) || !Number.isSafeInteger(metadata.androidVersionCode) || metadata.androidVersionCode <= 0) {
  throw new Error('유효한 앱 버전과 Android 버전 코드가 필요합니다.');
}
await mkdir(new URL('public/', root), { recursive: true });
await writeFile(new URL('public/version.json', root), `${JSON.stringify({ version: metadata.version, androidVersionCode: metadata.androidVersionCode }, null, 2)}\n`);
