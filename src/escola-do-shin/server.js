// Escola do Shin — servidor
// Sem dependências externas: só Node.js (versão 18 ou mais nova).
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { pipeline } = require('stream');

const PORT = parseInt(process.env.PORT || '4848', 10);
const ROOTS = (process.env.CURSOS || '/cursos').split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = process.env.DADOS || path.join(__dirname, 'dados');
const PUBLIC_DIR = path.join(__dirname, 'public');
// relê as pastas 1 vez por dia (ou quando você clica em "Atualizar biblioteca")
const RESCAN_MIN = parseInt(process.env.VARREDURA_MINUTOS || '1440', 10);

const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.wmv', '.flv', '.ts', '.m2ts', '.mts', '.mpg', '.mpeg', '.3gp', '.vob']);
const PDF_EXT = new Set(['.pdf']);
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const RES_DIR = /^(materia(l|is)( extras?| de apoio| complementar(es)?)?|recursos?|resources?|extras?|anexos?|arquivos?|downloads?|attachments?|apostilas?|bonus|bônus|links?|exerc[ií]cios?|projetos?|assets|fontes|brushes|pinc[eé]is|m[ií]dias?( de exerc[ií]cios?)?|footage)$/i;
const COVER_NAMES = /^(capa|cover|folder|poster|thumb|thumbnail)\.(jpe?g|png|webp)$/i;
const LINKS_TXT = /^links?.*\.txt$/i;
const SKIP = /^(\.|@eaDir$|#recycle$|\$RECYCLE|System Volume Information|desktop\.ini$|Thumbs\.db$)/i;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo', '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv', '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t', '.mts': 'video/mp2t', '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg', '.3gp': 'video/3gpp', '.vob': 'video/mpeg',
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
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.mkdirSync(COVER_DIR, { recursive: true }); }
  catch (e) { console.error('Não consegui criar a pasta de dados', DATA_DIR, '-', e.message); }
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') console.error('Erro ao ler banco de dados:', e.message); }
}
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('Não consegui salvar os dados em', DATA_DIR, '-', e.message); }
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
// Links de PDFs: lidos em segundo plano, um PDF por vez, sem travar o servidor.
// Só procura links clicáveis de verdade (/URI) e ignora imagens e metadados do Illustrator/Adobe.
const LINK_JUNK = /^https?:\/\/(www\.)?(w3\.org|ns\.adobe\.com|purl\.org|iec\.ch|www\.iec\.ch|color\.org|aiim\.org|npes\.org|xml\.org|schemas\.|adobe\.com\/(xap|products\/xmp))/i;
const PDF_LINKS_FILE = path.join(DATA_DIR, 'links-pdf.json');
let pdfLinkStore = {};
try { pdfLinkStore = JSON.parse(fs.readFileSync(PDF_LINKS_FILE, 'utf8')); } catch (_) { }
let pdfStoreDirty = false;
setInterval(() => { if (!pdfStoreDirty) return; pdfStoreDirty = false; try { fs.writeFileSync(PDF_LINKS_FILE, JSON.stringify(pdfLinkStore)); } catch (_) { } }, 30000);
const pdfQueue = []; let pdfBusy = false;

function pdfLinksCached(file, size) {
  const r = pdfLinkStore[file + '|' + size];
  if (r) return r;
  if (!pdfQueue.some(q => q.file === file)) { pdfQueue.push({ file, size }); setImmediate(nextPdf); }
  return null;
}
async function nextPdf() {
  if (pdfBusy || !pdfQueue.length || scanning) { if (scanning && pdfQueue.length) setTimeout(nextPdf, 60000); return; }
  pdfBusy = true;
  const { file, size } = pdfQueue.shift();
  try { pdfLinkStore[file + '|' + size] = await extractPdfLinks(file); pdfStoreDirty = true; }
  catch (_) { pdfLinkStore[file + '|' + size] = []; }
  pdfBusy = false;
  setTimeout(nextPdf, 200);
}
const inflateAsync = (buf) => new Promise(res => zlib.inflate(buf, { maxOutputLength: 4 * 1024 * 1024 }, (e, out) => res(e ? null : out)));
async function extractPdfLinks(file) {
  const st = await fsp.stat(file);
  if (st.size > 40 * 1024 * 1024) return [];
  const raw = await fsp.readFile(file);
  const found = new Set();
  const grab = (txt) => { for (const m of txt.matchAll(/\/URI\s*\(([^)]{4,500})\)/g)) found.add(m[1].replace(/\\(.)/g, '$1')); };
  grab(raw.toString('latin1'));
  // objetos compactados (onde ficam as anotações de link nos PDFs modernos); pula imagens e fontes
  let i = 0;
  for (let n = 0; n < 1500; n++) {
    const s = raw.indexOf('stream', i, 'latin1');
    if (s < 0) break;
    const dict = raw.subarray(Math.max(0, s - 400), s).toString('latin1');
    let start = s + 6;
    if (raw[start] === 0x0d) start++;
    if (raw[start] === 0x0a) start++;
    const e = raw.indexOf('endstream', start, 'latin1');
    if (e < 0) break;
    i = e + 9;
    if (!/\/ObjStm/.test(dict) || !/FlateDecode/.test(dict) || e - start > 2 * 1024 * 1024) continue;
    const out = await inflateAsync(raw.subarray(start, e));
    if (out) grab(out.toString('latin1'));
    if (n % 20 === 0) await new Promise(r => setImmediate(r));
  }
  return [...found].filter(u => /^https?:\/\//i.test(u) && u.length < 400 && !LINK_JUNK.test(u)).slice(0, 80);
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
let files = new Map();        // fileId -> caminho absoluto (da última varredura completa)
let scanFiles = null;         // mapa em montagem durante a varredura (o antigo continua valendo até ela acabar)
const LIB_CACHE = path.join(DATA_DIR, 'biblioteca.json');
let library = [];             // cursos encontrados
let byId = new Map();
let scanning = false, lastScan = null, scanError = null;

function fileId(abs) { const id = sha(abs).slice(0, 16); (scanFiles || files).set(id, abs); return id; }

// ---------- diagnóstico da varredura ----------
const durCache = new Map();   // duração dos vídeos já lidos (evita reler o HD a cada varredura)
let problems = [];            // pastas que a última varredura não conseguiu usar
let scanProblems = null;      // lista em montagem durante a varredura
let scanFound = 0;            // cursos achados até agora na varredura em andamento
const ERR_MSG = {
  EACCES: 'Sem permissão para ler esta pasta', EPERM: 'Sem permissão para ler esta pasta',
  ENOENT: 'A pasta sumiu durante a leitura (HD desconectado?)', EIO: 'Erro de leitura no disco'
};
function addProblem(dir, reason, extra = {}) {
  if (!scanProblems || scanProblems.length >= 500) return;
  if (scanProblems.some(p => p.path === dir)) return;
  scanProblems.push({ path: dir, reason, ...extra });
}

let hdTrouble = 0;            // erros de "disco sumiu" na varredura atual
let dirsRead = 0;
const HD_ERR = new Set(['ENOENT', 'EIO', 'ENOTCONN', 'ESTALE', 'ENXIO', 'ENODEV']);
const NAME_MSG = 'O nome tem emoji ou símbolo especial que o umbrel não consegue abrir neste HD (formato do Mac). Renomeie a pasta no Mac, tirando os caracteres do começo do nome.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listDir(dir) {
  // leitura gentil: uma pausa curta a cada 15 pastas para não sobrecarregar o HD USB
  if (scanning && ++dirsRead % 15 === 0) await sleep(25);
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of ents) {
      if (SKIP.test(e.name)) continue;
      // alguns discos não informam o tipo; descobre com stat
      if (!e.isFile() && !e.isDirectory()) {
        try {
          const st = await fsp.stat(path.join(dir, e.name));
          out.push({ name: e.name, isFile: () => st.isFile(), isDirectory: () => st.isDirectory() });
        } catch (err) { if (err.code === 'EACCES' || err.code === 'EPERM') addProblem(path.join(dir, e.name), ERR_MSG.EACCES); }
        continue;
      }
      out.push(e);
    }
    return out.sort((a, b) => natSort(a.name, b.name));
  } catch (e) {
    if (e.code === 'ENOENT' && /\?/.test(path.basename(dir))) {
      // HD do Mac (HFS+): nomes com emoji ou símbolos especiais chegam como "????" e não podem ser abertos
      addProblem(dir, NAME_MSG);
      return [];
    }
    if (scanning && HD_ERR.has(e.code)) hdTrouble++;
    addProblem(dir, ERR_MSG[e.code] || ('Não consegui ler a pasta (' + (e.code || e.message) + ')'));
    return [];
  }
}

async function extSummary(dir) {
  const counts = {};
  for (const f of await collectFiles(dir)) { const x = extOf(f) || '(sem extensão)'; counts[x] = (counts[x] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ext, n]) => ({ ext, n }));
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
    if (['.mp4', '.m4v', '.mov'].includes(extOf(e.name))) {
      const dk = abs + '|' + size;
      if (durCache.has(dk)) duration = durCache.get(dk);
      else { duration = await mp4Duration(abs); durCache.set(dk, duration); }
    }
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

async function addSubfolders(part, dir, depth) {
  if (depth > 3) return;
  for (const sub of await listDir(dir)) {
    if (!sub.isDirectory() || RES_DIR.test(sub.name)) continue;
    const subDir = path.join(dir, sub.name);
    const sp = await buildFolder(subDir, 'modulo', false);
    part.lessons.push(...sp.lessons); part.materials.push(...sp.materials); part.links.push(...sp.links);
    await addSubfolders(part, subDir, depth + 1);
  }
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
      // módulos com subpastas (capítulos, aulas em pastas): junta tudo, até 3 níveis abaixo
      await addSubfolders(part, path.join(dir, m.name), 1);
      const ct = cleanTitle(m.name);
      modules.push({ title: ct.title || m.name, num: ct.num, lessons: part.lessons, materials: part.materials });
      courseLinks.push(...part.links.map(l => ({ ...l, module: ct.title || m.name })));
    }
  } else {
    modules.push({ title: 'Aulas', num: null, lessons: rootPart.lessons, materials: [], single: true });
    courseMaterials.push(...rootPart.materials); courseLinks.push(...rootPart.links);
  }
  const allLessons = modules.flatMap(m => m.lessons);
  if (!allLessons.length) { addProblem(dir, 'Nenhuma aula encontrada', { exts: await extSummary(dir) }); return null; }
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

// pastas marcadas como "curso inteiro" pela importação de organização (ou por um curso.json)
function relDir(dir, root) {
  let rel = path.relative(root, dir).split(path.sep).join('/');
  if (root !== ROOTS[0]) rel = path.basename(root) + ':' + rel;
  return rel.normalize('NFC').toLowerCase();
}
function isForcedCourse(dir, root) {
  const list = db.forceCourse || [];
  if (!list.length) return false;
  const r = relDir(dir, root);
  return list.some(x => String(x).normalize('NFC').toLowerCase().replace(/^\/+|\/+$/g, '') === r);
}
async function classify(dir, trail, root, out) {
  const ents = await listDir(dir);
  const forceCourse = isForcedCourse(dir, root) || ents.some(e => e.isFile() && /^curso\.json$/i.test(e.name));
  const forceSchool = ents.some(e => e.isFile() && /^escola\.json$/i.test(e.name));
  if (forceCourse) { const c = await buildCourse(dir, trail, root); if (c) { out.push(c); scanFound = out.length; } return; }
  const d = await mediaDepth(dir);
  if (d < 0) {
    if (!(scanProblems || []).some(p => dir.startsWith(p.path + path.sep) || p.path === dir))
      addProblem(dir, 'Nenhum vídeo ou PDF reconhecido', { exts: await extSummary(dir) });
    return;
  }
  if (!forceSchool && d <= 1) { const c = await buildCourse(dir, trail, root); if (c) { out.push(c); scanFound = out.length; } return; }
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
  scanProblems = []; scanFound = 0; hdTrouble = 0; dirsRead = 0;
  scanFiles = new Map();
  const t0 = Date.now();
  try {
    const found = [];
    for (const root of ROOTS) {
      if (!fs.existsSync(root)) continue;
      try { await fsp.readdir(root); } catch (e) { if (HD_ERR.has(e.code)) hdTrouble++; addProblem(root, ERR_MSG[e.code] || e.message); continue; }
      for (const e of await listDir(root)) {
        if (e.isDirectory()) await classify(path.join(root, e.name), [], root, found);
      }
    }
    if (hdTrouble > 0 && library.length) {
      // o HD sumiu no meio da leitura: mantém a lista anterior em vez de mostrar uma pela metade
      lastAttempt = Date.now();
      scanError = 'O HD parou de responder durante a leitura. A lista anterior foi mantida. Confira se o HD aparece no Files, reinicie o app (botão direito › Reiniciar) e clique em Atualizar.';
      console.error(`Varredura cancelada: ${hdTrouble} erros de disco. Lista anterior mantida.`);
      return;
    }
    matchIds(found);
    library = found;
    byId = new Map(found.map(c => [c.id, c]));
    files = scanFiles;
    lastScan = new Date().toISOString();
    problems = scanProblems;
    if (hdTrouble > 0) scanError = 'O HD parou de responder durante a leitura. Reinicie o app e clique em Atualizar.';
    if (db.pendingOrg) {
      try { applyOrg(db.pendingOrg); console.log('Organização pendente aplicada depois de juntar cursos.'); }
      catch (e) { console.error('Organização pendente falhou:', e.message); }
      delete db.pendingOrg;
    }
    saveDb();
    saveLibCache();
    console.log(`Varredura: ${found.length} cursos em ${((Date.now() - t0) / 1000).toFixed(1)}s` + (problems.length ? ` | ${problems.length} pastas ignoradas` : ''));
    for (const p of problems.slice(0, 50)) console.log('  ignorada:', p.path, '-', p.reason);
  } catch (e) { scanError = e.message; console.error('Erro na varredura:', e); }
  finally {
    scanning = false; scanProblems = null; scanFiles = null;
    if (pendingRescan) { pendingRescan = false; setTimeout(scan, 500); }
  }
}

// guarda a biblioteca no disco interno: ao reiniciar, o app abre na hora sem reler o HD
function saveLibCache() {
  try {
    const tmp = LIB_CACHE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, roots: ROOTS, lastScan, library, problems, files: [...files] }));
    fs.renameSync(tmp, LIB_CACHE);
  } catch (e) { console.error('Não consegui guardar a biblioteca:', e.message); }
}
function loadLibCache() {
  try {
    const c = JSON.parse(fs.readFileSync(LIB_CACHE, 'utf8'));
    if (c.v !== 1 || JSON.stringify(c.roots) !== JSON.stringify(ROOTS) || !Array.isArray(c.library)) return false;
    library = c.library; byId = new Map(library.map(x => [x.id, x]));
    files = new Map(c.files || []); problems = c.problems || []; lastScan = c.lastScan || null;
    console.log(`Biblioteca carregada da memória: ${library.length} cursos (última leitura ${lastScan})`);
    return true;
  } catch (e) { return false; }
}
let lastAttempt = 0;
let pendingRescan = false;    // pedido de releitura que chegou durante outra varredura          // varredura cancelada por erro de disco (não tenta de novo antes de 1 dia)
function scanIsDue() {
  if (!lastScan && !lastAttempt) return true;
  const ref = Math.max(lastScan ? Date.parse(lastScan) : 0, lastAttempt);
  return RESCAN_MIN > 0 && Date.now() - ref >= RESCAN_MIN * 60 * 1000;
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
// idioma indicado no nome da pasta: [PT-BR], [EN], (Espanhol)...
const LANG_TAGS = [
  [/\b(pt[-_ ]?br|pt|portugu[eê]s|br)\b/i, 'Português'], [/\b(en|eng|english|ingl[eê]s)\b/i, 'Inglês'],
  [/\b(es|esp|español|espanhol)\b/i, 'Espanhol'], [/\b(fr|français|franc[eê]s)\b/i, 'Francês'],
  [/\b(it|italiano)\b/i, 'Italiano'], [/\b(deutsch|alem[aã]o)\b/i, 'Alemão'], [/\b(jp|ja|japon[eê]s)\b/i, 'Japonês']
];
function langFromName(name) {
  const m = String(name || '').match(/[\[(]([^\])]{2,20})[\])]/g);
  if (!m) return '';
  for (const part of m) for (const [re, lang] of LANG_TAGS) if (re.test(part.slice(1, -1))) return lang;
  return '';
}
function summary(c) {
  const d = courseData(c.id);
  const m = d.meta;
  return {
    id: c.id, title: m.title || c.title, school: m.school ?? c.school, trail: c.trail, kind: c.kind,
    description: m.description || c.description, teacher: c.teacher,
    category: m.category || '', subcategory: m.subcategory || '', tags: m.tags || [],
    language: m.language || langFromName(c.folderName || c.title) || '',
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
    // usa só o que já foi lido; os PDFs novos entram na fila e aparecem na próxima vez que abrir o curso
    const got = pdfLinksCached(abs, m.size || 0);
    if (got) for (const u of got) extra.push({ title: null, url: u, source: m.name, scope: m.scope });
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
    streamTo(res, fs.createReadStream(abs, { start, end }));
  } else {
    res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    streamTo(res, fs.createReadStream(abs));
  }
}
// Envia o arquivo e libera tudo (arquivo e conexão) quando o navegador desiste do vídeo.
// Com .pipe() as conexões abandonadas ficavam presas e esgotavam a memória de rede do umbrel.
function streamTo(res, rs) {
  pipeline(rs, res, () => { rs.destroy(); });
  res.on('close', () => { if (!rs.destroyed) rs.destroy(); });
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
    languages: [...new Set(list.map(c => c.language).filter(Boolean))].sort(natSort),
    suggestions: suggestions(list),
    week: weekStats(),
    scanning, scanFound, lastScan, scanError, roots: ROOTS, notesCount: db.notes.length, problemsCount: problems.length
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
  const allowed = ['title', 'description', 'school', 'category', 'subcategory', 'tags', 'language', 'rating', 'favorite'];
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
route('DELETE', /^\/api\/capa\/(\w+)$/, async (req, res, m) => {
  try { await fsp.unlink(path.join(COVER_DIR, m[1] + '.jpg')); } catch (_) { }
  send(res, 200, { ok: true });
});
route('POST', /^\/api\/varrer$/, async (req, res) => { scan(); send(res, 200, { ok: true }); });
// ---------- backup, lista de cursos e organização em lote ----------
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const nfc = x => String(x || '').normalize('NFC');
// caminho da pasta do curso, relativo à pasta de cursos ("DOMESTIKA/Técnicas de gravura digital")
function relPathOf(c) {
  let rel = path.relative(c.root, c.path).split(path.sep).join('/');
  if (c.root !== ROOTS[0]) rel = path.basename(c.root) + ':' + rel;
  return nfc(rel);
}
function sendDownload(res, name, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, 'Cache-Control': 'no-store' });
  res.end(body);
}
const hoje = () => new Date().toISOString().slice(0, 10);
function autoBackup(motivo) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const f = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${motivo}.json`);
    fs.writeFileSync(f, JSON.stringify({ app: 'escola-do-shin', tipo: 'backup', criadoEm: new Date().toISOString(), db }));
    // guarda só os 15 mais recentes
    const all = fs.readdirSync(BACKUP_DIR).filter(n => n.endsWith('.json')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 15))) fs.unlinkSync(path.join(BACKUP_DIR, old));
    return path.basename(f);
  } catch (e) { console.error('Backup automático falhou:', e.message); return null; }
}

route('GET', /^\/api\/backup$/, async (req, res) => {
  sendDownload(res, `escola-do-shin-backup-${hoje()}.json`, { app: 'escola-do-shin', tipo: 'backup', versao: 1, criadoEm: new Date().toISOString(), cursos: library.length, db });
});
route('POST', /^\/api\/backup\/restaurar$/, async (req, res) => {
  let b;
  try { b = JSON.parse((await readBody(req, 80 * 1024 * 1024)).toString('utf8')); } catch (e) { return send(res, 400, { erro: 'Arquivo inválido: não é um JSON.' }); }
  if (!b || b.app !== 'escola-do-shin' || b.tipo !== 'backup' || !b.db || typeof b.db.courses !== 'object')
    return send(res, 400, { erro: 'Este arquivo não é um backup da Escola do Shin.' });
  const salvo = autoBackup('antes-de-restaurar');
  db = Object.assign({ index: {}, courses: {}, notes: [], activity: {}, categories: [] }, b.db);
  matchIds(library); byId = new Map(library.map(c => [c.id, c])); saveDb(); saveLibCache();
  send(res, 200, { ok: true, cursos: Object.keys(db.courses).length, notas: db.notes.length, backupAnterior: salvo });
});

route('GET', /^\/api\/cursos\/lista$/, async (req, res) => {
  const cursos = library.map(c => {
    const s = summary(c);
    return {
      pasta: relPathOf(c), titulo: s.title, escola: s.school || '', tipo: s.kind, aulas: c.lessonCount,
      duracaoMin: Math.round((c.duration || 0) / 60),
      modulos: c.modules.slice(0, 12).map(m => m.title),
      categoria: s.category, subcategoria: s.subcategory, tags: s.tags, idioma: s.language
    };
  }).sort((a, b) => natSort(a.pasta, b.pasta));
  sendDownload(res, `escola-do-shin-lista-de-cursos-${hoje()}.json`, { app: 'escola-do-shin', tipo: 'lista-de-cursos', criadoEm: new Date().toISOString(), total: cursos.length, cursos });
});

// aceita chaves em português ou inglês
const ORG_FIELDS = { categoria: 'category', category: 'category', subcategoria: 'subcategory', subcategory: 'subcategory', escola: 'school', school: 'school', tags: 'tags', idioma: 'language', language: 'language', titulo: 'title', title: 'title', descricao: 'description', description: 'description' };
function planOrganizacao(body) {
  const entries = body && (body.cursos || body.courses);
  if (!entries || typeof entries !== 'object') throw new Error('O arquivo precisa ter um bloco "cursos".');
  const list = Array.isArray(entries) ? entries.map(e => [e.pasta || e.path, e]) : Object.entries(entries);
  const byRel = new Map(), byLow = new Map(), byName = new Map();
  for (const c of library) {
    const r = relPathOf(c);
    byRel.set(r, c); byLow.set(r.toLowerCase(), c);
    const n = nfc(c.folderName).toLowerCase();
    byName.set(n, byName.has(n) ? null : c);   // null = nome repetido, não dá para usar
  }
  const plan = [], naoEncontrados = [];
  for (const [key, val] of list) {
    const k = nfc(key).replace(/^\/+|\/+$/g, '');
    const c = byRel.get(k) || byLow.get(k.toLowerCase()) || byName.get(k.split('/').pop().toLowerCase());
    if (!c) { naoEncontrados.push(key); continue; }
    const meta = {};
    for (const [f, v] of Object.entries(val || {})) if (ORG_FIELDS[f]) meta[ORG_FIELDS[f]] = v;
    if (meta.tags && !Array.isArray(meta.tags)) meta.tags = String(meta.tags).split(',');
    if (meta.tags) meta.tags = [...new Set(meta.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 30);
    for (const f of Object.keys(meta)) if (f !== 'tags') meta[f] = String(meta[f] ?? '').trim().slice(0, 2000);
    const cur = courseData(c.id).meta;
    const muda = Object.keys(meta).some(f => JSON.stringify(cur[f] ?? (f === 'tags' ? [] : '')) !== JSON.stringify(meta[f]));
    plan.push({ c, meta, muda });
  }
  return { plan, naoEncontrados };
}
function applyPlan(items) {
  db.categories = db.categories || [];
  for (const p of items) {
    const d = courseData(p.c.id);
    for (const [f, v] of Object.entries(p.meta)) {
      if (v === '' || (Array.isArray(v) && !v.length)) delete d.meta[f]; else d.meta[f] = v;
    }
    if (d.meta.category) {
      let cat = db.categories.find(x => x.name === d.meta.category);
      if (!cat) db.categories.push(cat = { name: d.meta.category, subs: [] });
      if (d.meta.subcategory && !cat.subs.includes(d.meta.subcategory)) cat.subs.push(d.meta.subcategory);
    }
  }
}
function applyOrg(body) { applyPlan(planOrganizacao(body).plan.filter(p => p.muda)); }
route('POST', /^\/api\/organizacao\/(previa|aplicar)$/, async (req, res, m) => {
  let body;
  try { body = JSON.parse((await readBody(req, 20 * 1024 * 1024)).toString('utf8')); } catch (e) { return send(res, 400, { erro: 'Arquivo inválido: não é um JSON.' }); }
  let r;
  try { r = planOrganizacao(body); } catch (e) { return send(res, 400, { erro: e.message }); }
  const mudam = r.plan.filter(p => p.muda);
  const cats = [...new Set(r.plan.map(p => p.meta.category).filter(Boolean))].sort(natSort);
  const tags = [...new Set(r.plan.flatMap(p => p.meta.tags || []))].sort(natSort);
  const inteiros = (Array.isArray(body.cursosInteiros) ? body.cursosInteiros : Array.isArray(body.wholeCourses) ? body.wholeCourses : [])
    .map(x => String(x).normalize('NFC').replace(/^\/+|\/+$/g, '')).filter(Boolean);
  const atuais = new Set((db.forceCourse || []).map(x => String(x).normalize('NFC').toLowerCase()));
  const novosInteiros = inteiros.filter(x => !atuais.has(x.toLowerCase()));
  const resumo = {
    cursosInteiros: inteiros.length, novosInteiros: novosInteiros.length,
    noArquivo: r.plan.length + r.naoEncontrados.length, encontrados: r.plan.length, alterados: mudam.length,
    semCurso: r.naoEncontrados.slice(0, 200), totalSemCurso: r.naoEncontrados.length,
    categorias: cats, tags, cursosNaBiblioteca: library.length,
    exemplos: mudam.slice(0, 8).map(p => ({ titulo: summary(p.c).title, ...p.meta }))
  };
  if (m[1] === 'previa') return send(res, 200, resumo);
  const salvo = autoBackup('antes-de-importar');
  applyPlan(mudam);
  let relendo = false;
  if (novosInteiros.length) {
    // junta os módulos: relê a biblioteca e, no fim, aplica de novo a organização (para os cursos juntados)
    db.forceCourse = [...(db.forceCourse || []), ...novosInteiros];
    db.pendingOrg = body;
    relendo = true;
    setTimeout(() => { if (scanning) pendingRescan = true; else scan(); }, 300);
  }
  saveDb();
  send(res, 200, { ...resumo, ok: true, backupAnterior: salvo, relendo });
});
route('GET', /^\/api\/diagnostico$/, async (req, res) => {
  const rel = p => { const r = ROOTS.find(x => p === x || p.startsWith(x + path.sep)); return r ? (r + p.slice(r.length)) : p; };
  send(res, 200, {
    scanning, scanFound, lastScan, scanError, roots: ROOTS.map(r => ({ path: r, exists: fs.existsSync(r) })),
    courses: library.length, uid: typeof process.getuid === 'function' ? process.getuid() : null,
    problems: problems.map(p => ({ ...p, path: rel(p.path) }))
  });
});
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
  if (!loadLibCache() || scanIsDue()) scan();
  // confere de hora em hora se já passou 1 dia desde a última leitura
  setInterval(() => { if (!scanning && scanIsDue()) scan(); }, 60 * 60 * 1000);
});
process.on('uncaughtException', e => console.error('Erro:', e));
process.on('SIGTERM', () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (_) { } process.exit(0); });
