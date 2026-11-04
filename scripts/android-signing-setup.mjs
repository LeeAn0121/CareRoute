import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = join(homedir(), '.android', 'careroute-signing');
const credentialsFile = join(directory, 'upload-key.json');
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const keyFile = join(directory, 'upload-key.p12');
if (!existsSync(credentialsFile)) {
  if (existsSync(keyFile)) throw new Error('Existing key found without credentials. Refusing to overwrite it.');
  const password = randomBytes(32).toString('base64url');
  writeFileSync(credentialsFile, JSON.stringify({
    CAREROUTE_KEYSTORE_PATH: keyFile,
    CAREROUTE_KEYSTORE_PASSWORD: password,
    CAREROUTE_KEY_ALIAS: 'careroute-upload',
    CAREROUTE_KEY_PASSWORD: password,
  }, null, 2), { mode: 0o600, flag: 'wx' });
}
const credentials = JSON.parse(readFileSync(credentialsFile, 'utf8'));
if (!existsSync(keyFile)) {
  const result = spawnSync('keytool', ['-genkeypair', '-keystore', keyFile, '-storetype', 'PKCS12', '-alias', credentials.CAREROUTE_KEY_ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=CareRoute Upload, OU=Android, O=CareRoute, C=KR', '-storepass:env', 'CAREROUTE_KEYSTORE_PASSWORD', '-keypass:env', 'CAREROUTE_KEY_PASSWORD'], { env: { ...process.env, ...credentials }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
chmodSync(keyFile, 0o600);
console.log(`Upload key ready: ${keyFile}`);
console.log(`Private signing settings: ${credentialsFile}`);
