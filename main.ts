// GIBLET'S GREAT ESCAPE — the hand-in program (Node 22, standard library only).
//
// It gathers the entry — the playable game under game/ and the screenshots under
// screenshots/ — into the output directory and writes dossier.json, the summary
// the judge reads, using the kit's vendored dossier library.
//
// The grader runs this with /output as the destination; outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for it:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The entry is deterministic: the same repository always hands in the same bytes,
// so the two grading runs agree.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) {
  throw new Error(`game/ is missing from the repository root: ${gameDir}`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the game cannot open without it.');
}

// Start from a clean slate so a stale file from an earlier run can never leak in.
// /output is the grader's own mount: the harness creates it (owned by root) and the
// program runs as an unprivileged user (65534), so removing the directory itself
// fails with EPERM and the run exits 1 before handing anything in. Empty its
// contents instead and leave the directory in place.
mkdirSync(outDir, { recursive: true });
if (!statSync(outDir).isDirectory()) {
  throw new Error(`output path is not a directory: ${outDir}`);
}
for (const name of readdirSync(outDir)) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}

// The game, exactly as it ships: static files, no build step, no network.
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

// The screenshots, in name order; the first is the cover the judge sees largest.
// The competition wants 3 or 4: refuse to hand in a set that would fail the gate.
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}
const shotFiles = readdirSync(join(outDir, 'screenshots'))
  .filter((name) => !name.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`screenshots/ holds ${shotFiles.length} images; the competition wants 3 or 4.`);
}
// The gate's own shape rules, checked here so a bad set never reaches it:
// each screenshot a whole PNG or JPEG, at most 256 KiB, long side at most
// 1280 px and short side at least 480 px.
for (const name of shotFiles) {
  const file = join(outDir, 'screenshots', name);
  const size = statSync(file).size;
  if (size > 262144) {
    throw new Error(`screenshots/${name} is ${size} bytes; the gate allows at most 256 KiB.`);
  }
  const [width, height] = imageSize(file);
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  if (longSide > 1280 || shortSide < 480) {
    throw new Error(`screenshots/${name} is ${width}x${height}; the gate wants long side at most 1280 and short side at least 480.`);
  }
}

/** Pixel size of a PNG or JPEG file, read from its header (standard library only). */
function imageSize(file: string): [number, number] {
  const buf = readFileSync(file);
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      const length = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return [buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5)];
      }
      offset += 2 + length;
    }
  }
  throw new Error(`screenshots/${file.split('/').pop()} is neither a PNG nor a JPEG the gate would accept.`);
}

// The dossier: game block, sources in load order, and the screenshots, capped
// to the scorer's own limits (see the competition's gate).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true }).length;
console.log(`GIBLET'S GREAT ESCAPE handed in: game/ (${gameFiles} entries) + ${shotFiles.length} screenshots + dossier.json -> ${outDir}`);
