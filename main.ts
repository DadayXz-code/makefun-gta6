// Puerto Luna — the entry program for make.fun's "Make GTA 6" bounty.
//
// This is the program the grader runs (Node 22, standard library only, no
// network). It hands the game in by copying the game's static files and
// screenshots into the output directory and writing the dossier the kit's
// vendored library builds from them. Run it locally with
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// and in the grader it writes to /output instead.
//
// The dossier is a pure function of the files copied in, so two runs write
// byte-identical output — the grader runs this program twice and requires
// the same bytes both times.
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is the repository root: the game and the
// screenshots sit beside it.
const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(REPO_ROOT, 'game');
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');

// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The gate's caps, exactly as the bounty states them: the text cap shapes
// the dossier, the rest only refuse an entry past them.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function mustExistDirectory(path, what) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    fail(`no ${what} directory at ${path}`);
  }
  if (!stats.isDirectory()) fail(`${what} at ${path} is not a directory`);
}

function main() {
  mustExistDirectory(GAME_DIR, 'game/');
  mustExistDirectory(SHOTS_DIR, 'screenshots/');

  // Start from an empty output directory so nothing stale survives from
  // an earlier run: the dossier must describe exactly what is handed in.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUTPUT_DIR, 'game'), { recursive: true });
  mkdirSync(join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  cpSync(GAME_DIR, join(OUTPUT_DIR, 'game'), { recursive: true });
  cpSync(SHOTS_DIR, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  const dossierPath = join(OUTPUT_DIR, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  // Read the dossier back and check it is what the library promised:
  // the right schema, and at least the screenshots the game ships with.
  const written = JSON.parse(readFileSync(dossierPath, 'utf8'));
  if (written.schema !== 'makefun/dossier/v1') fail(`dossier.json has schema ${written.schema}`);
  if (!Array.isArray(written.images) || written.images.length < 3) {
    fail(`dossier.json holds ${written.images?.length ?? 0} images, expected 3 or 4`);
  }
  // Each image in the dossier must be exactly the screenshot file on
  // disk, by name and by hash — a stale or swapped image fails the run.
  for (const image of written.images) {
    const file = join(OUTPUT_DIR, 'screenshots', image.name);
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (hash !== image.sha256) fail(`dossier image ${image.name} does not match ${file}`);
  }
  console.log(
    `Puerto Luna handed in: ${written.images.length} screenshots, ` +
      `dossier ${dossier.length} bytes -> ${dossierPath}`,
  );
}

main();
