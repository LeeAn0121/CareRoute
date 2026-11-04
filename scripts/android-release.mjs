import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const credentialsFile = join(homedir(), '.android', 'careroute-signing', 'upload-key.json');
const saved = existsSync(credentialsFile) ? JSON.parse(readFileSync(credentialsFile, 'utf8')) : {};
const signingEnvironment = { ...saved, ...process.env };

for (const key of ['CAREROUTE_KEYSTORE_PATH', 'CAREROUTE_KEYSTORE_PASSWORD', 'CAREROUTE_KEY_ALIAS', 'CAREROUTE_KEY_PASSWORD']) {
  if (!signingEnvironment[key]) throw new Error(`Missing ${key}: a signed upload bundle requires your upload key.`);
}
const result = spawnSync('./gradlew', ['bundleRelease'], { cwd: 'android', env: signingEnvironment, stdio: 'inherit' });
process.exit(result.status ?? 1);
