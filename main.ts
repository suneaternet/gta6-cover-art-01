// Vice Cover Studio — GTA-style cover art maker entrypoint.
//
// The binary assets (screenshots, fonts, sample photos) are stored in this
// repository as single-line base64 text under assets/. This program decodes
// them back into their binary files, then hands in app/ + screenshots/ with
// a dossier built by vendor/makefun-app.ts.

import { buildDossier } from './vendor/makefun-app.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname;

// [base64 text asset, binary file it decodes to]
const ASSETS: Array<[string, string]> = [
  ['assets/1-cover.jpg.b64', 'screenshots/1-cover.jpg'],
  ['assets/2-editor.jpg.b64', 'screenshots/2-editor.jpg'],
  ['assets/3-cover-wide.jpg.b64', 'screenshots/3-cover-wide.jpg'],
  ['assets/4-cover-portrait.jpg.b64', 'screenshots/4-cover-portrait.jpg'],
  ['assets/Anton-Regular.woff2.b64', 'app/fonts/Anton-Regular.woff2'],
  ['assets/Archivo-Variable.woff2.b64', 'app/fonts/Archivo-Variable.woff2'],
  ['assets/sunset-rider.jpg.b64', 'app/samples/sunset-rider.jpg'],
  ['assets/beach-duo.jpg.b64', 'app/samples/beach-duo.jpg'],
  ['assets/neon-street.jpg.b64', 'app/samples/neon-street.jpg'],
];

// The bounty gate's caps, passed whole to buildDossier.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function fail(message: string): never {
  throw new Error(`gta6-cover-art-01: ${message}`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR;
if (!outDir) fail('MAKEFUN_OUTPUT_DIR is not set');

// 1. Decode every base64 text asset back to its binary file.
for (const [encoded, target] of ASSETS) {
  const encodedPath = join(ROOT, encoded);
  if (!existsSync(encodedPath)) fail(`missing asset ${encoded}`);
  const text = readFileSync(encodedPath, 'utf8').trim();
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length === 0) fail(`asset ${encoded} decoded to 0 bytes`);
  if (target.endsWith('.jpg') && (bytes[0] !== 0xff || bytes[1] !== 0xd8)) {
    fail(`asset ${encoded} decoded to a file that is not a JPEG`);
  }
  if (target.endsWith('.woff2') && bytes.subarray(0, 4).toString('ascii') !== 'wOF2') {
    fail(`asset ${encoded} decoded to a file that is not a WOFF2 font`);
  }
  const targetPath = join(ROOT, target);
  mkdirSync(join(ROOT, target.split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(targetPath, bytes);
}

// 2. Sanity checks on the app and its screenshots.
const indexHtml = join(ROOT, 'app', 'index.html');
if (!existsSync(indexHtml)) fail('app/index.html is missing');
const shots = readdirSync(join(ROOT, 'screenshots')).filter((name) => !name.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
}

// 3. Hand in app/ + screenshots/ to the output directory.
try {
  mkdirSync(outDir, { recursive: true });
} catch (err) {
  fail(`cannot create output directory ${outDir}: ${(err as Error).message}`);
}
cpSync(join(ROOT, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(ROOT, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// 4. Write the dossier the scorer rebuilds and compares byte for byte.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));

const dossierBytes = statSync(join(outDir, 'dossier.json')).size;
console.log(`handed in: app/ + ${shots.length} screenshots + dossier.json (${dossierBytes} bytes)`);
