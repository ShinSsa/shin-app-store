// =========================================================
// Estúdio do Shin — servidor local (ponte para o Google)
// Sem dependências: só Node.js 18+ e o Google Cloud CLI (gcloud).
// Usa o login ADC (gcloud auth application-default login),
// então as chamadas usam os créditos da sua conta Google Cloud.
// =========================================================
import http from 'node:http';
import { readFile, stat, writeFile, mkdir, rename, copyFile, unlink, appendFile, access, statfs } from 'node:fs/promises';
import { constants as FS, createWriteStream } from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';                 // no Docker/Umbrel: 0.0.0.0
const DATA = process.env.SHIN_DATA || DIR;                     // onde ficam config.json e a credencial do Google
const IN_DOCKER = !!process.env.SHIN_DATA;
const LOCATION = process.env.GCP_LOCATION || 'global';

const run = (cmd, args) => new Promise((res, rej) =>
  execFile(cmd, args, { timeout: 30000 }, (err, out, errOut) => err ? rej(new Error((errOut || err.message).trim())) : res(String(out).trim())));

// ---------- projeto e token (com cache) ----------
// Login do Google: (1) arquivo de credencial (Umbrel/Docker: enviado pelo app em Ajustes) ou (2) gcloud ADC no Mac
const CRED_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(DATA, 'google.json');
let creds = null;
async function loadCreds() { try { creds = JSON.parse(await readFile(CRED_FILE, 'utf8')); } catch { creds = null; } return creds; }
await loadCreds();
let project = process.env.GCP_PROJECT || '';
async function getProject() {
  if (!project) project = conf.gcpProject || creds?.quota_project_id || creds?.project_id || '';
  if (!project && !creds && !IN_DOCKER) project = await run('gcloud', ['config', 'get-value', 'project']).catch(() => '');
  if (!project || project === '(unset)') { project = ''; throw new Error(creds || IN_DOCKER ? 'Informe o ID do projeto do Google Cloud em Ajustes → Google Gemini.' : 'Projeto não definido. Rode: gcloud config set project SEU_PROJETO'); }
  return project;
}
let billingAccount = process.env.GCP_BILLING_ACCOUNT || '';
let tok = { value: '', exp: 0 };
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function tokenFromCreds(c) {
  const form = c.type === 'service_account'
    ? (() => {
      const now = Math.floor(Date.now() / 1000);
      const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claim = b64u(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: c.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
      const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(c.private_key);
      return { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + b64u(sig) };
    })()
    : { grant_type: 'refresh_token', client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token };
  const r = await fetch(c.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('A credencial do Google foi recusada: ' + (j.error_description || j.error || 'HTTP ' + r.status));
  return { value: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000 };
}
async function getToken() {
  if (tok.value && Date.now() < tok.exp) return tok.value;
  if (creds) { tok = await tokenFromCreds(creds); return tok.value; }
  if (IN_DOCKER) throw new Error('Envie a credencial do Google em Ajustes → Google Gemini.');
  const v = await run('gcloud', ['auth', 'application-default', 'print-access-token']);
  tok = { value: v, exp: Date.now() + 45 * 60 * 1000 };
  return v;
}

// ---------- utilidades HTTP ----------
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Meta', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...CORS }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((res, rej) => { const ch = []; let n = 0; req.on('data', c => { n += c.length; if (n > 60e6) { rej(new Error('Pedido grande demais')); req.destroy(); } else ch.push(c); }); req.on('end', () => res(Buffer.concat(ch).toString('utf8'))); req.on('error', rej); });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.jpeg': 'image/jpeg' };


// ---------- pasta das imagens no disco ----------
// A raiz pode ser qualquer pasta do Mac, de um HD externo (/Volumes/MeuHD/...) ou de
// um compartilhamento de rede já montado no Finder (/Volumes/NomeDoCompartilhamento/...).
const CONF_FILE = path.join(DATA, 'config.json');
let conf = { root: process.env.SHIN_ROOT || (IN_DOCKER ? path.join(DATA, 'imagens') : path.join(os.homedir(), 'Pictures', 'Estúdio do Shin')) };
try { conf = { ...conf, ...JSON.parse(await readFile(CONF_FILE, 'utf8')) }; } catch {}
const saveConf = () => writeFile(CONF_FILE, JSON.stringify(conf, null, 2)).catch(() => {});
// nomes de pasta/arquivo seguros (sem barras, sem começar com ponto)
const clean = s => String(s || '').normalize('NFC').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '-').replace(/^[.\s]+/, '').replace(/\s+$/, '').slice(0, 80) || 'sem-nome';
const cleanRel = rel => String(rel || '').split(/[\/\\]+/).filter(Boolean).map(clean).join('/');
function rootOf(r) {
  const root = path.resolve(String(r || conf.root));
  if (!path.isAbsolute(root) || root === '/') throw new Error('Pasta inválida.');
  return root;
}
function inside(root, rel) {
  const f = path.resolve(root, cleanRel(rel));
  if (f !== root && !f.startsWith(root + path.sep)) throw new Error('Caminho fora da pasta.');
  return f;
}
async function rootStatus(r) {
  const root = rootOf(r);
  const out = { root, exists: false, writable: false };
  try { await mkdir(root, { recursive: true }); out.exists = true; } catch (e) { out.error = /^\/Volumes\//.test(root) ? 'HD ou rede não conectado (' + root.split('/')[2] + ').' : e.message; return out; }
  try { await access(root, FS.W_OK); out.writable = true; } catch { out.error = 'Sem permissão para gravar nessa pasta.'; }
  try { const f = await statfs(root); out.freeGB = Math.round(f.bavail * f.bsize / 1e8) / 10; } catch {}
  return out;
}
async function freeName(dir, name) {
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  for (let i = 1; i < 1000; i++) {
    const n = i === 1 ? name : `${base}-${i}${ext}`;
    try { await access(path.join(dir, n)); } catch { return n; }
  }
  return `${base}-${Date.now()}${ext}`;
}
async function moveFile(from, to) {
  try { await rename(from, to); } catch (e) { if (e.code !== 'EXDEV') throw e; await copyFile(from, to); await unlink(from); }
}
const readRaw = req => new Promise((res, rej) => { const ch = []; let n = 0; req.on('data', c => { n += c.length; if (n > 80e6) { rej(new Error('Arquivo grande demais')); req.destroy(); } else ch.push(c); }); req.on('end', () => res(Buffer.concat(ch))); req.on('error', rej); });
async function disk(u, req, res) {
  const q = u.searchParams;
  if (u.pathname === '/api/disk' && req.method === 'GET') return send(res, 200, await rootStatus(q.get('root') || conf.root));
  if (u.pathname === '/api/disk/root' && req.method === 'POST') {
    const { root } = JSON.parse(await readBody(req) || '{}');
    const st = await rootStatus(root);
    if (st.exists && st.writable) { conf.root = st.root; await saveConf(); }
    return send(res, 200, { ...st, saved: st.exists && st.writable });
  }
  if (u.pathname === '/api/disk/pick' && req.method === 'POST') {
    // janela nativa do macOS para escolher a pasta
    if (IN_DOCKER || process.platform !== 'darwin') return send(res, 200, { path: null, noPicker: true, suggest: ['/umbrel/Estúdio do Shin', '/data/imagens'] });
    try { const p = await run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Escolha a pasta para salvar as imagens do Estúdio do Shin")']); return send(res, 200, { path: p.replace(/\/$/, '') }); }
    catch { return send(res, 200, { path: null }); }
  }
  if (u.pathname === '/api/disk/file' && req.method === 'PUT') {
    const root = rootOf(q.get('root') || conf.root);
    const st = await rootStatus(root); if (!st.exists || !st.writable) return send(res, 503, { error: st.error || 'Pasta indisponível.' });
    const dir = inside(root, q.get('dir') || ''); await mkdir(dir, { recursive: true });
    const name = await freeName(dir, clean(q.get('name') || 'imagem.png'));
    const buf = await readRaw(req);
    await writeFile(path.join(dir, name), buf);
    const rel = path.relative(root, path.join(dir, name)).split(path.sep).join('/');
    const meta = req.headers['x-meta'];
    if (meta) { try { const m = JSON.parse(Buffer.from(String(meta), 'base64').toString('utf8')); await appendFile(path.join(root, 'estudio-do-shin.jsonl'), JSON.stringify({ file: rel, ...m }) + '\n'); } catch {} }
    return send(res, 200, { root, rel });
  }
  if (u.pathname === '/api/disk/move' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req) || '{}');
    const fromRoot = rootOf(b.root), toRoot = rootOf(b.toRoot || b.root);
    const from = inside(fromRoot, b.rel);
    const dir = inside(toRoot, b.toDir || ''); await mkdir(dir, { recursive: true });
    const name = await freeName(dir, path.basename(from));
    await moveFile(from, path.join(dir, name));
    return send(res, 200, { root: toRoot, rel: path.relative(toRoot, path.join(dir, name)).split(path.sep).join('/') });
  }
  if (u.pathname === '/api/disk/trash' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req) || '{}'), root = rootOf(b.root), from = inside(root, b.rel);
    const dir = path.join(root, '_Lixeira'); await mkdir(dir, { recursive: true });
    const name = await freeName(dir, path.basename(from)); await moveFile(from, path.join(dir, name));
    return send(res, 200, { root, rel: '_Lixeira/' + name });
  }
  if (u.pathname === '/api/disk/reveal' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req) || '{}'), root = rootOf(b.root);
    const f = b.rel ? inside(root, b.rel) : root;
    if (process.platform !== 'darwin') throw new Error('No servidor (Umbrel) não há Finder: abra a pasta pelo app Arquivos do Umbrel.');
    await run('open', b.rel ? ['-R', f] : [f]);
    return send(res, 200, { ok: true });
  }
  if (u.pathname === '/api/disk/raw' && req.method === 'GET') {
    const root = rootOf(q.get('root') || conf.root), f = inside(root, q.get('rel'));
    const st = await stat(f).catch(() => null); if (!st) return send(res, 404, { error: 'não encontrado' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
    return res.end(await readFile(f));
  }
  return send(res, 404, { error: 'rota desconhecida' });
}
// só a própria página do app pode mexer nos arquivos (protege contra outros sites)
const okOrigin = req => {
  const o = req.headers.origin; if (!o) return true;
  if (o === `http://localhost:${PORT}` || o === `http://127.0.0.1:${PORT}`) return true;
  let u; try { u = new URL(o); } catch { return false; }
  // a própria página, aberta por qualquer endereço (o proxy do Umbrel pode trocar o Host)
  const hosts = [req.headers.host, req.headers['x-forwarded-host']].filter(Boolean).flatMap(h => String(h).split(',').map(x => x.trim()));
  if (hosts.includes(u.host)) return true;
  // rede de casa, Tailscale e nomes locais (sites da internet continuam bloqueados)
  const h = u.hostname;
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h) || /\.(local|lan|home|ts\.net)$/.test(h) || !h.includes('.');
};


// ---------- galeria guardada no servidor (Umbrel): o mesmo conteúdo em qualquer aparelho ----------
// Cada registro do app (geração, projeto, elemento, canvas, cena, ajustes) vira um arquivo JSON em DATA/store/<tipo>/.
// O index.json guarda a hora da última mudança de cada um (e as exclusões), para cada navegador baixar só o que mudou.
const STORE_ON = IN_DOCKER || process.env.SHIN_STORE === '1';
const STORE = path.join(DATA, 'store');
const STORES = new Set(['gens', 'projects', 'elements', 'canvases', 'clips', 'cfg']);
let sIndex = {};
try { sIndex = JSON.parse(await readFile(path.join(STORE, 'index.json'), 'utf8')); } catch {}
let sSave = null;
const saveIndex = () => { clearTimeout(sSave); sSave = setTimeout(async () => { await mkdir(STORE, { recursive: true }); const tmp = path.join(STORE, 'index.json.tmp'); await writeFile(tmp, JSON.stringify(sIndex)); await rename(tmp, path.join(STORE, 'index.json')); }, 300); };
function recPath(k) {
  const [st, ...rest] = String(k || '').split('/'); const id = rest.join('/');
  if (!STORES.has(st) || !id || id.length > 200) throw Object.assign(new Error('registro inválido'), { code: 400 });
  return { st, id, file: path.join(STORE, st, encodeURIComponent(id).replace(/\./g, '%2E') + '.json') };
}
async function store(u, req, res) {
  if (u.pathname === '/api/store' && req.method === 'GET') return send(res, 200, { enabled: STORE_ON, count: Object.values(sIndex).filter(x => !x.del).length });
  if (!STORE_ON) return send(res, 404, { error: 'desligado' });
  if (u.pathname === '/api/store/index' && req.method === 'GET') return send(res, 200, { entries: sIndex, now: Date.now() });
  if (u.pathname !== '/api/store/rec') return send(res, 404, { error: 'rota desconhecida' });
  const k = u.searchParams.get('k'), { file } = recPath(k), t = Number(u.searchParams.get('t')) || Date.now();
  if (req.method === 'GET') {
    const st = await stat(file).catch(() => null); if (!st) return send(res, 404, { error: 'não encontrado' });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': st.size, ...CORS });
    return res.end(await readFile(file));
  }
  if (req.method === 'PUT') {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    await new Promise((ok, bad) => { const w = createWriteStream(tmp); req.pipe(w); w.on('finish', ok); w.on('error', bad); req.on('error', bad); });
    await rename(tmp, file);
    sIndex[k] = { t }; saveIndex();
    return send(res, 200, { ok: true, t });
  }
  if (req.method === 'DELETE') {
    await unlink(file).catch(() => {});
    sIndex[k] = { t, del: true }; saveIndex();
    return send(res, 200, { ok: true, t });
  }
  return send(res, 405, { error: 'método' });
}

// ---------- Qwen e outros pelo ModelScope (API-Inference, assíncrona) ----------
async function modelscope(b) {
  const base = String(b.base || 'https://api-inference.modelscope.cn').replace(/\/+$/, '').replace(/\/v1$/, '');
  if (!b.token) throw Object.assign(new Error('Cole o token do ModelScope em Ajustes.'), { code: 400 });
  const H = { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' };
  const body = { model: b.model, prompt: b.prompt };
  if (b.size) body.size = b.size;
  if (b.seed != null && b.seed !== '') body.seed = Number(b.seed);
  if (b.negative) body.negative_prompt = b.negative;
  if (b.images?.length) body.image_url = b.images;
  let r;
  try { r = await fetch(`${base}/v1/images/generations`, { method: 'POST', headers: { ...H, 'X-ModelScope-Async-Mode': 'true' }, body: JSON.stringify(body) }); }
  catch { throw Object.assign(new Error('não consegui falar com ' + base + ' (internet ou endereço).'), { code: 502 }); }
  let j = await r.json().catch(() => ({}));
  const msg = x => x?.errors?.message || x?.message || x?.error?.message || (typeof x?.error === 'string' ? x.error : '') || x?.Message || '';
  if (!r.ok || !j.task_id) throw Object.assign(new Error((r.status === 401 ? 'token inválido. ' : '') + (msg(j) || 'HTTP ' + r.status)), { code: r.status || 500 });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await new Promise(res => setTimeout(res, 3000));
    r = await fetch(`${base}/v1/tasks/${j.task_id}`, { headers: { ...H, 'X-ModelScope-Task-Type': 'image_generation' } });
    const t = await r.json().catch(() => ({}));
    if (t.task_status === 'SUCCEED') {
      const url = (t.output_images || [])[0]; if (!url) throw new Error('não devolveu imagem.');
      const img = await fetch(url); if (!img.ok) throw new Error('não consegui baixar a imagem.');
      return { type: img.headers.get('content-type') || 'image/png', buf: Buffer.from(await img.arrayBuffer()) };
    }
    if (t.task_status === 'FAILED') throw new Error(msg(t) || 'a geração falhou.');
  }
  throw new Error('demorou demais (mais de 4 min).');
}

// ---------- ponte com o Claude (MCP) ----------
// O mcp.mjs (rodado pelo Claude) chama /api/mcp; o servidor repassa o pedido para o app aberto
// no navegador (/api/bridge/events) e devolve a resposta (/api/bridge/reply).
const bridge = { clients: [], pending: new Map() };
function bridgeSend(cmd, args, timeoutMs) {
  const c = bridge.clients[bridge.clients.length - 1];
  if (!c) return Promise.reject(Object.assign(new Error('O Estúdio do Shin não está aberto no navegador. Abra http://localhost:' + PORT + ' e tente de novo.'), { code: 503 }));
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return new Promise((res, rej) => {
    const t = setTimeout(() => { bridge.pending.delete(id); rej(new Error('O app não respondeu a tempo.')); }, timeoutMs);
    bridge.pending.set(id, { res, rej, t });
    c.write(`data: ${JSON.stringify({ id, cmd, args })}\n\n`);
  });
}


// ---------- vídeo: Veo no Agent Platform (ex-Vertex) ----------
const VEO_LOCATION = process.env.VEO_LOCATION || 'us-central1';
async function veoCall(model, verb, body) {
  const [proj, token] = await Promise.all([getProject(), getToken()]);
  const url = `https://${VEO_LOCATION}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${VEO_LOCATION}/publishers/google/models/${encodeURIComponent(model)}:${verb}`;
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-goog-user-project': proj }, body: JSON.stringify(body) }); }
  catch { throw Object.assign(new Error('não consegui falar com o Google (internet?).'), { code: 502 }); }
  const text = await r.text();
  if (r.status === 401) tok = { value: '', exp: 0 };
  return { status: r.status, text };
}
// junta as cenas num vídeo só (precisa do ffmpeg: brew install ffmpeg)
async function concatVideos(b) {
  const root = rootOf(b.root || conf.root);
  const files = (b.rels || []).map(r => inside(root, r));
  if (files.length < 1) throw new Error('Nenhuma cena.');
  const ffmpeg = await run('sh', ['-c', 'command -v ffmpeg || ls /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg 2>/dev/null | head -1']).catch(() => '');
  if (!ffmpeg) throw Object.assign(new Error('Para juntar as cenas, instale o ffmpeg: no Terminal, rode  brew install ffmpeg'), { code: 424 });
  const dir = inside(root, b.dir || ''); await mkdir(dir, { recursive: true });
  const list = path.join(os.tmpdir(), `shin-concat-${Date.now()}.txt`);
  await writeFile(list, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const name = await freeName(dir, clean(b.name || 'sequencia.mp4'));
  const out = path.join(dir, name);
  try { await new Promise((res, rej) => execFile(ffmpeg.split('\n')[0], ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { timeout: 300000 }, (e, o, er) => e ? rej(new Error(String(er).split('\n').slice(-3).join(' '))) : res())); }
  catch {   // codecs diferentes: recodifica
    await new Promise((res, rej) => execFile(ffmpeg.split('\n')[0], ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-c:a', 'aac', out], { timeout: 900000 }, (e, o, er) => e ? rej(new Error('ffmpeg: ' + String(er).split('\n').slice(-3).join(' '))) : res()));
  }
  unlink(list).catch(() => {});
  return { root, rel: path.relative(root, out).split(path.sep).join('/') };
}

// ---------- chamada ao Gemini no Agent Platform (ex-Vertex AI) ----------
async function gemini(model, bodyText) {
  const [proj, token] = await Promise.all([getProject(), getToken()]);
  const host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${proj}/locations/${LOCATION}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-goog-user-project': proj }, body: bodyText }); }
  catch (e) { throw new Error('O servidor não conseguiu falar com o Google (' + (e.cause?.code || e.message) + '). Verifique a internet.'); }
  if (r.status === 401) tok = { value: '', exp: 0 }; // força novo token na próxima
  return { status: r.status, text: await r.text() };
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    if (u.pathname === '/api/health') {
      const out = { ok: true, location: LOCATION };
      try { out.project = await getProject(); } catch (e) { out.ok = false; out.error = e.message; }
      try { await getToken(); out.auth = true; } catch (e) { out.ok = false; out.auth = false; out.error = creds ? e.message : IN_DOCKER ? 'Envie a credencial do Google em Ajustes → Google Gemini.' : 'Login ADC ausente. Rode: gcloud auth application-default login'; }
      return send(res, 200, out);
    }

    if (u.pathname === '/api/google' && req.method === 'GET') {
      const out = { mode: creds ? 'file' : IN_DOCKER ? 'none' : 'gcloud', credType: creds?.type || null, email: creds?.client_email || null, project: null, docker: IN_DOCKER };
      try { out.project = await getProject(); } catch (e) { out.error = e.message; }
      try { await getToken(); out.auth = true; } catch (e) { out.auth = false; out.error = out.error || e.message; }
      return send(res, 200, out);
    }
    if (u.pathname === '/api/google' && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const b = JSON.parse(await readBody(req) || '{}');
      if (b.creds) {
        const c = typeof b.creds === 'string' ? JSON.parse(b.creds) : b.creds;
        if (!['authorized_user', 'service_account'].includes(c.type)) return send(res, 400, { error: 'Arquivo não reconhecido: use o application_default_credentials.json do gcloud ou a chave de uma conta de serviço.' });
        await mkdir(path.dirname(CRED_FILE), { recursive: true });
        await writeFile(CRED_FILE, JSON.stringify(c), { mode: 0o600 });
        creds = c;
      }
      if (b.removeCreds) { await unlink(CRED_FILE).catch(() => {}); creds = null; }
      if (typeof b.project === 'string') { conf.gcpProject = b.project.trim(); await saveConf(); }
      project = process.env.GCP_PROJECT || ''; tok = { value: '', exp: 0 }; billingAccount = process.env.GCP_BILLING_ACCOUNT || '';
      const out = { ok: true, mode: creds ? 'file' : 'gcloud' };
      try { out.project = await getProject(); await getToken(); out.auth = true; } catch (e) { out.auth = false; out.error = e.message; }
      return send(res, 200, out);
    }
    if (u.pathname === '/api/billing') {
      // descobre a conta de faturamento do projeto (para abrir a página de créditos certa)
      let account = billingAccount;
      if (!account) {
        try {
          const [proj, token] = await Promise.all([getProject(), getToken()]);
          const r = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${proj}/billingInfo`, { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': proj } });
          const j = await r.json().catch(() => ({}));
          account = (j.billingAccountName || '').split('/').pop();
        } catch {}
        if (!account) {
          try { const proj = await getProject(); account = (await run('gcloud', ['billing', 'projects', 'describe', proj, '--format=value(billingAccountName)'])).split('/').pop(); } catch {}
        }
        billingAccount = account || '';
      }
      return send(res, 200, { account: billingAccount || null });
    }

    // outras APIs (compatíveis com OpenAI): o servidor faz a chamada para evitar bloqueio de CORS
    if (u.pathname === '/api/proxy' && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const b = JSON.parse(await readBody(req) || '{}');
      if (!/^https:\/\//.test(b.url || '')) return send(res, 400, { error: 'O endereço precisa começar com https://' });
      let r;
      try { r = await fetch(b.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(b.key ? { Authorization: 'Bearer ' + b.key } : {}) }, body: JSON.stringify(b.body || {}) }); }
      catch { return send(res, 502, { error: 'não consegui falar com ' + new URL(b.url).host }); }
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', ...CORS });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (u.pathname === '/api/proxy-models' && req.method === 'POST') {   // lista de modelos de uma API compatível com OpenAI (GET {base}/models)
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const b = JSON.parse(await readBody(req) || '{}');
      const base = String(b.base || '').replace(/\/+$/, '');
      if (!/^https:\/\//.test(base)) return send(res, 400, { error: 'O endereço precisa começar com https://' });
      try { const r = await fetch(base + '/models', { headers: b.key ? { Authorization: 'Bearer ' + b.key } : {} }); res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', ...CORS }); return res.end(Buffer.from(await r.arrayBuffer())); }
      catch { return send(res, 502, { error: 'não consegui falar com ' + new URL(base).host }); }
    }
    if (u.pathname === '/api/proxy-get' && req.method === 'GET') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const url = u.searchParams.get('url') || '';
      if (!/^https:\/\//.test(url)) return send(res, 400, { error: 'url inválida' });
      try { const r = await fetch(url); res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', ...CORS }); return res.end(Buffer.from(await r.arrayBuffer())); }
      catch { return send(res, 502, { error: 'não consegui baixar a imagem' }); }
    }
    const vm = u.pathname.match(/^\/api\/veo\/(start|poll)$/);
    if (vm && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const b = JSON.parse(await readBody(req) || '{}');
      try {
        const r = vm[1] === 'start'
          ? await veoCall(b.model, 'predictLongRunning', { instances: [b.instance], parameters: b.parameters || {} })
          : await veoCall(b.model, 'fetchPredictOperation', { operationName: b.name });
        res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS }); return res.end(r.text);
      } catch (e) { return send(res, e.code || 500, { error: { message: e.message } }); }
    }
    if (u.pathname === '/api/video/concat' && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      try { return send(res, 200, await concatVideos(JSON.parse(await readBody(req) || '{}'))); }
      catch (e) { return send(res, e.code || 500, { error: e.message }); }
    }
    if (u.pathname === '/api/modelscope' && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      try { const out = await modelscope(JSON.parse(await readBody(req) || '{}')); res.writeHead(200, { 'Content-Type': out.type, ...CORS }); return res.end(out.buf); }
      catch (e) { return send(res, e.code >= 400 && e.code < 600 ? e.code : 502, { error: e.message }); }
    }
    if (u.pathname === '/api/bridge/events' && req.method === 'GET') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      bridge.clients.push(res);
      const ka = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ka); bridge.clients = bridge.clients.filter(c => c !== res); });
      return;
    }
    if (u.pathname === '/api/bridge/reply' && req.method === 'POST') {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      const b = JSON.parse(await readBody(req) || '{}'), p = bridge.pending.get(b.id);
      if (p) { clearTimeout(p.t); bridge.pending.delete(b.id); b.ok ? p.res(b.result) : p.rej(new Error(b.error || 'erro no app')); }
      return send(res, 200, { ok: true });
    }
    if (u.pathname === '/api/mcp' && req.method === 'POST') {
      if (req.headers.origin) return send(res, 403, { error: 'só para o Claude (mcp.mjs)' });   // sites não podem usar
      const b = JSON.parse(await readBody(req) || '{}');
      try { const result = await bridgeSend(b.cmd, b.args || {}, /video|join/.test(b.cmd) ? 1200000 : /generate|edit/.test(b.cmd) ? 600000 : 60000); return send(res, 200, { ok: true, result }); }
      catch (e) { return send(res, e.code || 500, { ok: false, error: e.message }); }
    }

    if (u.pathname.startsWith('/api/store')) {
      if (!okOrigin(req)) return send(res, 403, { error: 'origem não permitida' });
      try { return await store(u, req, res); } catch (e) { return send(res, e.code || 500, { error: e.message }); }
    }
    if (u.pathname.startsWith('/api/disk')) {
      if (!okOrigin(req)) return send(res, 403, { error: 'Abra o app pelo endereço http://localhost:' + PORT + ' para salvar no disco.' });
      try { return await disk(u, req, res); } catch (e) { return send(res, 500, { error: e.message }); }
    }

    const m = u.pathname.match(/^\/api\/gemini\/([\w.\-]+)$/);
    if (m && req.method === 'POST') {
      const body = await readBody(req);
      const r = await gemini(m[1], body);
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
      return res.end(r.text);
    }

    // arquivos do app (só desta pasta)
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/estudio-do-shin.html';
    const file = path.join(DIR, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(DIR) || path.basename(file).startsWith('.')) return send(res, 403, { error: 'proibido' });
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) return send(res, 404, { error: 'não encontrado' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) {
    send(res, 500, { error: { message: e.message } });
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`\n  Estúdio do Shin rodando em  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${IN_DOCKER ? '  (Docker, dados em ' + DATA + ')' : ''}\n`);
  try { console.log('  Projeto Google Cloud:', await getProject()); } catch (e) { console.log('  ⚠ ', e.message); }
  try { await getToken(); console.log('  Login ADC: ok'); } catch { console.log('  ⚠  Login ADC ausente. Rode: gcloud auth application-default login'); }
  try { const d = await rootStatus(conf.root); console.log('  Pasta das imagens:', d.root, d.exists && d.writable ? '' : '⚠ ' + (d.error || 'indisponível')); } catch {}
  console.log('\n  Deixe esta janela aberta enquanto usa o app. Ctrl+C para parar.\n');
});
