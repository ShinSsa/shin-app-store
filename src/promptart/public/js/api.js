// ── PromptArt API layer ──────────────────────────────────
// Sanctum SPA (cookie de sessão + CSRF). Mapeia o shape da API
// (categories/prompts) para o shape do app (projects/cards).

const API_BASE = '/api';
// uploads privados são servidos pela rota autenticada /media/{path}
const STORAGE_URL_BASE = '/media';

function csrfToken() {
  return (window.PROMPTART && window.PROMPTART.csrf) ||
    document.querySelector('meta[name="csrf-token"]')?.content || '';
}

async function apiFetch(method, url, body) {
  const opts = {
    method,
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrfToken(),
    },
    credentials: 'same-origin',
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + url, opts);

  if (res.status === 401) { window.location.href = '/login'; throw new Error('unauthenticated'); }
  if (res.status === 402) { window.location.href = window.PROMPTART.routes.plans; throw new Error('subscription_required'); }
  if (res.status === 419) { showToast('Sessão expirada — recarregue a página.', true); throw new Error('csrf'); }

  if (!res.ok) {
    let msg = 'Erro inesperado.';
    try {
      const data = await res.json();
      msg = data.message || msg;
      if (data.errors) { msg = Object.values(data.errors).flat()[0] || msg; }
    } catch (_) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

const apiGet = (url) => apiFetch('GET', url);
const apiPost = (url, body) => apiFetch('POST', url, body);
const apiPut = (url, body) => apiFetch('PUT', url, body);
const apiDelete = (url) => apiFetch('DELETE', url);

// Upload multipart com barra de progresso (XHR para ter progress events)
function apiUpload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + '/uploads');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken());
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = 'Falha no upload.';
        try {
          const data = JSON.parse(xhr.responseText);
          msg = data.message || (data.errors && Object.values(data.errors).flat()[0]) || msg;
        } catch (_) {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede no upload.'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

// ── Mapeamento API ⇄ app ────────────────────────────────
function mapPrompt(p) {
  return {
    // ids como string: os handlers inline do HTML passam ids em template strings
    id: String(p.id),
    categoryId: String(p.category_id),
    title: p.title || '',
    tag: p.tag || '',
    text: p.body || '',
    desc: p.description || '',
    thumb: p.thumb1_path || '',
    thumb2: p.thumb2_path || '',
    thumbPos: { x: p.thumb1_pos_x || 'center', y: p.thumb1_pos_y || 'center' },
    thumbPos2: { x: p.thumb2_pos_x || 'center', y: p.thumb2_pos_y || 'center' },
    attachment: p.attachment_path || '',
    attachmentName: p.attachment_name || '',
    favorite: !!p.is_favorite,
    subcats: p.subcategories || [],
  };
}

function mapCategory(c) {
  return {
    id: String(c.id),
    name: c.name || '',
    desc: c.description || '',
    // a capa virou cor: o servidor manda a da frente, a de trás e o texto legível
    color: c.color || '#007aff',
    colorBack: c.color_back || '#0062cc',
    colorText: c.color_text || '#ffffff',
    emoji: '📁',
    subcats: (c.subcategories || []).map(s => s.name),
    subcatIds: Object.fromEntries((c.subcategories || []).map(s => [s.name, s.id])),
    cards: (c.prompts || []).map(mapPrompt),
  };
}

function promptPayload(card) {
  return {
    title: card.title,
    tag: card.tag || null,
    body: card.text,
    description: card.desc || null,
    thumb1_path: card.thumb || null,
    thumb1_pos_x: (card.thumbPos && card.thumbPos.x) || 'center',
    thumb1_pos_y: (card.thumbPos && card.thumbPos.y) || 'center',
    thumb2_path: card.thumb2 || null,
    thumb2_pos_x: (card.thumbPos2 && card.thumbPos2.x) || 'center',
    thumb2_pos_y: (card.thumbPos2 && card.thumbPos2.y) || 'center',
    attachment_path: card.attachment || null,
    attachment_name: card.attachmentName || null,
    is_favorite: !!card.favorite,
    subcategories: card.subcats || [],
  };
}

// Prompts bônus (read-only) no shape de card
function mapBonusPrompt(p) {
  return {
    id: 'bonus_' + p.id,
    title: p.title || '',
    tag: p.tag || '',
    text: p.body || '',
    desc: p.description || '',
    thumb: p.thumb1_url || '',
    thumb2: p.thumb2_url || '',
    thumbPos: { x: 'center', y: 'center' },
    thumbPos2: { x: 'center', y: 'center' },
    attachment: p.attachment_url || '',
    attachmentName: '',
    favorite: !!p.favorite,
    subcats: [],
  };
}
