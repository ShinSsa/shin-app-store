/* Escola do Shin — interface */
(function () {
  'use strict';

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const conteudo = $('#conteudo');
  const S = { lib: null, cursos: {}, top: 'abertos', heroIdx: 0, heroTimer: null, limpeza: [] };

  async function api(url, opts = {}) {
    const o = Object.assign({ headers: {} }, opts);
    if (o.json !== undefined) { o.method = o.method || 'POST'; o.body = JSON.stringify(o.json); o.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(url, o);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.erro || ('Erro ' + r.status));
    return data;
  }
  function aviso(msg) {
    const el = $('#aviso'); el.textContent = msg; el.classList.add('on');
    clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
  }
  function fmtDur(s) {
    if (!s || s < 1) return '';
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${String(m).padStart(2, '0')}min`;
    if (m) return `${m}min`;
    return `${s}s`;
  }
  function fmtTempo(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  }
  function fmtBytes(n) {
    if (!n) return '';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i ? n.toFixed(n < 10 ? 1 : 0).replace('.', ',') : n) + ' ' + u[i];
  }
  function hashN(s, n) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % n; }
  function iniciais(t) { return String(t || '').replace(/^[\d\s\-_.]+/, '').split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'ES'; }
  function capaStyle(c) {
    return c.cover ? `background-image:url('${c.cover}')` : `background-image:var(--c${hashN(c.id, 6) + 1})`;
  }
  function capaHTML(c, extra = '') {
    return `<div class="capa" style="${capaStyle(c)}">${c.cover ? '' : `<span class="iniciais" aria-hidden="true">${esc(iniciais(c.title))}</span>`}${extra}</div>`;
  }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function qs(h) { const i = h.indexOf('?'); return new URLSearchParams(i >= 0 ? h.slice(i + 1) : ''); }

  // ---------- ícones ----------
  const P = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    explorar: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    notas: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>',
    fav: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    org: '<path d="M4 7h16M4 12h10M4 17h6"/><path d="m16 15 2 2 4-4"/>',
    escola: '<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    play: '<polygon points="7 4 19 12 7 20 7 4" fill="currentColor" stroke="none"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    voltar: '<path d="m15 18-6-6 6-6"/>',
    prox: '<path d="m9 18 6-6-6-6"/>',
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    baixar: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    editar: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    atualizar: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    estrela: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    abrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>'
  };
  const ic = (n, s = 20, extra = '') => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[n] || ''}</svg>`;
  const estrelaSVG = (cheia, s = 22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${cheia ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${P.estrela}</svg>`;

  // ---------- tema ----------
  function tema() { return document.documentElement.getAttribute('data-tema') || 'claro'; }
  function trocarTema() {
    const t = tema() === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.setAttribute('data-tema', t);
    try { localStorage.setItem('tema', t); } catch (_) { }
    document.querySelectorAll('[data-acao=tema]').forEach(b => { b.innerHTML = ic(t === 'escuro' ? 'sol' : 'lua', 19); b.setAttribute('aria-label', t === 'escuro' ? 'Usar modo claro' : 'Usar modo escuro'); });
  }
  const botaoTema = () => `<button class="btn-ico" data-acao="tema" aria-label="${tema() === 'escuro' ? 'Usar modo claro' : 'Usar modo escuro'}">${ic(tema() === 'escuro' ? 'sol' : 'lua', 19)}</button>`;

  // ---------- dados ----------
  async function carregarBiblioteca(forcar) {
    if (S.lib && !forcar) return S.lib;
    S.lib = await api('/api/biblioteca');
    return S.lib;
  }
  async function carregarCurso(id, forcar) {
    if (S.cursos[id] && !forcar) return S.cursos[id];
    S.cursos[id] = await api('/api/curso/' + id);
    return S.cursos[id];
  }
  function invalidar() { S.lib = null; S.cursos = {}; }

  // ---------- menu ----------
  function rotaAtual() { return location.hash.replace(/^#/, '') || '/'; }
  function renderMenu() {
    const lib = S.lib;
    const r = rotaAtual();
    const ativo = (teste) => teste ? ' ativo' : '';
    const cs = lib ? lib.courses : [];
    const n = {
      andamento: cs.filter(c => c.progress.started && c.progress.pct < 100).length,
      concluidos: cs.filter(c => c.progress.pct === 100).length,
      escolas: lib ? lib.schools.length : 0,
      pdf: cs.filter(c => c.kind === 'pdf').length,
      org: cs.filter(c => !c.category).length,
      fav: cs.filter(c => c.favorite).length
    };
    const p = qs(r);
    const isExp = r.startsWith('/explorar');
    const sem = lib ? lib.week : { seconds: 0, lessonsDone: 0 };
    $('#menu').innerHTML = `
      <a class="marca" href="#/"><span class="marca-ico" aria-hidden="true"></span><span><b>Escola do Shin</b><small>sua biblioteca de cursos</small></span></a>
      <div class="nav-grupo">
        <a class="nav-item${ativo(r === '/')}" href="#/">${ic('inicio')}Início</a>
        <a class="nav-item${ativo(isExp && ![...p.keys()].length)}" href="#/explorar">${ic('explorar')}Explorar</a>
        <a class="nav-item${ativo(r.startsWith('/notas'))}" href="#/notas">${ic('notas')}Minhas anotações</a>
        <a class="nav-item${ativo(isExp && p.get('fav'))}" href="#/explorar?fav=1">${ic('fav')}Favoritos<span class="cont">${n.fav || ''}</span></a>
        <a class="nav-item${ativo(r.startsWith('/organizar'))}" href="#/organizar">${ic('org')}Para organizar${n.org ? `<span class="cont dest">${n.org}</span>` : ''}</a>
      </div>
      <div class="nav-grupo">
        <div class="nav-titulo">Biblioteca</div>
        <a class="nav-item${ativo(isExp && p.get('status') === 'andamento')}" href="#/explorar?status=andamento">Em andamento<span class="cont">${n.andamento}</span></a>
        <a class="nav-item${ativo(isExp && p.get('status') === 'concluido')}" href="#/explorar?status=concluido">Concluídos<span class="cont">${n.concluidos}</span></a>
        <a class="nav-item${ativo(r.startsWith('/escolas'))}" href="#/escolas">Escolas<span class="cont">${n.escolas}</span></a>
        <a class="nav-item${ativo(isExp && p.get('tipo') === 'pdf')}" href="#/explorar?tipo=pdf">Cursos em PDF<span class="cont">${n.pdf}</span></a>
      </div>
      <div class="semana">
        <span class="muted" style="font-size:13px">Últimos 7 dias</span>
        <strong>${fmtDur(sem.seconds) || '0min'}</strong>
        <span class="muted" style="font-size:12px">${plural(sem.lessonsDone, 'aula concluída', 'aulas concluídas')}</span>
        <button class="btn peq suave" data-acao="varrer" style="margin-top:6px">${ic('atualizar', 16)}Atualizar biblioteca</button>
      </div>`;
    $('#barra-celular').innerHTML = `
      <a class="${r === '/' ? 'ativo' : ''}" href="#/">${ic('inicio', 22)}Início</a>
      <a class="${isExp ? 'ativo' : ''}" href="#/explorar">${ic('explorar', 22)}Explorar</a>
      <a class="${r.startsWith('/notas') ? 'ativo' : ''}" href="#/notas">${ic('notas', 22)}Notas</a>
      <a class="${r.startsWith('/organizar') ? 'ativo' : ''}" href="#/organizar">${ic('org', 22)}Organizar</a>`;
  }

  // ---------- componentes ----------
  function cardContinuar(c) {
    const pr = c.progress;
    return `<a class="card" href="#/aula/${c.id}/${pr.nextKey}">
      ${capaHTML(c, `<span class="selo">${c.kind === 'pdf' ? 'PDF' : 'Vídeo'}</span><span class="play">${ic('play', 14)}</span>`)}
      <div class="card-txt"><b>${esc(c.title)}</b><small>${esc(pr.nextWhere)}${c.school ? ' · ' + esc(c.school) : ''}</small>
        <div class="prog" style="margin-top:6px"><i style="width:${pr.pct}%"></i></div>
        <div class="prog-txt"><b>${pr.pct}%</b><span>${pr.remaining ? 'faltam ' + fmtDur(pr.remaining) : plural(pr.total - pr.done, 'aula restante', 'aulas restantes')}</span></div>
      </div></a>`;
  }
  function cardCurso(c) {
    const pr = c.progress;
    const meta = [c.school, c.category].filter(Boolean).map(esc).join(' · ');
    return `<a class="card" href="#/curso/${c.id}">
      ${capaHTML(c, `<span class="selo">${c.kind === 'pdf' ? 'PDF' : c.kind === 'misto' ? 'Vídeo + PDF' : 'Vídeo'}</span>${c.favorite ? `<span class="selo selo-dir" style="color:var(--red)">${ic('fav', 14, 'fill="currentColor"')}</span>` : ''}`)}
      <div class="card-txt"><b>${esc(c.title)}</b><small>${meta || 'Curso avulso'}</small>
        ${pr.started ? `<div class="prog" style="margin-top:6px"><i style="width:${pr.pct}%"></i></div><div class="prog-txt"><b>${pr.pct}%</b><span>${pr.done}/${pr.total} aulas</span></div>`
        : `<small>${plural(c.lessons, 'aula', 'aulas')}${c.duration ? ' · ' + fmtDur(c.duration) : ''}${c.rating ? ` · <span style="color:var(--amber)">★ ${c.rating}</span>` : ''}</small>`}
      </div></a>`;
  }
  function topo(titulo, sub) {
    return `<div class="topo"><div><h1>${titulo}</h1>${sub ? `<span class="muted">${sub}</span>` : ''}</div>
      <div class="topo-acoes">
        <form class="busca" data-form="busca" role="search"><label class="sr" for="busca">Buscar</label>${ic('busca', 18, 'style="color:var(--muted)"')}
          <input id="busca" type="search" name="q" placeholder="Buscar cursos, aulas ou anotações" autocomplete="off"></form>
        <a class="btn-ico" href="#/explorar" aria-label="Filtros">${ic('filtro', 18)}</a>
        ${botaoTema()}
      </div></div>`;
  }
  function vazioBiblioteca(lib) {
    return `<div class="vazio">${ic('escola', 40)}<b>${lib.scanning ? 'Lendo suas pastas de cursos…' : 'Nenhum curso encontrado ainda'}</b>
      <span>${lib.scanning ? 'Isso pode levar alguns minutos na primeira vez. A página atualiza sozinha.' : `No umbrel, abra as configurações do app › “Acesso às suas pastas” e aponte /cursos para a sua pasta de cursos. Depois clique em “Atualizar biblioteca”.`}</span>
      ${lib.scanError ? `<span style="color:var(--red)">${esc(lib.scanError)}</span>` : ''}</div>`;
  }

  // ---------- telas ----------
  async function telaInicio() {
    const lib = await carregarBiblioteca();
    renderMenu();
    const h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    if (!lib.courses.length) {
      conteudo.innerHTML = topo(saud, 'Bem-vindo à Escola do Shin') + vazioBiblioteca(lib);
      if (lib.scanning) setTimeout(() => { invalidar(); if (rotaAtual() === '/') rota(); }, 4000);
      return;
    }
    const cont = lib.courses.filter(c => c.progress.started && c.progress.pct < 100).sort((a, b) => b.progress.updated - a.progress.updated).slice(0, 8);
    const sug = lib.suggestions;
    S.heroIdx = Math.min(S.heroIdx, Math.max(sug.length - 1, 0));
    const cats = lib.categories;
    conteudo.innerHTML = `
      ${topo(saud, cont.length ? 'Que tal continuar de onde parou?' : 'Escolha um curso para começar')}
      ${sug.length ? `<section class="bloco" aria-label="Sugestões" style="gap:0"><div id="hero"></div>
        <div class="pontos">${sug.map((s, i) => `<button data-hero="${i}" class="${i === S.heroIdx ? 'on' : ''}" aria-label="Sugestão ${i + 1}"></button>`).join('')}</div></section>` : ''}
      ${cont.length ? `<section class="bloco"><div class="bloco-cab"><h2>Continuar assistindo</h2><a class="link-acento" href="#/explorar?status=andamento">Ver tudo</a></div>
        <div class="grade">${cont.slice(0, 4).map(cardContinuar).join('')}</div></section>` : ''}
      <section class="bloco"><div class="bloco-cab"><h2>Categorias</h2></div>
        <div class="chips"><a class="chip on" href="#/explorar">Todas</a>${cats.map(c => `<a class="chip" href="#/explorar?cat=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`).join('')}
        <a class="chip tracejado" href="#/organizar">+ Organizar cursos</a></div></section>
      <section class="bloco"><div class="bloco-cab"><h2>Top 10</h2>
        <div class="abas" role="tablist" aria-label="Ordenar Top 10">
          <button role="tab" data-top="abertos" aria-selected="${S.top === 'abertos'}">Mais abertos</button>
          <button role="tab" data-top="avaliados" aria-selected="${S.top === 'avaliados'}">Melhor avaliados</button></div></div>
        <div class="top" id="top10"></div></section>
      <section class="bloco"><div class="bloco-cab"><h2>Adicionados recentemente</h2><a class="link-acento" href="#/explorar?ordem=novos">Ver tudo</a></div>
        <div class="grade">${[...lib.courses].sort((a, b) => b.firstSeen - a.firstSeen).slice(0, 4).map(cardCurso).join('')}</div></section>`;
    renderHero(); renderTop();
    clearInterval(S.heroTimer);
    if (sug.length > 1) S.heroTimer = setInterval(() => { if (!document.hidden && $('#hero')) { S.heroIdx = (S.heroIdx + 1) % sug.length; renderHero(); } }, 9000);
    gerarCapas(lib.courses);
  }
  function renderHero() {
    const sug = S.lib.suggestions; const el = $('#hero'); if (!el || !sug.length) return;
    const c = sug[S.heroIdx];
    const go = c.progress.started ? `#/aula/${c.id}/${c.progress.nextKey}` : `#/aula/${c.id}/${c.progress.nextKey}`;
    el.innerHTML = `<div class="destaque">
      <div class="destaque-txt"><span class="destaque-tag">${esc(c.reason)}</span>
        <h2>${esc(c.title)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}
        <div class="destaque-meta">${[c.school, c.category && (c.category + (c.subcategory ? ' › ' + c.subcategory : '')), plural(c.lessons, 'aula', 'aulas'), fmtDur(c.duration)].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="destaque-btns"><a class="btn branco" href="${go}">${ic('play', 16)}${c.progress.started ? 'Continuar' : 'Começar curso'}</a><a class="btn vidro" href="#/curso/${c.id}">Ver detalhes</a></div></div>
      <div class="destaque-capa"><div class="img" style="${c.cover ? `background-image:url('${c.cover}')` : ''}">${c.cover ? '' : esc(iniciais(c.title))}</div></div></div>`;
    document.querySelectorAll('[data-hero]').forEach(b => b.classList.toggle('on', +b.dataset.hero === S.heroIdx));
  }
  function renderTop() {
    const el = $('#top10'); if (!el) return;
    let list = [...S.lib.courses];
    if (S.top === 'abertos') list = list.filter(c => c.opens || c.watch).sort((a, b) => (b.opens + b.watch / 600) - (a.opens + a.watch / 600));
    else list = list.filter(c => c.rating).sort((a, b) => b.rating - a.rating || b.opens - a.opens);
    list = list.slice(0, 10);
    if (!list.length) { el.innerHTML = `<p class="muted" style="margin:0">${S.top === 'abertos' ? 'Assim que você abrir alguns cursos, eles aparecem aqui.' : 'Avalie cursos com estrelas na página de cada curso para montar este ranking.'}</p>`; return; }
    el.innerHTML = list.map((c, i) => `<a class="top-item" href="#/curso/${c.id}"><div class="linha"><span class="num${i === 9 ? ' dois' : ''}" aria-hidden="true">${i + 1}</span>${capaHTML(c)}</div>
      <b>${esc(c.title)}</b><small>${S.top === 'abertos' ? `Aberto ${c.opens}×${c.watch ? ' · ' + fmtDur(c.watch) : ''}` : `<span style="color:var(--amber)">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</span>`}</small></a>`).join('');
  }

  async function telaExplorar(p) {
    const lib = await carregarBiblioteca();
    renderMenu();
    const f = {
      q: p.get('q') || '', escola: p.get('escola') || '', cat: p.get('cat') || '', sub: p.get('sub') || '', tag: p.get('tag') || '',
      status: p.get('status') || '', tipo: p.get('tipo') || '', nota: p.get('nota') || '', fav: p.get('fav') || '', ordem: p.get('ordem') || 'nome'
    };
    const cat = lib.categories.find(c => c.name === f.cat);
    const nq = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let list = lib.courses.filter(c => {
      if (f.q && !nq([c.title, c.school, c.category, c.subcategory, c.tags.join(' '), c.description, c.teacher].join(' ')).includes(nq(f.q))) return false;
      if (f.escola && c.school !== f.escola) return false;
      if (f.cat && c.category !== f.cat) return false;
      if (f.sub && c.subcategory !== f.sub) return false;
      if (f.tag && !c.tags.includes(f.tag)) return false;
      if (f.status === 'nao' && c.progress.started) return false;
      if (f.status === 'andamento' && !(c.progress.started && c.progress.pct < 100)) return false;
      if (f.status === 'concluido' && c.progress.pct !== 100) return false;
      if (f.tipo === 'pdf' && c.kind !== 'pdf') return false;
      if (f.tipo === 'video' && c.kind === 'pdf') return false;
      if (f.nota && c.rating < +f.nota) return false;
      if (f.fav && !c.favorite) return false;
      return true;
    });
    const sorters = {
      nome: (a, b) => a.title.localeCompare(b.title, 'pt-BR', { numeric: true }),
      novos: (a, b) => b.firstSeen - a.firstSeen,
      recentes: (a, b) => b.progress.updated - a.progress.updated,
      progresso: (a, b) => b.progress.pct - a.progress.pct,
      avaliacao: (a, b) => b.rating - a.rating,
      abertos: (a, b) => b.opens - a.opens
    };
    list.sort(sorters[f.ordem] || sorters.nome);
    const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? v)}</option>`;
    let notasHtml = '';
    if (f.q) {
      try {
        const notas = (await api('/api/notas')).filter(n => nq(n.text + ' ' + n.lessonTitle).includes(nq(f.q))).slice(0, 6);
        if (notas.length) notasHtml = `<section class="bloco"><div class="bloco-cab"><h2>Nas suas anotações</h2></div><div class="grupo-notas">${notas.map(notaLista).join('')}</div></section>`;
      } catch (_) { }
    }
    conteudo.innerHTML = `${topo('Explorar', plural(lib.courses.length, 'curso na biblioteca', 'cursos na biblioteca'))}
      <form class="filtros" data-form="filtros" aria-label="Filtros">
        <label class="sr" for="f-q">Buscar</label><input id="f-q" type="search" name="q" value="${esc(f.q)}" placeholder="Buscar">
        <label class="sr" for="f-escola">Escola</label><select id="f-escola" name="escola">${opt('', f.escola, 'Todas as escolas')}${lib.schools.map(s => opt(s, f.escola)).join('')}</select>
        <label class="sr" for="f-cat">Categoria</label><select id="f-cat" name="cat">${opt('', f.cat, 'Todas as categorias')}${lib.categories.map(c => opt(c.name, f.cat)).join('')}</select>
        ${cat && cat.subs.length ? `<label class="sr" for="f-sub">Subcategoria</label><select id="f-sub" name="sub">${opt('', f.sub, 'Todas as subcategorias')}${cat.subs.map(s => opt(s, f.sub)).join('')}</select>` : ''}
        ${lib.tags.length ? `<label class="sr" for="f-tag">Tag</label><select id="f-tag" name="tag">${opt('', f.tag, 'Todas as tags')}${lib.tags.map(t => opt(t, f.tag)).join('')}</select>` : ''}
        <label class="sr" for="f-status">Situação</label><select id="f-status" name="status">${opt('', f.status, 'Qualquer situação')}${opt('nao', f.status, 'Não iniciados')}${opt('andamento', f.status, 'Em andamento')}${opt('concluido', f.status, 'Concluídos')}</select>
        <label class="sr" for="f-tipo">Tipo</label><select id="f-tipo" name="tipo">${opt('', f.tipo, 'Vídeo e PDF')}${opt('video', f.tipo, 'Com vídeo')}${opt('pdf', f.tipo, 'Só PDF')}</select>
        <label class="sr" for="f-nota">Avaliação</label><select id="f-nota" name="nota">${opt('', f.nota, 'Qualquer nota')}${[5, 4, 3].map(n => opt(String(n), f.nota, n + '★ ou mais')).join('')}</select>
        <label class="sr" for="f-ordem">Ordenar</label><select id="f-ordem" name="ordem">${opt('nome', f.ordem, 'Ordem: nome')}${opt('novos', f.ordem, 'Adicionados recentemente')}${opt('recentes', f.ordem, 'Assistidos recentemente')}${opt('progresso', f.ordem, 'Progresso')}${opt('avaliacao', f.ordem, 'Avaliação')}${opt('abertos', f.ordem, 'Mais abertos')}</select>
        <label class="cb"><input type="checkbox" name="fav" value="1"${f.fav ? ' checked' : ''}> Favoritos</label>
        ${[...p.keys()].length ? `<a class="btn peq suave" href="#/explorar">Limpar</a>` : ''}
      </form>
      ${notasHtml}
      ${lib.courses.length ? `<div class="resultado">${plural(list.length, 'curso encontrado', 'cursos encontrados')}</div>
        ${list.length ? `<div class="grade">${list.map(cardCurso).join('')}</div>` : `<div class="vazio"><b>Nada por aqui</b><span>Tente mudar ou limpar os filtros.</span></div>`}` : vazioBiblioteca(lib)}`;
    gerarCapas(list);
  }

  async function telaEscolas() {
    const lib = await carregarBiblioteca();
    renderMenu();
    const grupos = {};
    for (const c of lib.courses) { const s = c.school || 'Cursos avulsos'; (grupos[s] = grupos[s] || []).push(c); }
    const nomes = Object.keys(grupos).sort((a, b) => a === 'Cursos avulsos' ? 1 : b === 'Cursos avulsos' ? -1 : a.localeCompare(b, 'pt-BR'));
    conteudo.innerHTML = topo('Escolas', 'Cursos agrupados pela pasta de origem') + nomes.map(n => {
      const cs = grupos[n];
      const feitos = cs.filter(c => c.progress.pct === 100).length;
      return `<section class="bloco"><div class="bloco-cab"><h2>${esc(n)} <span class="muted" style="font-size:14px;font-weight:500">· ${plural(cs.length, 'curso', 'cursos')} · ${feitos} concluídos</span></h2>
        ${n !== 'Cursos avulsos' ? `<a class="link-acento" href="#/explorar?escola=${encodeURIComponent(n)}">Ver todos</a>` : ''}</div>
        <div class="grade">${cs.slice(0, 8).map(cardCurso).join('')}</div></section>`;
    }).join('');
  }

  async function telaOrganizar() {
    const lib = await carregarBiblioteca();
    renderMenu();
    const sem = lib.courses.filter(c => !c.category);
    conteudo.innerHTML = topo('Para organizar', sem.length ? 'Cursos novos sem categoria. Clique para definir categoria, subcategoria e tags.' : '') +
      (sem.length ? `<div class="grade">${sem.map(c => `<button class="card" data-acao="editar" data-id="${c.id}" style="border:0;text-align:left;color:inherit">
          ${capaHTML(c, `<span class="selo">${c.kind === 'pdf' ? 'PDF' : 'Vídeo'}</span>`)}
          <div class="card-txt"><b>${esc(c.title)}</b><small>${esc(c.school || 'Curso avulso')} · ${plural(c.lessons, 'aula', 'aulas')}</small>
          <span class="btn peq suave" style="align-self:flex-start;margin-top:6px">${ic('editar', 14)}Organizar</span></div></button>`).join('')}</div>`
        : `<div class="vazio">${ic('check', 36)}<b>Tudo organizado</b><span>Quando você colocar cursos novos na pasta, eles aparecem aqui.</span></div>`);
    gerarCapas(sem);
  }

  function notaLista(n) {
    const quando = n.t != null ? fmtTempo(n.t) : n.page ? 'pág. ' + n.page : '—';
    const href = n.available ? `#/aula/${n.course}/${n.lesson}${n.t != null ? '?t=' + Math.floor(n.t) : ''}` : null;
    return `<div class="nota"><span class="tempo" style="display:flex;align-items:center">${esc(quando)}</span>
      <div class="txt">${esc(n.text)}<div style="margin-top:6px;font-size:12px" class="muted">${esc(n.courseTitle)} · ${esc(n.lessonTitle || '')}${href ? ` · <a class="ir" href="${href}">abrir aula</a>` : ''}</div></div>
      <button class="apagar" data-acao="apagar-nota" data-id="${n.id}" aria-label="Apagar anotação">${ic('lixo', 16)}</button></div>`;
  }
  async function telaNotas(p) {
    await carregarBiblioteca(); renderMenu();
    const notas = await api('/api/notas');
    const q = (p.get('q') || '').toLowerCase();
    const lista = q ? notas.filter(n => (n.text + n.courseTitle + n.lessonTitle).toLowerCase().includes(q)) : notas;
    const grupos = {};
    for (const n of lista) (grupos[n.courseTitle] = grupos[n.courseTitle] || []).push(n);
    conteudo.innerHTML = topo('Minhas anotações', plural(notas.length, 'anotação', 'anotações')) +
      `<form class="filtros" data-form="notas"><label class="sr" for="n-q">Buscar nas anotações</label><input id="n-q" type="search" name="q" value="${esc(p.get('q') || '')}" placeholder="Buscar nas anotações"></form>` +
      (lista.length ? Object.entries(grupos).map(([t, ns]) => `<section class="bloco"><div class="bloco-cab"><h2>${esc(t)}</h2></div><div class="grupo-notas">${ns.map(notaLista).join('')}</div></section>`).join('')
        : `<div class="vazio">${ic('notas', 36)}<b>${notas.length ? 'Nenhuma anotação encontrada' : 'Nenhuma anotação ainda'}</b><span>Durante uma aula, escreva no painel “Anotações”. O minuto do vídeo fica salvo junto.</span></div>`);
  }

  // ---------- curso ----------
  function listaModulos(c, atual) {
    const total = c.modules.length;
    return c.modules.map((m, mi) => {
      const feitas = m.lessons.filter(l => l.done).length;
      const temAtual = atual && m.lessons.some(l => l.key === atual);
      const aberto = temAtual || (!atual && (total <= 3 || m.lessons.some(l => !l.done)) && mi === c.modules.findIndex(x => x.lessons.some(l => !l.done)));
      const nome = m.single ? 'Aulas' : (m.num === 0 && m.title === 'Introdução' ? 'Introdução' : `${m.num != null ? m.num : mi + 1} · ${m.title}`);
      return `<details class="modulo"${aberto || total === 1 ? ' open' : ''}><summary><span>${esc(nome)}</span><small class="${feitas === m.lessons.length ? 'ok' : ''}">${feitas}/${m.lessons.length}${feitas === m.lessons.length ? ' ✓' : ''}</small></summary>
        ${m.lessons.map((l, li) => {
          const ag = l.key === atual;
          return `<a class="aula-item${ag ? ' atual' : ''}" href="#/aula/${c.id}/${l.key}"${ag ? ' aria-current="true"' : ''}>
            <span class="bola${ag ? ' agora' : l.done ? ' ok' : ''}">${ag ? ic('play', 10) : l.done ? ic('check', 12, 'stroke-width="3.5"') : ''}</span>
            <span class="t">${String(l.num ?? li + 1).padStart(2, '0')} · ${esc(l.title)}</span>
            ${l.type === 'pdf' ? '<span class="pdf">PDF</span>' : `<span class="d">${l.duration ? fmtTempo(l.duration) : ''}</span>`}</a>`;
        }).join('')}
        ${m.materials.length ? `<div style="padding:8px 10px 4px" class="muted"><small>${plural(m.materials.length, 'material', 'materiais')} neste módulo</small></div>` : ''}</details>`;
    }).join('');
  }
  function materialHTML(m, cid) {
    const quando = m.scope === 'aula' ? 'Desta aula' : m.scope === 'modulo' ? 'Do módulo' : 'Do curso';
    return `<div class="mat"><span class="ext ${esc(m.ext)}">${esc(m.ext.slice(0, 4))}</span>
      <span class="nm"><b title="${esc(m.name)}">${esc(m.name)}</b><small>${quando}${m.size ? ' · ' + fmtBytes(m.size) : ''}${m.viewable ? '' : ' · só download'}</small></span>
      ${m.viewable ? `<button class="btn-ico peq" data-acao="ver" data-id="${m.id}" data-tipo="${m.viewable}" data-nome="${esc(m.name)}" aria-label="Visualizar ${esc(m.name)}">${ic('olho', 17)}</button>` : ''}
      <a class="btn-ico peq" href="/f/${m.id}?baixar=1" download aria-label="Baixar ${esc(m.name)}">${ic('baixar', 17)}</a></div>`;
  }
  function linksHTML(c) {
    return c.links.map(l => {
      let dom = l.url; try { dom = new URL(l.url).hostname.replace(/^www\./, ''); } catch (_) { }
      return `<div class="lnk"><a class="ico" href="${esc(l.url)}" target="_blank" rel="noopener" aria-label="Abrir link">${ic('link', 15)}</a>
        <a class="nm" href="${esc(l.url)}" target="_blank" rel="noopener"><b>${esc(l.title || dom)}</b><small>${esc(l.title ? dom : l.url)}</small></a>
        <span class="fonte" title="${esc(l.source)}">${esc(l.source)}</span>
        ${l.source === 'manual' ? `<button class="apagar btn-ico peq" data-acao="remover-link" data-url="${esc(l.url)}" data-id="${c.id}" aria-label="Remover link">${ic('x', 14)}</button>` : ''}</div>`;
    }).join('');
  }
  function painelLinks(c) {
    return `<div class="painel"><div class="bloco-cab"><h2>Links</h2><button class="btn peq suave" data-acao="add-link" data-id="${c.id}">+ Adicionar</button></div>
      ${c.links.length ? linksHTML(c) : '<p class="muted" style="margin:0;font-size:14px">Nenhum link. Coloque um <b>links.txt</b> na pasta de materiais, ou adicione aqui.</p>'}</div>`;
  }
  function estrelasHTML(c) {
    return `<div class="estrelas" role="group" aria-label="Sua avaliação">${[1, 2, 3, 4, 5].map(n => `<button data-acao="nota" data-id="${c.id}" data-v="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}" aria-pressed="${c.rating >= n}">${estrelaSVG(c.rating >= n)}</button>`).join('')}</div>`;
  }

  async function telaCurso(id) {
    const [lib, c] = await Promise.all([carregarBiblioteca(), carregarCurso(id, true)]);
    renderMenu();
    api('/api/curso/' + id + '/abrir', { method: 'POST' }).catch(() => { });
    const pr = c.progress;
    const allMats = c.materials;
    conteudo.innerHTML = `
      <div class="aula-topo"><div class="trilha"><a class="btn-ico" href="javascript:history.back()" aria-label="Voltar">${ic('voltar', 18)}</a><span>${esc(c.school || 'Curso avulso')}</span></div>${botaoTema()}</div>
      <div class="curso-topo">
        ${capaHTML(c)}
        <div class="curso-info">
          <div class="tags">${c.school ? `<span class="tag esc">${esc(c.school)}</span>` : ''}${c.category ? `<a class="tag cat" href="#/explorar?cat=${encodeURIComponent(c.category)}">${esc(c.category)}${c.subcategory ? ' › ' + esc(c.subcategory) : ''}</a>` : ''}${c.tags.map(t => `<a class="tag" href="#/explorar?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
          <h1>${esc(c.title)}</h1>
          ${c.description ? `<p>${esc(c.description)}</p>` : ''}
          <div class="muted" style="font-size:14px">${[c.teacher, c.modules.length > 1 || !c.modules[0].single ? plural(c.modules.length, 'módulo', 'módulos') : '', plural(c.lessons, 'aula', 'aulas'), fmtDur(c.duration)].filter(Boolean).map(esc).join(' · ')}</div>
          ${pr.started ? `<div style="display:flex;align-items:center;gap:12px"><div class="prog" style="flex:1;max-width:320px"><i style="width:${pr.pct}%"></i></div><b style="color:var(--accent)">${pr.pct}%</b><span class="muted" style="font-size:13px">${pr.done}/${pr.total} aulas</span></div>` : ''}
          <div class="linha-acoes">
            <a class="btn prim" href="#/aula/${c.id}/${pr.nextKey}">${ic('play', 16)}${pr.started ? (pr.pct === 100 ? 'Rever curso' : 'Continuar · ' + esc(pr.nextWhere)) : 'Começar curso'}</a>
            <button class="btn sec" data-acao="fav" data-id="${c.id}" aria-pressed="${c.favorite}">${ic('fav', 18, c.favorite ? 'fill="currentColor" style="color:var(--red)"' : '')}${c.favorite ? 'Favorito' : 'Favoritar'}</button>
            <button class="btn sec" data-acao="editar" data-id="${c.id}">${ic('editar', 18)}Editar</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px"><span class="muted" style="font-size:13px">Sua avaliação</span>${estrelasHTML(c)}</div>
        </div>
      </div>
      <div class="duas-col">
        <div class="col-larga"><div class="painel"><h2>Conteúdo do curso</h2>${listaModulos(c, null)}</div></div>
        <div class="col-lado">
          ${allMats.length ? `<div class="painel"><h2>Materiais do curso</h2>${allMats.map(m => materialHTML(m, c.id)).join('')}</div>` : ''}
          ${painelLinks(c)}
        </div>
      </div>`;
    gerarCapas([c]);
  }

  // ---------- aula ----------
  async function telaAula(id, key, p) {
    const [lib, c] = await Promise.all([carregarBiblioteca(), carregarCurso(id, true)]);
    renderMenu();
    const all = c.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ ...l, mi, li, m })));
    const idx = Math.max(0, all.findIndex(l => l.key === key));
    const L = all[idx];
    if (!L) { conteudo.innerHTML = '<div class="vazio"><b>Aula não encontrada</b></div>'; return; }
    const prox = all[idx + 1];
    const ant = all[idx - 1];
    const onde = L.m.single ? `Aula ${L.li + 1}` : (L.m.num === 0 && L.m.title === 'Introdução' ? `Introdução · Aula ${L.li + 1}` : `Módulo ${L.m.num ?? L.mi + 1} · Aula ${L.li + 1}`);
    const notas = (await api('/api/notas')).filter(n => n.course === id && n.lesson === L.key).sort((a, b) => (a.t ?? a.page ?? 0) - (b.t ?? b.page ?? 0));
    const mats = [...L.materials, ...L.m.materials, ...c.materials];
    const isPdf = L.type === 'pdf';
    const escura = localStorage.getItem('pdfEscuro') === '1';
    const vel = parseFloat(localStorage.getItem('velocidade') || '1');
    conteudo.innerHTML = `
      <div class="aula-topo">
        <div class="trilha"><a class="btn-ico" href="#/curso/${c.id}" aria-label="Voltar ao curso">${ic('voltar', 18)}</a>${c.school ? `<span>${esc(c.school)}</span><span aria-hidden="true">/</span>` : ''}<a href="#/curso/${c.id}"><b>${esc(c.title)}</b></a></div>
        <div style="display:flex;align-items:center;gap:12px"><div class="mini-prog"><span>Curso</span><div class="prog"><i id="prog-curso" style="width:${c.progress.pct}%"></i></div><b id="pct-curso" style="color:var(--accent)">${c.progress.pct}%</b></div>${botaoTema()}</div>
      </div>
      <div class="duas-col">
        <div class="col-larga">
          <div class="player" id="player">
            ${isPdf ? `<iframe id="pdf" class="${escura ? 'escura' : ''}" src="/f/${L.fileId}#view=FitH" title="${esc(L.title)}"></iframe>
              <div class="player-barra"><span>Aula em PDF</span><div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn peq" style="background:rgba(255,255,255,.1);color:#E6E8EB" data-acao="pdf-escuro">${escura ? 'Página clara' : 'Página escura'}</button>
                <a class="btn peq" style="background:rgba(255,255,255,.1);color:#E6E8EB" href="/f/${L.fileId}" target="_blank" rel="noopener">${ic('abrir', 14)}Tela cheia</a>
                <a class="btn peq" style="background:rgba(255,255,255,.1);color:#E6E8EB" href="/f/${L.fileId}?baixar=1" download>${ic('baixar', 14)}Baixar</a></div></div>`
            : L.playable ? `<video id="video" controls playsinline preload="metadata" src="/f/${L.fileId}"></video>
              <div class="player-barra"><span id="tempo-atual">${L.pos ? 'Retomando de ' + fmtTempo(L.pos) : ' '}</span>
                <div class="velocidades" role="group" aria-label="Velocidade">${[1, 1.25, 1.5, 1.75, 2].map(v => `<button data-vel="${v}" class="${v === vel ? 'on' : ''}">${String(v).replace('.', ',')}×</button>`).join('')}</div></div>
              <div class="player-barra" style="padding-top:0"><div class="marcas" id="marcas" style="flex:1;margin:0" aria-label="Anotações na linha do tempo"><span class="trilho"></span></div></div>`
            : `<div class="vazio" style="border-radius:0;background:transparent;color:#C9D0D9"><b style="color:#fff">Este formato não toca no navegador</b><span>${esc(L.file)} — converta para MP4 (H.264) para assistir aqui.</span><a class="btn branco" href="/f/${L.fileId}?baixar=1" download>${ic('baixar', 16)}Baixar o vídeo</a></div>`}
          </div>
          <div class="titulo-aula">
            <div style="display:flex;flex-direction:column;min-width:0"><span class="sel">${esc(onde)}</span><h1>${esc(L.title)}</h1></div>
            <div class="linha-acoes">
              ${ant ? `<a class="btn sec" href="#/aula/${c.id}/${ant.key}" aria-label="Aula anterior">${ic('voltar', 18)}</a>` : ''}
              <button class="btn sec" id="btn-concluir" data-feito="${L.done ? 1 : 0}">${ic('check', 18, 'stroke-width="2.4" style="color:var(--accent)"')}<span>${L.done ? 'Concluída' : 'Concluir aula'}</span></button>
              ${prox ? `<a class="btn prim" href="#/aula/${c.id}/${prox.key}">Próxima aula${ic('prox', 18)}</a>` : `<a class="btn prim" href="#/curso/${c.id}">Fim do curso</a>`}
            </div>
          </div>
          <div class="duas-col" style="gap:20px">
            <section class="painel" style="flex:3 1 340px" aria-labelledby="t-notas">
              <div class="bloco-cab"><h2 id="t-notas">Anotações</h2><span class="muted" style="font-size:13px" id="n-notas">${plural(notas.length, 'nesta aula', 'nesta aula')}</span></div>
              <div id="lista-notas" class="grupo-notas"></div>
              <form data-form="nota" style="display:flex;flex-direction:column;gap:8px">
                <label for="nova-nota" class="muted" style="font-size:13px">${isPdf ? 'Nova anotação na página' : 'Nova anotação em'} <b id="nota-tempo" style="color:var(--amber)">${isPdf ? '' : fmtTempo(L.pos)}</b></label>
                <div class="nova-nota">${isPdf ? `<input class="campo-pagina" type="number" min="1" name="pagina" aria-label="Página" placeholder="Pág." value="${L.page || ''}">` : ''}
                  <textarea id="nova-nota" name="texto" rows="2" placeholder="Escreva o que quer lembrar"></textarea>
                  <button class="btn solido" type="submit" style="height:52px">Salvar</button></div>
              </form>
            </section>
            <section class="painel" style="flex:2 1 300px" aria-labelledby="t-mats">
              <h2 id="t-mats">Materiais</h2>
              ${mats.length ? mats.map(m => materialHTML(m, c.id)).join('') : '<p class="muted" style="margin:0;font-size:14px">Sem materiais para esta aula.</p>'}
            </section>
          </div>
          ${painelLinks(c)}
        </div>
        <aside class="col-lado"><div class="painel"><h2>Conteúdo do curso</h2><span class="muted" style="font-size:13px;margin-top:-6px">${plural(c.lessons, 'aula', 'aulas')} · ${c.progress.done} concluídas</span>${listaModulos(c, L.key)}</div>
          <div class="painel" style="background:var(--amber-soft)"><span style="font-size:13px;font-weight:600">Sua avaliação do curso</span>${estrelasHTML(c)}</div></aside>
      </div>`;

    const state = { notas, L, c };
    renderNotas(state);
    setTimeout(() => { const a = $('.aula-item.atual'); if (a && window.innerWidth > 900) a.scrollIntoView({ block: 'nearest' }); }, 50);

    const salvar = (extra = {}) => api('/api/progresso', { json: Object.assign({ course: c.id, lesson: L.key }, extra) }).then(r => {
      if (r.progress) { const pe = $('#prog-curso'); if (pe) { pe.style.width = r.progress.pct + '%'; $('#pct-curso').textContent = r.progress.pct + '%'; } }
      S.lib = null; return r;
    }).catch(() => { });

    const btnC = $('#btn-concluir');
    const marcarFeito = (v) => {
      btnC.dataset.feito = v ? 1 : 0; btnC.querySelector('span').textContent = v ? 'Concluída' : 'Concluir aula';
      L.done = v;
    };
    btnC.addEventListener('click', () => { const v = btnC.dataset.feito !== '1'; marcarFeito(v); salvar({ done: v }); aviso(v ? 'Aula concluída' : 'Aula marcada como não concluída'); });

    if (isPdf) {
      salvar({ watched: 0 });
      return;
    }
    const v = $('#video');
    if (!v) return;
    state.video = v;
    v.playbackRate = vel;
    let ultimo = null, acumulado = 0, salvoEm = 0, capturou = !!c.cover;
    v.addEventListener('loadedmetadata', () => {
      if (L.pos && L.pos < v.duration - 15) v.currentTime = L.pos;
      const t = parseFloat(p.get('t')); if (!isNaN(t)) v.currentTime = t;
      v.playbackRate = parseFloat(localStorage.getItem('velocidade') || '1');
      renderMarcas(state);
      salvar({ dur: v.duration });
    });
    v.addEventListener('timeupdate', () => {
      const t = v.currentTime;
      $('#nota-tempo').textContent = fmtTempo(t);
      $('#tempo-atual').textContent = fmtTempo(t) + ' / ' + fmtTempo(v.duration);
      if (ultimo != null && !v.paused) { const d = t - ultimo; if (d > 0 && d < 3) acumulado += d / (v.playbackRate || 1); }
      ultimo = t;
      if (!L.done && v.duration && t / v.duration >= 0.9) { marcarFeito(true); salvar({ done: true, pos: t }); }
      if (Date.now() - salvoEm > 8000) { salvoEm = Date.now(); salvar({ pos: t, watched: acumulado }); acumulado = 0; }
      if (!capturou && t > 4) { capturou = true; capturarDoVideo(v, c.id).then(ok => { if (ok) { S.cursos[c.id] = null; S.lib = null; } }); }
    });
    v.addEventListener('seeking', () => { ultimo = null; });
    v.addEventListener('pause', () => { salvar({ pos: v.currentTime, watched: acumulado }); acumulado = 0; });
    v.addEventListener('ended', () => {
      salvar({ pos: 0, done: true, watched: acumulado }); acumulado = 0; marcarFeito(true);
      if (!prox) return;
      const cx = document.createElement('div'); cx.className = 'contagem';
      let n = 6;
      cx.innerHTML = `<span>Próxima aula</span><b>${esc(prox.title)}</b><span id="cont-n">em ${n}s</span><div class="linha-acoes"><a class="btn branco" href="#/aula/${c.id}/${prox.key}">Assistir agora</a><button class="btn vidro" id="cancela">Cancelar</button></div>`;
      $('#player').appendChild(cx);
      const tm = setInterval(() => { n--; const e = $('#cont-n'); if (e) e.textContent = `em ${n}s`; if (n <= 0) { clearInterval(tm); location.hash = `#/aula/${c.id}/${prox.key}`; } }, 1000);
      $('#cancela').addEventListener('click', () => { clearInterval(tm); cx.remove(); });
      S.limpeza.push(() => clearInterval(tm));
    });
    const sair = () => { if (!v.paused || v.currentTime) navigator.sendBeacon && navigator.sendBeacon('/api/progresso', new Blob([JSON.stringify({ course: c.id, lesson: L.key, pos: v.currentTime, watched: acumulado })], { type: 'application/json' })); acumulado = 0; };
    window.addEventListener('pagehide', sair);
    S.limpeza.push(() => { sair(); window.removeEventListener('pagehide', sair); v.pause(); v.removeAttribute('src'); v.load(); });
    S.aula = state;
  }
  function renderNotas(st) {
    const el = $('#lista-notas'); if (!el) return;
    el.innerHTML = st.notas.length ? st.notas.map(n => `<div class="nota">
      ${n.t != null ? `<button class="tempo" data-acao="ir-tempo" data-t="${n.t}" aria-label="Ir para ${fmtTempo(n.t)}">${fmtTempo(n.t)}</button>` : n.page ? `<span class="tempo" style="display:flex;align-items:center">pág. ${n.page}</span>` : ''}
      <div class="txt">${esc(n.text)}</div>
      <button class="apagar" data-acao="apagar-nota" data-id="${n.id}" aria-label="Apagar anotação">${ic('lixo', 16)}</button></div>`).join('')
      : '<p class="muted" style="margin:0;font-size:14px">Nenhuma anotação nesta aula ainda.</p>';
    const c = $('#n-notas'); if (c) c.textContent = plural(st.notas.length, 'nesta aula', 'nesta aula');
    renderMarcas(st);
  }
  function renderMarcas(st) {
    const el = $('#marcas'); const v = st.video;
    if (!el || !v || !v.duration) return;
    el.innerHTML = '<span class="trilho"></span>' + st.notas.filter(n => n.t != null).map(n =>
      `<button style="left:${Math.min(100, n.t / v.duration * 100)}%" data-acao="ir-tempo" data-t="${n.t}" title="${esc(fmtTempo(n.t) + ' — ' + n.text.slice(0, 60))}" aria-label="Anotação em ${fmtTempo(n.t)}"></button>`).join('');
  }

  // ---------- capas automáticas ----------
  const filaCapas = []; let gerando = false; const tentadas = new Set();
  function gerarCapas(lista) {
    for (const c of lista) if (!c.cover && c.needsCover && !tentadas.has(c.id)) { tentadas.add(c.id); filaCapas.push(c); }
    proximaCapa();
  }
  function capturarDoVideo(v, id) {
    return new Promise(resolve => {
      try {
        const w = 640, h = Math.round(640 * (v.videoHeight / v.videoWidth || 9 / 16));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(v, 0, 0, w, h);
        cv.toBlob(b => {
          if (!b) return resolve(false);
          fetch('/api/capa/' + id, { method: 'POST', body: b, headers: { 'Content-Type': 'image/jpeg' } }).then(r => resolve(r.ok)).catch(() => resolve(false));
        }, 'image/jpeg', 0.82);
      } catch (e) { resolve(false); }
    });
  }
  function proximaCapa() {
    if (gerando || !filaCapas.length) return;
    gerando = true;
    const c = filaCapas.shift();
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.crossOrigin = 'anonymous';
    let feito = false;
    const fim = (ok) => {
      if (feito) return; feito = true; clearTimeout(to);
      v.removeAttribute('src'); v.load(); gerando = false;
      if (ok) {
        const url = '/capa/' + c.id + '?v=' + Date.now();
        if (S.lib) { const x = S.lib.courses.find(y => y.id === c.id); if (x) x.cover = url; }
        document.querySelectorAll(`a[href="#/curso/${c.id}"] .capa, [data-id="${c.id}"] .capa`).forEach(el => { el.style.backgroundImage = `url('${url}')`; const i = el.querySelector('.iniciais'); if (i) i.remove(); });
      }
      setTimeout(proximaCapa, 300);
    };
    const to = setTimeout(() => fim(false), 20000);
    v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(Math.max(5, v.duration * 0.12), 90, Math.max(v.duration - 1, 0)); });
    v.addEventListener('seeked', () => capturarDoVideo(v, c.id).then(fim));
    v.addEventListener('error', () => fim(false));
    v.src = '/f/' + c.needsCover;
  }

  // ---------- modais ----------
  function abrirModal(html, cls = '') {
    const raiz = $('#modal-raiz');
    raiz.innerHTML = `<div class="modal-fundo" data-acao="fechar-fundo"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
    document.body.style.overflow = 'hidden';
    const f = raiz.querySelector('input,textarea,button'); if (f) f.focus();
  }
  function fecharModal() { $('#modal-raiz').innerHTML = ''; document.body.style.overflow = ''; }

  async function verMaterial(id, tipo, nome) {
    const escura = localStorage.getItem('pdfEscuro') === '1';
    let corpo = '';
    if (tipo === 'pdf') corpo = `<iframe id="ver-pdf" class="${escura ? 'escura' : ''}" src="/f/${id}#view=FitH" title="${esc(nome)}"></iframe>`;
    else if (tipo === 'img') corpo = `<img src="/f/${id}" alt="${esc(nome)}" data-acao="zoom">`;
    else if (tipo === 'video') corpo = `<video src="/f/${id}" controls playsinline style="width:100%;border-radius:10px"></video>`;
    else if (tipo === 'txt') { let t = ''; try { t = await (await fetch('/f/' + id)).text(); } catch (_) { } corpo = `<pre>${esc(t.slice(0, 200000))}</pre>`; }
    abrirModal(`<div class="modal-cab"><div style="min-width:0"><b>${esc(nome)}</b><small>${tipo === 'pdf' ? 'Documento PDF' : tipo === 'img' ? 'Imagem · clique para ampliar' : 'Arquivo'}</small></div>
      <div class="linha-acoes">${tipo === 'pdf' ? `<button class="btn peq suave" data-acao="pdf-escuro-modal">${escura ? 'Página clara' : 'Página escura'}</button><a class="btn peq suave" href="/f/${id}" target="_blank" rel="noopener">${ic('abrir', 14)}Tela cheia</a>` : ''}
        <a class="btn peq solido" href="/f/${id}?baixar=1" download>${ic('baixar', 14)}Baixar</a>
        <button class="btn-ico peq" data-acao="fechar" aria-label="Fechar">${ic('x', 16)}</button></div></div>
      <div class="modal-corpo">${corpo}</div>`);
  }

  async function editarCurso(id) {
    const lib = await carregarBiblioteca();
    const c = lib.courses.find(x => x.id === id);
    if (!c) return;
    const cats = lib.categories;
    abrirModal(`<form data-form="editar" data-id="${id}">
      <div class="modal-cab"><div><b>Organizar curso</b><small>${esc(c.title)}</small></div><button type="button" class="btn-ico peq" data-acao="fechar" aria-label="Fechar">${ic('x', 16)}</button></div>
      <div class="form-corpo">
        <label>Título<input name="title" value="${esc(c.title)}"></label>
        <div class="form-linha">
          <label>Categoria<input name="category" list="dl-cats" value="${esc(c.category)}" placeholder="Ex.: Motion Design" autocomplete="off"></label>
          <label>Subcategoria<input name="subcategory" list="dl-subs" value="${esc(c.subcategory)}" placeholder="Ex.: After Effects" autocomplete="off"></label>
        </div>
        <datalist id="dl-cats">${cats.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
        <datalist id="dl-subs">${[...new Set(cats.flatMap(x => x.subs))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
        <label>Tags (separadas por vírgula)<input name="tags" list="dl-tags" value="${esc(c.tags.join(', '))}" placeholder="animação, expressões"></label>
        <datalist id="dl-tags">${lib.tags.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <label>Escola<input name="school" list="dl-esc" value="${esc(c.school)}"></label>
        <datalist id="dl-esc">${lib.schools.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
        <label>Descrição<textarea name="description" rows="4">${esc(c.description)}</textarea></label>
        <span class="muted" style="font-size:12px">Categorias novas são criadas ao salvar. Nada disso altera seus arquivos.</span>
      </div>
      <div class="form-pe"><button type="button" class="btn sec" data-acao="fechar">Cancelar</button><button type="submit" class="btn solido">Salvar</button></div></form>`, 'form');
  }
  function adicionarLink(id) {
    abrirModal(`<form data-form="link" data-id="${id}">
      <div class="modal-cab"><div><b>Adicionar link</b></div><button type="button" class="btn-ico peq" data-acao="fechar" aria-label="Fechar">${ic('x', 16)}</button></div>
      <div class="form-corpo"><label>Endereço<input name="url" type="url" required placeholder="https://"></label><label>Título (opcional)<input name="title"></label></div>
      <div class="form-pe"><button type="button" class="btn sec" data-acao="fechar">Cancelar</button><button type="submit" class="btn solido">Adicionar</button></div></form>`, 'form');
  }

  // ---------- eventos ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-acao],[data-hero],[data-top],[data-vel]');
    if (!t) return;
    if (t.dataset.hero) { S.heroIdx = +t.dataset.hero; renderHero(); return; }
    if (t.dataset.top) { S.top = t.dataset.top; document.querySelectorAll('[data-top]').forEach(b => b.setAttribute('aria-selected', b === t)); renderTop(); return; }
    if (t.dataset.vel) {
      const vv = parseFloat(t.dataset.vel); localStorage.setItem('velocidade', vv);
      const v = $('#video'); if (v) v.playbackRate = vv;
      document.querySelectorAll('[data-vel]').forEach(b => b.classList.toggle('on', b === t)); return;
    }
    const a = t.dataset.acao;
    try {
      if (a === 'tema') trocarTema();
      else if (a === 'varrer') { await api('/api/varrer', { method: 'POST' }); aviso('Atualizando a biblioteca…'); setTimeout(() => { invalidar(); rota(); }, 2500); }
      else if (a === 'fechar' || (a === 'fechar-fundo' && e.target === t)) fecharModal();
      else if (a === 'ver') verMaterial(t.dataset.id, t.dataset.tipo, t.dataset.nome);
      else if (a === 'zoom') t.classList.toggle('zoom');
      else if (a === 'editar') { e.preventDefault(); editarCurso(t.dataset.id); }
      else if (a === 'add-link') adicionarLink(t.dataset.id);
      else if (a === 'remover-link') { await api(`/api/curso/${t.dataset.id}/links`, { json: { remove: t.dataset.url } }); invalidar(); rota(); }
      else if (a === 'fav') { const on = t.getAttribute('aria-pressed') !== 'true'; await api(`/api/curso/${t.dataset.id}/meta`, { json: { favorite: on } }); invalidar(); rota(); aviso(on ? 'Adicionado aos favoritos' : 'Removido dos favoritos'); }
      else if (a === 'nota') {
        const id = t.dataset.id; const v = +t.dataset.v;
        const atual = t.parentElement.querySelectorAll('[aria-pressed=true]').length;
        const nova = atual === v ? 0 : v;
        await api(`/api/curso/${id}/meta`, { json: { rating: nova } });
        t.parentElement.querySelectorAll('button').forEach((b, i) => { b.setAttribute('aria-pressed', i < nova); b.innerHTML = estrelaSVG(i < nova); });
        S.lib = null; aviso(nova ? `Avaliado com ${nova} estrela${nova > 1 ? 's' : ''}` : 'Avaliação removida');
      }
      else if (a === 'ir-tempo') { const v = $('#video'); if (v) { v.currentTime = parseFloat(t.dataset.t); v.play(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
      else if (a === 'apagar-nota') {
        if (!confirm('Apagar esta anotação?')) return;
        await api('/api/notas/' + t.dataset.id, { json: { delete: true } });
        if (S.aula && $('#lista-notas')) { S.aula.notas = S.aula.notas.filter(n => n.id !== t.dataset.id); renderNotas(S.aula); } else rota();
      }
      else if (a === 'pdf-escuro' || a === 'pdf-escuro-modal') {
        const on = localStorage.getItem('pdfEscuro') !== '1'; localStorage.setItem('pdfEscuro', on ? '1' : '0');
        document.querySelectorAll('#pdf,#ver-pdf').forEach(f => f.classList.toggle('escura', on));
        t.textContent = on ? 'Página clara' : 'Página escura';
      }
    } catch (err) { aviso(err.message); }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    try {
      if (f.dataset.form === 'busca') location.hash = '#/explorar?q=' + encodeURIComponent(fd.get('q') || '');
      else if (f.dataset.form === 'editar') {
        await api(`/api/curso/${f.dataset.id}/meta`, { json: { title: fd.get('title'), category: fd.get('category'), subcategory: fd.get('subcategory'), tags: fd.get('tags'), school: fd.get('school'), description: fd.get('description') } });
        fecharModal(); invalidar(); rota(); aviso('Curso atualizado');
      }
      else if (f.dataset.form === 'link') {
        await api(`/api/curso/${f.dataset.id}/links`, { json: { url: fd.get('url'), title: fd.get('title') } });
        fecharModal(); invalidar(); rota(); aviso('Link adicionado');
      }
      else if (f.dataset.form === 'nota' && S.aula) {
        const st = S.aula; const texto = String(fd.get('texto') || '').trim();
        if (!texto) return;
        const body = { course: st.c.id, lesson: st.L.key, text: texto };
        if (st.video) body.t = Math.floor(st.video.currentTime);
        const pg = parseInt(fd.get('pagina'), 10); if (!isNaN(pg)) { body.page = pg; api('/api/progresso', { json: { course: st.c.id, lesson: st.L.key, page: pg } }).catch(() => { }); }
        const n = await api('/api/notas', { json: body });
        st.notas.push(n); st.notas.sort((a, b) => (a.t ?? a.page ?? 0) - (b.t ?? b.page ?? 0));
        f.reset(); renderNotas(st); aviso('Anotação salva');
      }
    } catch (err) { aviso(err.message); }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('form[data-form=filtros],form[data-form=notas]'); if (!f) return;
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(f)) if (v) p.set(k, v);
    if (f.dataset.form === 'filtros' && e.target.name === 'cat') p.delete('sub');
    location.hash = (f.dataset.form === 'notas' ? '#/notas' : '#/explorar') + (p.toString() ? '?' + p : '');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal-raiz').innerHTML) fecharModal();
    if (e.key === 'Enter' && e.target.matches('.filtros input[type=search]')) { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  // ---------- rotas ----------
  async function rota() {
    S.limpeza.splice(0).forEach(fn => { try { fn(); } catch (_) { } });
    clearInterval(S.heroTimer); S.aula = null; fecharModal();
    const r = rotaAtual();
    const caminho = r.split('?')[0].split('/').filter(Boolean);
    const p = qs(r);
    if (!conteudo.innerHTML) conteudo.innerHTML = '<div class="carregando">Carregando…</div>';
    try {
      if (!caminho.length) await telaInicio();
      else if (caminho[0] === 'explorar') await telaExplorar(p);
      else if (caminho[0] === 'escolas') await telaEscolas();
      else if (caminho[0] === 'organizar') await telaOrganizar();
      else if (caminho[0] === 'notas') await telaNotas(p);
      else if (caminho[0] === 'curso') await telaCurso(caminho[1]);
      else if (caminho[0] === 'aula') await telaAula(caminho[1], caminho[2], p);
      else await telaInicio();
    } catch (err) {
      conteudo.innerHTML = `<div class="vazio"><b>Algo deu errado</b><span>${esc(err.message)}</span><a class="btn solido" href="#/">Voltar ao início</a></div>`;
    }
    if (!caminho.length || caminho[0] !== 'aula') window.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rota);
  rota();
})();
