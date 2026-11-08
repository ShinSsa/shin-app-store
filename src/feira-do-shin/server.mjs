// =========================================================
// Feira do Shin — servidor do Umbrel
// Serve o app e guarda listas, produtos, locais e preços em /data/state.json,
// para o iPhone, o Mac e qualquer aparelho da rede verem a mesma coisa.
// Cada gravação ganha um número de versão (savedAt): um aparelho só grava por cima
// se viu a versão mais recente; senão recebe 409 e o app pergunta qual manter.
// Sem dependências: só Node.js 18+.
// =========================================================
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, copyFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8794);
const HOST = process.env.HOST || '127.0.0.1';
const DATA = process.env.FEIRA_DATA || path.join(DIR, 'data');
const STATE = path.join(DATA, 'state.json');
const BACKUPS = path.join(DATA, 'backups');

await mkdir(BACKUPS, { recursive: true });

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/manifest.json': ['manifest.json', 'application/manifest+json'],
  '/icon-192.png': ['icon-192.png', 'image/png'],
  '/icon-512.png': ['icon-512.png', 'image/png'],
  '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'],
};

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, fail) => {
  const ch = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > 50e6) { fail(new Error('Dados grandes demais')); req.destroy(); } else ch.push(c); });
  req.on('end', () => ok(Buffer.concat(ch).toString('utf8')));
  req.on('error', fail);
});

let current = null; // {savedAt, data}
try { current = JSON.parse(await readFile(STATE, 'utf8')); } catch { current = null; }

// Uma cópia de segurança por dia (guarda as 30 mais recentes)
let lastBackupDay = '';
async function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackupDay || !current) return;
  try {
    await copyFile(STATE, path.join(BACKUPS, `state-${day}.json`));
    lastBackupDay = day;
    const files = (await readdir(BACKUPS)).filter(f => f.endsWith('.json')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 30))) await unlink(path.join(BACKUPS, f)).catch(() => {});
  } catch { /* ainda não existe state.json */ }
}

let writing = Promise.resolve();

http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;

    if (p === '/api/state' && req.method === 'GET') return send(res, 200, current);

    if (p === '/api/state' && req.method === 'PUT') {
      const body = JSON.parse(await readBody(req));
      if (!body || typeof body.data !== 'object' || !Array.isArray(body.data.products)) return send(res, 400, { error: 'formato inválido' });
      let result;
      writing = writing.catch(() => {}).then(async () => {
        const serverAt = current?.savedAt || 0;
        if (!body.force && serverAt && Number(body.base) !== serverAt) { result = [409, current]; return; }
        await dailyBackup();
        const next = { savedAt: Math.max(Date.now(), serverAt + 1), data: body.data };
        const tmp = STATE + '.tmp';
        await writeFile(tmp, JSON.stringify(next));
        await rename(tmp, STATE);
        current = next;
        result = [200, { ok: true, savedAt: next.savedAt }];
      });
      await writing;
      return send(res, result[0], result[1]);
    }

    if (p === '/api/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && FILES[p]) {
      const [file, type] = FILES[p];
      return send(res, 200, await readFile(path.join(DIR, file)), type);
    }
    send(res, 404, { error: 'não encontrado' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, HOST, () => console.log(`Feira do Shin em http://${HOST}:${PORT}`));
