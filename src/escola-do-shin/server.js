// Escola do Shin — servidor
// Sem dependências externas: só Node.js (versão 18 ou mais nova).
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = parseInt(process.env.PORT || '4848', 10);
const ROOTS = (process.env.CURSOS || '/cursos').split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = process.env.DADOS || path.join(__dirname, 'dados');
const PUBLIC_DIR = path.join(__dirname, 'public');
const RESCAN_MIN = parseInt(process.env.VARREDURA_MINUTOS || '10', 10);

const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv']);
const PDF_EXT = new Set(['.pdf']);
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const RES_DIR = /^(materia(l|is)( extras?| de apoio| complementar(es)?)?|recursos?|resources?|extras?|anexos?|arquivos?|downloads?|attachments?|apostilas?|bonus|bônus|links?)$/i;
const COVER_NAMES = /^(capa|cover|folder|poster|thumb|thumbnail)\.(jpe?g|png|webp)$/i;
const LINKS_TXT = /^links?.*\.txt$/i;
const SKIP = /^(\.|@eaDir$|#recycle$|\$RECYCLE|System Volume Information|desktop\.ini$|Thumbs\.db$)/i;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip',
  '.webmanifest': 'application/manifest+json', '.vtt': 'text/vtt; charset=utf-8'
};

// ---------- utilidades ----------
const sha = s => crypto.createHash('sha1').update(s).digest('hex');
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const natSort = (a, b) => collator.compare(a, b);
const today = () => new Date().toISOString().slice(0, 10);
const extOf = f => path.extname(f).toLowerCase();
const stemOf = f => path.basename(f, path.extname(f));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function cleanTitle(name) {
  const m = name.match(/^\s*(\d{1,3})\s*[-_.)–—:]?\s*(.*)$/);
  if (m && m[2]) return { num: parseInt(m[1], 10), title: m[2].replace(/[_]+/g, ' ').trim() };
  return { num: null, title: name.replace(/[_]+/g, ' ').trim() };
}

// ---------- banco de dados (arquivo JSON) ----------
const DB_FILE = path.join(DATA_DIR, 'escola.json');
const COVER_DIR = path.join(DATA_DIR, 'capas');
let db = { index: {}, courses: {}, notes: [], activity: {}, categories: [] };
let saveTimer = null;

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(COVER_DIR, { recursive: true });
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') console.error('Erro ao ler banco de dados:', e.message); }
}
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 400);
}
function courseData(id) {
  if (!db.courses[id]) db.courses[id] = { meta: {}, lessons: {}, opens: 0, manualLinks: [] };
  const c = db.courses[id];
  c.meta = c.meta || {}; c.lessons = c.lessons || {}; c.manualLinks = c.manualLinks || [];
  return c;
}

// ---------- leitura de duração de MP4/MOV ----------
async function mp4Duration(file) {
  let fh;
  try {
    fh = await fsp.open(file, 'r');
    const { size } = await fh.stat();
    let pos = 0;
    const head = Buffer.alloc(16);
    for (let guard = 0; pos < size && guard < 64; guard++) {
      const { bytesRead } = await fh.read(head, 0, 16, pos);
      if (bytesRead < 8) break;
      let boxSize = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      let hdr = 8;
      if (boxSize === 1) { boxSize = Number(head.readBigUInt64BE(8)); hdr = 16; }
      else if (boxSize === 0) boxSize = size - pos;
      if (type === 'moov') {
        const buf = Buffer.alloc(Math.min(4096, boxSize - hdr));
        await fh.read(buf, 0, buf.length, pos + hdr);
        const i = buf.indexOf('mvhd', 0, 'latin1');
        if (i < 4) return null;
        const v = buf[i + 4];
        if (v === 1) {
          const ts = buf.readUInt32BE(i + 4 + 4 + 16);
          const du = Number(buf.readBigUInt64BE(i + 4 + 4 + 20));
          return ts ? du / ts : null;
        }
        const ts = buf.readUInt32BE(i + 4 + 4 + 8);
        const du = buf.readUInt32BE(i + 4 + 4 + 12);
        return ts ? du / ts : null;
      }
      if (boxSize < 8) break;
      pos += boxSize;
    }
  } catch (e) { /* ignora */ }
  finally { if (fh) await fh.close(); }
  return null;
}

// ---------- extração de links de PDF ----------
const URL_RE = /https?:\/\/[^\s<>"'()\\\]\[{}]+[^\s<>"'()\\\]\[{}.,;:!?]/g;
const pdfLinkCache = new Map();
async function pdfLinks(file) {
  try {
    const st = await fsp.stat(file);
    if (st.size > 60 * 1024 * 1024) return [];
    const key = file + '|' + st.size + '|' + st.mtimeMs;
    if (pdfLinkCache.has(key)) return pdfLinkCache.get(key);
    const raw = await fsp.readFile(file);
    const texts = [raw.toString('latin1')];
    let i = 0;
    for (let n = 0; n < 4000; n++) {
      const s = raw.indexOf('stream', i, 'latin1');
      if (s < 0) break;
      let start = s + 6;
      if (raw[start] === 0x0d) start++;
      if (raw[start] === 0x0a) start++;
      const e = raw.indexOf('endstream', start, 'latin1');
      if (e < 0) break;
      try { texts.push(zlib.inflateSync(raw.subarray(start, e)).toString('latin1')); } catch (_) { }
      i = e + 9;
    }
    const found = new Set();
    for (const t of texts) {
      for (const m of t.matchAll(/\/URI\s*\(([^)]{4,500})\)/g)) found.add(m[1].replace(/\\(.)/g, '$1'));
      for (const m of t.matchAll(URL_RE)) found.add(m[0]);
    }
    const out = [...found].filter(u => /^https?:\/\//i.test(u) && u.length < 400).slice(0, 80);
    pdfLinkCache.set(key, out);
    return out;
  } catch (e) { return []; }
}
function parseLinksTxt(text) {
  const out = [];
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const um = line.match(/https?:\/\/\S+/);
    if (!um) continue;
    const url = um[0];
    let title = line.replace(url, '').replace(/^[\s|:\-–—\t]+|[\s|:\-–—\t]+$/g, '').trim();
    out.push({ title: title || null, url });
  }
  return out;
}

// ---------- varredura ----------
const files = new Map();      // fileId -> caminho absoluto
let library = [];             // cursos encontrados
let byId = new Map();
let scanning = false, lastScan = null, scanError = null;

function fileId(abs) { const id = sha(abs).slice(0, 16); files.set(id, abs); return id; }

async function listDir(dir) {
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    return ents.filter(e => !SKIP.test(e.name)).sort((a, b) => natSort(a.name, b.name));
  } catch (e) { return []; }
}
function isMedia(name) { const x = extOf(name); return VIDEO_EXT.has(x) || PDF_EXT.has(x); }

async function mediaDepth(dir, depth = 0, limit = 6) {
  if (depth > limit) return -1;
  const ents = await listDir(dir);
  let best = -1;
  if (ents.some(e => e.isFile() && isMedia(e.name))) best = 0;
  for (const e of ents) {
    if (!e.isDirectory() || RES_DIR.test(e.name)) continue;
    const d = await mediaDepth(path.join(dir, e.name), depth + 1, limit);
    if (d >= 0) best = Math.max(best, d + 1);
  }
  return best;
}

async function collectFiles(dir, out = [], depth = 0) {
  if (depth > 4) return out;
  for (const e of await listDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await collectFiles(p, out, depth + 1);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

async function materialFrom(abs, scope) {
  let size = 0;
  try { size = (await fsp.stat(abs)).size; } catch (_) { }
  const x = extOf(abs);
  return {
    id: fileId(abs), name: path.basename(abs), ext: x.replace('.', '').toUpperCase() || 'ARQ', size, scope,
    viewable: PDF_EXT.has(x) ? 'pdf' : IMG_EXT.has(x) ? 'img' : VIDEO_EXT.has(x) ? 'video' : (x === '.txt' ? 'txt' : null)
  };
}

async function linkSourcesFrom(absFiles, scope) {
  const links = [];
  for (const f of absFiles) {
    const base = path.basename(f);
    if (LINKS_TXT.test(base)) {
      try { for (const l of parseLinksTxt(await fsp.readFile(f, 'utf8'))) links.push({ ...l, source: base, scope }); } catch (_) { }
    }
  }
  return links;
}

async function buildFolder(dir, scope, isCourseRoot) {
  // monta aulas + materiais de uma pasta (módulo ou curso sem módulos)
  const ents = await listDir(dir);
  const fileEnts = ents.filter(e => e.isFile());
  const videos = fileEnts.filter(e => VIDEO_EXT.has(extOf(e.name)));
  const pdfs = fileEnts.filter(e => PDF_EXT.has(extOf(e.name)));
  const others = fileEnts.filter(e => !VIDEO_EXT.has(extOf(e.name)) && !PDF_EXT.has(extOf(e.name))
    && !(isCourseRoot && (COVER_NAMES.test(e.name) || /^(curso|escola)\.json$/i.test(e.name))));
  const lessonsSrc = videos.length ? videos : pdfs;
  const leftover = videos.length ? [...pdfs, ...others] : others;
  const lessons = [];
  const used = new Set();
  for (const e of lessonsSrc) {
    const abs = path.join(dir, e.name);
    let size = 0; try { size = (await fsp.stat(abs)).size; } catch (_) { }
    const stem = stemOf(e.name);
    const ct = cleanTitle(stem);
    const type = VIDEO_EXT.has(extOf(e.name)) ? 'video' : 'pdf';
    const mats = [];
    const nstem = norm(stem);
    for (const o of leftover) {
      const os = norm(stemOf(o.name));
      if (os && nstem && (os === nstem || os.startsWith(nstem + ' '))) {
        used.add(o.name);
        mats.push(await materialFrom(path.join(dir, o.name), 'aula'));
      }
    }
    let duration = null;
    if (['.mp4', '.m4v', '.mov'].includes(extOf(e.name))) duration = await mp4Duration(abs);
    lessons.push({
      key: sha(e.name + '|' + size).slice(0, 16), fileId: fileId(abs), file: e.name, type,
      num: ct.num, title: ct.title || stem, size, duration, materials: mats,
      playable: type === 'pdf' || ['.mp4', '.m4v', '.webm', '.mov'].includes(extOf(e.name))
    });
  }
  const mats = [];
  const absLeft = [];
  for (const o of leftover) {
    if (used.has(o.name)) continue;
    const abs = path.join(dir, o.name);
    absLeft.push(abs);
    if (LINKS_TXT.test(o.name)) continue;
    mats.push(await materialFrom(abs, scope));
  }
  const resDirs = ents.filter(e => e.isDirectory() && RES_DIR.test(e.name));
  for (const r of resDirs) {
    for (const abs of await collectFiles(path.join(dir, r.name))) {
      absLeft.push(abs);
      if (LINKS_TXT.test(path.basename(abs))) continue;
      mats.push(await materialFrom(abs, scope));
    }
  }
  const links = await linkSourcesFrom(absLeft, scope);
  return { lessons, materials: mats, links };
}

async function buildCourse(dir, trail, root) {
  const ents = await listDir(dir);
  let info = {};
  const cj = ents.find(e => e.isFile() && /^curso\.json$/i.test(e.name));
  if (cj) { try { info = JSON.parse(await fsp.readFile(path.join(dir, cj.name), 'utf8')); } catch (_) { } }
  const coverEnt = ents.find(e => e.isFile() && COVER_NAMES.test(e.name));
  const modDirs = [];
  for (const e of ents) {
    if (!e.isDirectory() || RES_DIR.test(e.name)) continue;
    const d = await mediaDepth(path.join(dir, e.name), 0, 3);
    if (d >= 0) modDirs.push(e);
  }
  const modules = [];
  const courseMaterials = [];
  const courseLinks = [];
  const rootPart = await buildFolder(dir, 'curso', true);
  if (modDirs.length) {
    if (rootPart.lessons.length) modules.push({ title: 'Introdução', num: 0, lessons: rootPart.lessons, materials: [] });
    courseMaterials.push(...rootPart.materials); courseLinks.push(...rootPart.links);
    for (const m of modDirs) {
      const part = await buildFolder(path.join(dir, m.name), 'modulo', false);
      // módulos com subpastas (ex.: capítulos) — achata um nível
      if (!part.lessons.length) {
        for (const sub of await listDir(path.join(dir, m.name))) {
          if (!sub.isDirectory() || RES_DIR.test(sub.name)) continue;
          const sp = await buildFolder(path.join(dir, m.name, sub.name), 'modulo', false);
          part.lessons.push(...sp.lessons); part.materials.push(...sp.materials); part.links.push(...sp.links);
        }
      }
      const ct = cleanTitle(m.name);
      modules.push({ title: ct.title || m.name, num: ct.num, lessons: part.lessons, materials: part.materials });
      courseLinks.push(...part.links.map(l => ({ ...l, module: ct.title || m.name })));
    }
  } else {
    modules.push({ title: 'Aulas', num: null, lessons: rootPart.lessons, materials: [], single: true });
    courseMaterials.push(...rootPart.materials); courseLinks.push(...rootPart.links);
  }
  const allLessons = modules.flatMap(m => m.lessons);
  if (!allLessons.length) return null;
  const videoCount = allLessons.filter(l => l.type === 'video').length;
  return {
    path: dir, root,
    folderName: path.basename(dir),
    title: info.titulo || info.title || path.basename(dir),
    description: info.descricao || info.description || '',
    teacher: info.professor || info.teacher || '',
    school: info.escola || trail[trail.length - 1] || '',
    trail,
    coverFile: coverEnt ? fileId(path.join(dir, coverEnt.name)) : null,
    kind: videoCount === 0 ? 'pdf' : (videoCount === allLessons.length ? 'video' : 'misto'),
    modules, materials: courseMaterials, links: courseLinks,
    lessonCount: allLessons.length,
    duration: allLessons.reduce((s, l) => s + (l.duration || 0), 0)
  };
}

async function classify(dir, trail, root, out) {
  const ents = await listDir(dir);
  const forceCourse = ents.some(e => e.isFile() && /^curso\.json$/i.test(e.name));
  const forceSchool = ents.some(e => e.isFile() && /^escola\.json$/i.test(e.name));
  if (forceCourse) { const c = await buildCourse(dir, trail, root); if (c) out.push(c); return; }
  const d = await mediaDepth(dir);
  if (d < 0) return;
  if (!forceSchool && d <= 1) { const c = await buildCourse(dir, trail, root); if (c) out.push(c); return; }
  let name = path.basename(dir);
  if (forceSchool) { try { const j = JSON.parse(await fsp.readFile(path.join(dir, 'escola.json'), 'utf8')); name = j.nome || j.name || name; } catch (_) { } }
  for (const e of ents) {
    if (e.isDirectory() && !RES_DIR.test(e.name)) await classify(path.join(dir, e.name), [...trail, name], root, out);
  }
}

function matchIds(found) {
  const now = Date.now();
  const used = new Set();
  const pathToId = {};
  for (const [id, ix] of Object.entries(db.index)) pathToId[ix.path] = id;
  const pending = [];
  for (const c of found) {
    const id = pathToId[c.path];
    if (id && !used.has(id)) { c.id = id; used.add(id); } else pending.push(c);
  }
  for (const c of pending) {
    const keys = new Set(c.modules.flatMap(m => m.lessons.map(l => l.key)));
    let best = null, bestScore = 0;
    for (const [id, ix] of Object.entries(db.index)) {
      if (used.has(id) || !ix.keys || !ix.keys.length) continue;
      const inter = ix.keys.filter(k => keys.has(k)).length;
      const score = inter / Math.max(ix.keys.length, 1);
      if (score > bestScore) { bestScore = score; best = id; }
    }
    if (best && bestScore >= 0.5) { c.id = best; used.add(best); }
    else { c.id = crypto.randomBytes(5).toString('hex'); used.add(c.id); }
  }
  for (const c of found) {
    const prev = db.index[c.id] || {};
    db.index[c.id] = { path: c.path, keys: c.modules.flatMap(m => m.lessons.map(l => l.key)), firstSeen: prev.firstSeen || now, title: c.title };
  }
}

async function scan() {
  if (scanning) return;
  scanning = true; scanError = null;
  const t0 = Date.now();
  try {
    files.clear();
    const found = [];
    for (const root of ROOTS) {
      if (!fs.existsSync(root)) continue;
      for (const e of await listDir(root)) {
        if (e.isDirectory()) await classify(path.join(root, e.name), [], root, found);
      }
    }
    matchIds(found);
    library = found;
    byId = new Map(found.map(c => [c.id, c]));
    lastScan = new Date().toISOString();
    saveDb();
    console.log(`Varredura: ${found.length} cursos em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { scanError = e.message; console.error('Erro na varredura:', e); }
  finally { scanning = false; }
}

// ---------- montagem das respostas ----------
function coverUrl(c) {
  if (c.coverFile) return '/f/' + c.coverFile;
  if (fs.existsSync(path.join(COVER_DIR, c.id + '.jpg'))) {
    const st = fs.statSync(path.join(COVER_DIR, c.id + '.jpg'));
    return '/capa/' + c.id + '?v=' + Math.floor(st.mtimeMs);
  }
  return null;
}
function progressOf(c) {
  const d = courseData(c.id);
  const lessons = c.modules.flatMap(m => m.lessons);
  let done = 0, lastUpd = 0, lastKey = null;
  for (const l of lessons) {
    const p = d.lessons[l.key];
    if (!p) continue;
    if (p.done) done++;
    if ((p.updated || 0) > lastUpd) { lastUpd = p.updated; lastKey = l.key; }
  }
  let next = null;
  if (lastKey) {
    const i = lessons.findIndex(l => l.key === lastKey);
    const lp = d.lessons[lastKey];
    next = lp && !lp.done ? lessons[i] : (lessons.slice(i + 1).find(l => !(d.lessons[l.key] || {}).done) || lessons.find(l => !(d.lessons[l.key] || {}).done) || null);
  } else next = lessons[0];
  let where = '';
  if (next) {
    const mi = c.modules.findIndex(m => m.lessons.includes(next));
    const m = c.modules[mi];
    const li = m.lessons.indexOf(next);
    where = m.single ? `Aula ${li + 1}` : `Módulo ${mi + 1 - (c.modules[0].num === 0 ? 1 : 0)} · Aula ${li + 1}`;
    if (c.modules[0].num === 0 && mi === 0) where = `Introdução · Aula ${li + 1}`;
  }
  const remaining = lessons.filter(l => !(d.lessons[l.key] || {}).done).reduce((s, l) => {
    const p = d.lessons[l.key];
    return s + Math.max(0, (l.duration || (p && p.dur) || 0) - ((p && p.pos) || 0));
  }, 0);
  return { done, total: lessons.length, pct: lessons.length ? Math.round(done / lessons.length * 100) : 0, updated: lastUpd, nextKey: next ? next.key : null, nextWhere: where, remaining, started: lastUpd > 0 };
}
function summary(c) {
  const d = courseData(c.id);
  const m = d.meta;
  return {
    id: c.id, title: m.title || c.title, school: m.school ?? c.school, trail: c.trail, kind: c.kind,
    description: m.description || c.description, teacher: c.teacher,
    category: m.category || '', subcategory: m.subcategory || '', tags: m.tags || [],
    rating: m.rating || 0, favorite: !!m.favorite, opens: d.opens || 0, lastOpened: d.lastOpened || 0,
    watch: d.watchSeconds || 0, firstSeen: (db.index[c.id] || {}).firstSeen || 0,
    modules: c.modules.length, lessons: c.lessonCount, duration: c.duration, cover: coverUrl(c),
    needsCover: !coverUrl(c) && c.kind !== 'pdf' ? (c.modules.flatMap(x => x.lessons).find(l => l.type === 'video' && l.playable) || {}).fileId || null : null,
    progress: progressOf(c)
  };
}
async function detail(c) {
  const d = courseData(c.id);
  const s = summary(c);
  const pdfMats = [...c.materials, ...c.modules.flatMap(m => m.materials), ...c.modules.flatMap(m => m.lessons.flatMap(l => l.materials))]
    .filter(m => m.ext === 'PDF');
  const extra = [];
  for (const m of pdfMats.slice(0, 30)) {
    const abs = files.get(m.id);
    if (!abs) continue;
    for (const u of await pdfLinks(abs)) extra.push({ title: null, url: u, source: m.name, scope: m.scope });
  }
  const seen = new Set();
  const links = [...c.links, ...extra, ...d.manualLinks.map(l => ({ ...l, source: 'manual' }))]
    .filter(l => { const k = l.url.replace(/\/$/, ''); if (seen.has(k)) return false; seen.add(k); return true; });
  return {
    ...s,
    folder: c.folderName,
    modules: c.modules.map((m, mi) => ({
      title: m.title, num: m.num, single: !!m.single, materials: m.materials,
      lessons: m.lessons.map(l => {
        const p = d.lessons[l.key] || {};
        return { key: l.key, fileId: l.fileId, title: l.title, num: l.num, type: l.type, file: l.file, playable: l.playable,
          duration: l.duration || p.dur || null, materials: l.materials, pos: p.pos || 0, done: !!p.done, page: p.page || null };
      })
    })),
    materials: c.materials,
    links
  };
}

// ---------- HTTP ----------
function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, Object.assign({ 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('grande demais')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) { const b = await readBody(req); return b.length ? JSON.parse(b.toString('utf8')) : {}; }

async function serveFile(req, res, abs, download) {
  let st;
  try { st = await fsp.stat(abs); } catch (_) { return send(res, 404, 'Arquivo não encontrado'); }
  const type = MIME[extOf(abs)] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  const fname = encodeURIComponent(path.basename(abs));
  headers['Content-Disposition'] = (download ? 'attachment' : 'inline') + `; filename*=UTF-8''${fname}`;
  const range = req.headers.range;
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (m && !m[1] && m[2]) { start = st.size - parseInt(m[2], 10); end = st.size - 1; }
    if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(abs, { start, end }).pipe(res);
  } else {
    res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(abs).pipe(res);
  }
}

function addActivity(courseId, seconds) {
  if (!(seconds > 0 && seconds < 120)) return;
  const day = today();
  const a = db.activity[day] || (db.activity[day] = { total: 0, byCourse: {} });
  a.total += seconds;
  a.byCourse[courseId] = (a.byCourse[courseId] || 0) + seconds;
  const c = courseData(courseId);
  c.watchSeconds = (c.watchSeconds || 0) + seconds;
  const days = Object.keys(db.activity).sort();
  while (days.length > 90) delete db.activity[days.shift()];
}

function weekStats() {
  const now = new Date();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now - i * 864e5).toISOString().slice(0, 10);
    if (db.activity[d]) total += db.activity[d].total;
  }
  const weekAgo = Date.now() - 7 * 864e5;
  let lessonsDone = 0;
  for (const c of Object.values(db.courses)) for (const l of Object.values(c.lessons || {})) if (l.done && (l.doneAt || 0) > weekAgo) lessonsDone++;
  return { seconds: Math.round(total), lessonsDone };
}

function suggestions(list) {
  const weights = {};
  const since = Date.now() - 21 * 864e5;
  for (const [day, a] of Object.entries(db.activity)) {
    if (new Date(day).getTime() < since) continue;
    for (const [cid, sec] of Object.entries(a.byCourse)) {
      const c = list.find(x => x.id === cid);
      if (c && c.category) weights[c.category] = (weights[c.category] || 0) + sec;
    }
  }
  const cats = Object.entries(weights).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const pool = list.filter(c => c.progress.pct < 100);
  const fresh = pool.filter(c => !c.progress.started);
  const out = [];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  for (const cat of cats.slice(0, 3)) {
    const cand = fresh.filter(c => c.category === cat && !out.includes(c));
    const cand2 = cand.length ? cand : pool.filter(c => c.category === cat && !out.includes(c));
    if (cand2.length) out.push(Object.assign({}, pick(cand2), { reason: `Porque você tem assistido ${cat}` }));
  }
  const rest = (fresh.length ? fresh : pool).filter(c => !out.find(o => o.id === c.id));
  while (out.length < 4 && rest.length) {
    const i = Math.floor(Math.random() * rest.length);
    out.push(Object.assign({}, rest.splice(i, 1)[0], { reason: out.length ? 'Uma sugestão aleatória da sua biblioteca' : 'Sugestão para começar' }));
  }
  return out;
}

const routes = [];
const route = (method, re, fn) => routes.push({ method, re, fn });

route('GET', /^\/api\/biblioteca$/, async (req, res) => {
  const list = library.map(summary);
  const cats = new Map();
  for (const c of db.categories || []) cats.set(c.name, new Set(c.subs || []));
  for (const c of list) if (c.category) {
    if (!cats.has(c.category)) cats.set(c.category, new Set());
    if (c.subcategory) cats.get(c.category).add(c.subcategory);
  }
  send(res, 200, {
    courses: list,
    categories: [...cats.entries()].map(([name, subs]) => ({ name, subs: [...subs].sort(natSort) })).sort((a, b) => natSort(a.name, b.name)),
    schools: [...new Set(list.map(c => c.school).filter(Boolean))].sort(natSort),
    tags: [...new Set(list.flatMap(c => c.tags))].sort(natSort),
    suggestions: suggestions(list),
    week: weekStats(),
    scanning, lastScan, scanError, roots: ROOTS, notesCount: db.notes.length
  });
});
route('GET', /^\/api\/curso\/(\w+)$/, async (req, res, m) => {
  const c = byId.get(m[1]);
  if (!c) return send(res, 404, { erro: 'Curso não encontrado' });
  send(res, 200, await detail(c));
});
route('POST', /^\/api\/curso\/(\w+)\/abrir$/, async (req, res, m) => {
  if (!byId.has(m[1])) return send(res, 404, { erro: 'Curso não encontrado' });
  const d = courseData(m[1]); d.opens = (d.opens || 0) + 1; d.lastOpened = Date.now(); saveDb();
  send(res, 200, { ok: true });
});
route('POST', /^\/api\/curso\/(\w+)\/meta$/, async (req, res, m) => {
  if (!byId.has(m[1])) return send(res, 404, { erro: 'Curso não encontrado' });
  const body = await readJson(req);
  const d = courseData(m[1]);
  const allowed = ['title', 'description', 'school', 'category', 'subcategory', 'tags', 'rating', 'favorite'];
  for (const k of allowed) if (k in body) {
    let v = body[k];
    if (k === 'tags') v = (Array.isArray(v) ? v : String(v || '').split(',')).map(t => String(t).trim()).filter(Boolean).slice(0, 30);
    else if (k === 'rating') v = Math.max(0, Math.min(5, parseInt(v, 10) || 0));
    else if (k === 'favorite') v = !!v;
    else v = String(v ?? '').trim().slice(0, 2000);
    if (v === '' || (Array.isArray(v) && !v.length)) delete d.meta[k]; else d.meta[k] = v;
  }
  if (d.meta.category) {
    db.categories = db.categories || [];
    let cat = db.categories.find(c => c.name === d.meta.category);
    if (!cat) db.categories.push(cat = { name: d.meta.category, subs: [] });
    if (d.meta.subcategory && !cat.subs.includes(d.meta.subcategory)) cat.subs.push(d.meta.subcategory);
  }
  saveDb();
  send(res, 200, summary(byId.get(m[1])));
});
route('POST', /^\/api\/curso\/(\w+)\/links$/, async (req, res, m) => {
  if (!byId.has(m[1])) return send(res, 404, { erro: 'Curso não encontrado' });
  const body = await readJson(req);
  const d = courseData(m[1]);
  if (body.remove) d.manualLinks = d.manualLinks.filter(l => l.url !== body.remove);
  else {
    const url = String(body.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return send(res, 400, { erro: 'O link precisa começar com http:// ou https://' });
    d.manualLinks.push({ url, title: String(body.title || '').trim().slice(0, 200) || null });
  }
  saveDb();
  send(res, 200, { ok: true });
});
route('POST', /^\/api\/progresso$/, async (req, res) => {
  const b = await readJson(req);
  const c = byId.get(b.course);
  if (!c) return send(res, 404, { erro: 'Curso não encontrado' });
  const d = courseData(b.course);
  const p = d.lessons[b.lesson] || (d.lessons[b.lesson] = {});
  if (typeof b.pos === 'number') p.pos = Math.max(0, b.pos);
  if (typeof b.dur === 'number' && b.dur > 0) p.dur = b.dur;
  if (typeof b.page === 'number') p.page = b.page;
  if (typeof b.done === 'boolean') { if (b.done && !p.done) p.doneAt = Date.now(); p.done = b.done; }
  p.updated = Date.now();
  if (typeof b.watched === 'number') addActivity(b.course, b.watched);
  saveDb();
  send(res, 200, { ok: true, progress: progressOf(c) });
});
route('GET', /^\/api\/notas$/, async (req, res) => {
  const notes = db.notes.map(n => {
    const c = byId.get(n.course);
    let lessonTitle = '', courseTitle = c ? (courseData(c.id).meta.title || c.title) : (db.index[n.course] || {}).title || 'Curso indisponível';
    if (c) for (const m of c.modules) { const l = m.lessons.find(x => x.key === n.lesson); if (l) lessonTitle = l.title; }
    return { ...n, courseTitle, lessonTitle, available: !!c };
  }).sort((a, b) => b.created - a.created);
  send(res, 200, notes);
});
route('POST', /^\/api\/notas$/, async (req, res) => {
  const b = await readJson(req);
  const text = String(b.text || '').trim().slice(0, 5000);
  if (!text) return send(res, 400, { erro: 'A anotação está vazia' });
  const n = { id: crypto.randomBytes(6).toString('hex'), course: b.course, lesson: b.lesson, t: typeof b.t === 'number' ? b.t : null, page: typeof b.page === 'number' ? b.page : null, text, created: Date.now() };
  db.notes.push(n); saveDb();
  send(res, 200, n);
});
route('POST', /^\/api\/notas\/(\w+)$/, async (req, res, m) => {
  const n = db.notes.find(x => x.id === m[1]);
  if (!n) return send(res, 404, { erro: 'Anotação não encontrada' });
  const b = await readJson(req);
  if (b.delete) db.notes = db.notes.filter(x => x.id !== m[1]);
  else if (typeof b.text === 'string') n.text = b.text.trim().slice(0, 5000);
  saveDb(); send(res, 200, { ok: true });
});
route('POST', /^\/api\/capa\/(\w+)$/, async (req, res, m) => {
  if (!byId.has(m[1])) return send(res, 404, { erro: 'Curso não encontrado' });
  const buf = await readBody(req, 4 * 1024 * 1024);
  if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) return send(res, 400, { erro: 'Imagem inválida' });
  await fsp.writeFile(path.join(COVER_DIR, m[1] + '.jpg'), buf);
  send(res, 200, { ok: true });
});
route('POST', /^\/api\/varrer$/, async (req, res) => { scan(); send(res, 200, { ok: true }); });
route('GET', /^\/api\/estado$/, async (req, res) => send(res, 200, { scanning, lastScan, scanError, courses: library.length }));
route('GET', /^\/f\/(\w+)$/, async (req, res, m, url) => {
  const abs = files.get(m[1]);
  if (!abs) return send(res, 404, 'Arquivo não encontrado');
  serveFile(req, res, abs, url.searchParams.has('baixar'));
});
route('GET', /^\/capa\/(\w+)$/, async (req, res, m) => serveFile(req, res, path.join(COVER_DIR, m[1] + '.jpg'), false));

async function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname);
  if (p === '/') p = '/index.html';
  const abs = path.normalize(path.join(PUBLIC_DIR, p));
  if (!abs.startsWith(PUBLIC_DIR)) return send(res, 403, 'Proibido');
  try {
    const st = await fsp.stat(abs);
    if (!st.isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': MIME[extOf(abs)] || 'application/octet-stream', 'Cache-Control': extOf(abs) === '.woff2' ? 'public, max-age=31536000' : 'no-cache' });
    fs.createReadStream(abs).pipe(res);
  } catch (_) {
    send(res, 404, 'Não encontrado');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    for (const r of routes) {
      if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
      const m = url.pathname.match(r.re);
      if (m) return await r.fn(req, res, m, url);
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
    send(res, 404, 'Não encontrado');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { erro: 'Erro interno: ' + e.message });
  }
});

loadDb();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Escola do Shin rodando na porta ${PORT}`);
  console.log('Pastas de cursos:', ROOTS.join(', '), '| Dados:', DATA_DIR);
  scan();
  if (RESCAN_MIN > 0) setInterval(scan, RESCAN_MIN * 60 * 1000);
});
process.on('SIGTERM', () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (_) { } process.exit(0); });
