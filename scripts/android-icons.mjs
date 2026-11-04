import sharp from 'sharp';
import { readFile, readdir } from 'node:fs/promises';

const resourceRoot = 'android/app/src/main/res';
const logo = await readFile('public/logo.svg');
const scales = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(scales)) {
  await sharp(logo).resize(Math.round(48 * scale), Math.round(48 * scale)).png().toFile(`${resourceRoot}/mipmap-${density}/ic_careroute.png`);
}
// Rasterize the existing vector logo for pre-Android 12 splash resources.
// Keeping density/orientation dimensions avoids changing native layout sizing.
for (const folder of await readdir(resourceRoot)) {
  if (!folder.startsWith('drawable')) continue;
  const path = `${resourceRoot}/${folder}/splash.png`;
  let metadata;
  try { metadata = await sharp(path).metadata(); } catch { continue; }
  const scale = scales[folder.split('-').at(-1)] || 1;
  const size = Math.min(Math.round(80 * scale), Math.min(metadata.width, metadata.height));
  const icon = await sharp(logo).resize(size, size).png().toBuffer();
  await sharp({ create: { width: metadata.width, height: metadata.height, channels: 4, background: '#12203D' } })
    .composite([{ input: icon, gravity: 'centre' }]).png().toFile(path);
}
console.log('CareRoute legacy launcher and splash assets generated from public/logo.svg');
