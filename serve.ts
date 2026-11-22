// A small static server for playing Puerto Luna locally (Node 22,
// standard library only). Run `node serve.ts` and open
// http://localhost:8080 — it serves game/ and nothing else, with no build
// step. This is a development convenience, not a server for the internet:
// it only listens on localhost, refuses paths that escape game/, and
// sends no-store so a changed file is never cached.
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const wantedPort = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const PORT = Number.isInteger(wantedPort) && wantedPort > 0 && wantedPort < 65536 ? wantedPort : 8080;

// Content types a browser game needs; anything else is an octet stream.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function answer(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body) });
  response.end(body);
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    answer(response, 400, 'bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Join onto the game root and refuse anything that climbs out of it.
  const target = resolve(join(GAME_ROOT, `.${sep}${pathname.replace(/^\/+/, '')}`));
  if (target !== GAME_ROOT && !target.startsWith(GAME_ROOT + sep)) {
    answer(response, 403, 'forbidden');
    return;
  }
  let body;
  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
    body = readFileSync(target);
  } catch {
    answer(response, 404, 'not found');
    return;
  }
  const headers = {
    'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  };
  // A HEAD request gets the headers and no body.
  if (request.method === 'HEAD') {
    response.writeHead(200, headers);
    response.end();
    return;
  }
  response.writeHead(200, headers);
  response.end(body);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Puerto Luna: game/ is on http://localhost:${PORT}`);
});
