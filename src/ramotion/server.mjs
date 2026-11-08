// =========================================================
// Ramotion — servidor do Umbrel
// Serve o app e guarda os dados (orçamentos, clientes, contratos...)
// em /data/state.json, para todos os aparelhos verem a mesma coisa.
// Sem dependências: só Node.js 18+.
// =========================================================
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '127.0.0.1';
const DATA = process.env.RAMOTION_DATA || path.join(DIR, 'data');
const STATE = path.join(DATA, 'state.json');
const BACKUPS = path.join(DATA, 'backups');

await mkdir(BACKUPS, { recursive: true });

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, fail) => {
  const ch = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > 80e6) { fail(new Error('Dados grandes demais')); req.destroy(); } else ch.push(c); });
  req.on('end', () => ok(Buffer.concat(ch).toString('utf8')));
  req.on('error', fail);
});

// Uma cópia de segurança por dia (guarda as 30 mais recentes)
let lastBackupDay = '';
async function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackupDay) return;
  lastBackupDay = day;
  try {
    await copyFile(STATE, path.join(BACKUPS, `state-${day}.json`));
    const { readdir, unlink } = await import('node:fs/promises');
    const files = (await readdir(BACKUPS)).filter(f => f.endsWith('.json')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 30))) await unlink(path.join(BACKUPS, f)).catch(() => {});
  } catch { /* ainda não existe state.json */ }
}

let writing = Promise.resolve();

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/api/state' && req.method === 'GET') {
      try { return send(res, 200, await readFile(STATE)); }
      catch { return send(res, 200, 'null'); }
    }
    if (p === '/api/state' && req.method === 'PUT') {
      const body = await readBody(req);
      JSON.parse(body); // só aceita JSON válido
      writing = writing.then(async () => {
        await dailyBackup();
        const tmp = STATE + '.tmp';
        await writeFile(tmp, body);
        await rename(tmp, STATE);
      });
      await writing;
      return send(res, 200, { ok: true, savedAt: Date.now() });
    }
    if (p === '/api/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      return send(res, 200, await readFile(path.join(DIR, 'ramotion.html')), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/icon.png') {
      try { return send(res, 200, await readFile(path.join(DIR, 'icon.png')), 'image/png'); }
      catch { return send(res, 404, { error: 'sem ícone' }); }
    }
    send(res, 404, { error: 'não encontrado' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, HOST, () => console.log(`Ramotion em http://${HOST}:${PORT}`));
