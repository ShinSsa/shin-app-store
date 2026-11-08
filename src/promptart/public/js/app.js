// ── Proteção das imagens ─────────────────────────────────
// As fotos dos cards são só para ver: sem menu de contexto, sem arrastar.
// A exceção é o anexo, que existe justamente para ser baixado — ele é
// marcado com data-baixavel e continua com o menu normal do navegador.
document.addEventListener('contextmenu', e => {
  const midia = e.target.closest && e.target.closest('img,video');
  if (midia && !midia.hasAttribute('data-baixavel')) e.preventDefault();
});
document.addEventListener('dragstart', e => {
  const midia = e.target.closest && e.target.closest('img,video');
  if (midia && !midia.hasAttribute('data-baixavel')) e.preventDefault();
});

// ── Textos da interface ──────────────────────────────────
// window.T vem de lang/{idioma}/app.php (ver resources/views/app.blade.php).
// t('chave', {name:'x'}) troca os :placeholders; tp('chave', n) escolhe singular/plural.
const T = window.T || {};
// ícones reaproveitados nos cards
const ICO_COPY = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 13V4.5A2 2 0 0 1 5 2.5h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const ICO_STAR_ON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="var(--star)" stroke="var(--star)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const ICO_STAR_OFF = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const LOCALE = (window.PROMPTART && PROMPTART.locale) || 'pt-BR';
function t(key, vars){
  let s = T[key] != null ? T[key] : key;
  if(vars) for(const k in vars) s = s.split(':'+k).join(vars[k]);
  return s;
}
function tp(key, n, vars){
  const partes = (T[key] || '').split('|');
  let s = partes[n === 1 ? 0 : (partes.length > 1 ? 1 : 0)] || '';
  s = s.split(':count').join(n);
  if(vars) for(const k in vars) s = s.split(':'+k).join(vars[k]);
  return s;
}

// ── DADOS (API REST — espelho local em `db`) ─────────────
// O objeto `db.projects` mantém o mesmo shape do app offline
// (projects/cards); toda escrita passa pela API e atualiza o espelho.
let db = {projects:[]};

async function loadDB(){
  const categories = await apiGet('/categories');
  return { projects: (categories.data || categories).map(mapCategory) };
}
// Persistência agora é feita por chamada explícita à API em cada ação.
function saveDB(){}

// ── STATE ────────────────────────────────────────────────
let currentProjId=null, editingProjId=null, editingCardId=null;
let allCards=[], viewingText='', viewingCardId=null;
let bonusMode=false;
let bonusProjects=[];
function getProj(id){return (bonusMode?bonusProjects:db.projects).find(x=>x.id===id);}

// ── THEME ────────────────────────────────────────────────
function loadTheme(){
  const t=localStorage.getItem('theme')||'light';
  document.documentElement.setAttribute('data-theme',t);
  updateThemeIcon(t);
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'light';
  const next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('theme',next);
  updateThemeIcon(next);
}
function updateThemeIcon(t){
  const el=document.getElementById('themeIcon');
  if(t==='dark'){
    // sol branco — clique vai pro modo claro
    el.innerHTML='<circle cx="12" cy="12" r="5" stroke="white" stroke-width="1.8" fill="none"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="white" stroke-width="1.8" stroke-linecap="round"/>';
  } else {
    // lua cinza — clique vai pro modo escuro
    el.innerHTML='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#8c8c8c" stroke="#8c8c8c" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>';
  }
}

// ── NAV ──────────────────────────────────────────────────
function goHome(){
  bonusMode=false;
  var cp=document.getElementById('communityPage');if(cp)cp.classList.remove('active');
  document.getElementById('homePage').classList.add('active');
  var gp=document.getElementById('generatorPage');if(gp)gp.classList.remove('active');
  var fp=document.getElementById('favoritesPage');if(fp)fp.classList.remove('active');
  document.getElementById('headerSearchWrap').style.display='';
  clearGlobalSearch();
  renderProjects();
  setPage('home');
  registrarNoHistorico('home');
  // a Home nunca fica vazia: reabre a última categoria usada
  abrirCategoriaInicial();
}

/* Última categoria aberta, ou a primeira da lista. Guardada por usuário no
   próprio navegador — some se ele trocar de máquina, e aí cai na primeira. */
function chaveUltimaCategoria(){ return 'ultimaCategoria:'+(PROMPTART.user.id||'0'); }

function abrirCategoriaInicial(){
  if(bonusMode) return;
  const lista = db.projects||[];
  if(!lista.length){ mostrarPainelVazio(true); return; }
  const guardada = localStorage.getItem(chaveUltimaCategoria());
  const alvo = lista.find(p=>String(p.id)===String(guardada)) || lista[0];
  openProject(alvo.id);
}

function mostrarPainelVazio(vazio){
  const v=document.getElementById('catPanelEmpty');
  const c=document.getElementById('catPanelContent');
  if(v) v.style.display = vazio ? '' : 'none';
  if(c) c.style.display = vazio ? 'none' : '';
}
function openProject(id){
  const p=getProj(id);
  if(!p){ mostrarPainelVazio(true); return; }
  currentProjId=id;
  activeSubcat=null;
  if(!bonusMode) localStorage.setItem(chaveUltimaCategoria(), String(id));
  // o título grande não muda ao abrir categoria: o nome dela fica no painel
  setTimeout(()=>setPage(bonusMode?'bonus':'home'),0);
  mostrarPainelVazio(false);
  document.getElementById('projActionsBar').style.display=bonusMode?'none':'flex';
  document.getElementById('projPageTitle').textContent=p.name;
  document.getElementById('projPageDesc').textContent='';   // a aba fica só com o nome
  document.getElementById('cardSearch').value='';
  loadCards(id, renderCards);
  renderSubcatBar();
  renderSubcatDrop();
  renderProjects();   // remarca qual card está aberto na coluna
  centralizarNaCategoria(id);
  registrarNoHistorico(bonusMode ? 'bonus' : 'categoria', id);
}

function loadCards(pid,cb){
  const p=getProj(pid);
  allCards=p?[...(p.cards||[])]:[];
  if(cb)cb(allCards);
}

// ── BIBLIOTECA BÔNUS (premium, read-only) ────────────────
async function openBonusLibrary(){
  if(!PROMPTART.user.has_bonus_library){
    showUpsell(t('upsell_bonus'));
    return;
  }
  try{
    const cats=await apiGet('/bonus/categories');
    bonusProjects=cats.map(c=>({
      id:String(c.id),name:c.name,desc:c.description||'',thumb:c.thumb_url||'',emoji:'🎁',
      subcats:[],subcatIds:{},cards:null,promptsCount:c.prompts_count,
      atualizadaEm:c.atualizada_em||''
    }));
    bonusMode=true;
    showBonusHome();
    setPage('bonus');
    // abre a primeira categoria: a tela vazia dava a impressão de biblioteca
    // sem nada cadastrado
    if(bonusProjects.length) openBonusProject(bonusProjects[0].id);
  }catch(err){showToast(err.message,true);}
}

function showBonusHome(){
  hideAllPages();   // faltava aqui também: a Comunidade ficava embaixo
  document.getElementById('homePage').classList.add('active');
  document.getElementById('headerSearchWrap').style.display='none';
  document.getElementById('headerNewBtn')?.style.setProperty('display','none');
  clearGlobalSearch();
  currentProjId=null;
  renderProjects();
}

async function openBonusProject(id){
  const p=bonusProjects.find(x=>x.id===id);
  if(!p)return;
  if(p.cards===null){
    try{
      const prompts=await apiGet('/bonus/categories/'+id+'/prompts');
      p.cards=prompts.map(mapBonusPrompt);
    }catch(err){showToast(err.message,true);return;}
  }
  openProject(id);
}

function showUpsell(text){
  document.getElementById('upsellText').textContent=text;
  document.getElementById('upsellModal').classList.add('open');
}

// ── RENDER PROJECTS ──────────────────────────────────────
function renderProjects(){
  const grid=document.getElementById('projectsGrid');
  const titleEl=null; // o título da coluna saiu com a reforma da Home
  const backBtn=document.getElementById('bonusBackBtn');
  if(backBtn)backBtn.style.display=bonusMode?'':'none';
  if(bonusMode){
    if(titleEl)titleEl.textContent='🎁 '+t('bonus_library');
    document.getElementById('projCount').textContent=bonusProjects.length;
    grid.innerHTML='';
    const sb=getSortProj();
    const bb=document.getElementById('sortProjBtn');
    if(bb){bb.classList.toggle('active',sb==='alpha');bb.title=sb==='alpha'?t('sort_alpha'):t('sort_updated');}
    sortItems(bonusProjects,sb,'name').forEach(p=>{
      grid.appendChild(cardCategoria(p, {editavel:false, aoAbrir:()=>openBonusProject(p.id)}));
    });
    aplicarModoBonus();
    aplicarModoCategorias();
    posicionarRoda();
    ligarControlesDaRoda();
    return;
  }
  if(titleEl)titleEl.textContent=t('categories');
  document.getElementById('projCount').textContent=db.projects.length;
  grid.innerHTML='';
  // estado visual dos botões de ordenação
  const sp=getSortProj();
  const pb=document.getElementById('sortProjBtn');
  if(pb){pb.classList.toggle('active',sp==='alpha');pb.title=sp==='alpha'?t('sort_alpha'):t('sort_created');}
  sortItems(db.projects,sp,'name').forEach(p=>{
    grid.appendChild(cardCategoria(p, {editavel:true, aoAbrir:()=>openProject(p.id)}));
  });
  aplicarModoBonus();
  aplicarModoCategorias();
  posicionarRoda();
  ligarControlesDaRoda();
}

// ── RENDER CARDS ─────────────────────────────────────────
function openFavorites(){
  setTimeout(()=>setPage('favorites'),0);
  registrarNoHistorico('favorites');
  hideAllPages();   // sem isto a Comunidade continuava aberta embaixo
  document.getElementById('favoritesPage').classList.add('active');
  document.getElementById('headerSearchWrap').style.display='none';
  document.getElementById('headerNewBtn')?.style.setProperty('display','none');
  document.getElementById('favSearch').value='';
  renderFavoritesPage();
}

function renderFavoritesPage(){
  const grid=document.getElementById('favoritesGrid');
  const q=(document.getElementById('favSearch').value||'').toLowerCase();
  let favs=[];
  db.projects.forEach(p=>{
    (p.cards||[]).forEach(card=>{ if(card.favorite) favs.push({project:p,card}); });
  });
  if(q){
    favs=favs.filter(({card})=>
      (card.title||'').toLowerCase().includes(q)||
      (card.text||'').replace(/<[^>]+>/g,'').toLowerCase().includes(q)||
      (card.tag||'').toLowerCase().includes(q)||
      (card.desc||'').toLowerCase().includes(q)
    );
  }
  document.getElementById('favPageDesc').textContent=tp('fav_count',favs.length);
  grid.innerHTML='';
  if(!favs.length){
    const e=document.createElement('div');
    e.className='empty-state';
    e.innerHTML='<p>'+t('empty_favorites')+'</p>';
    grid.appendChild(e);
    return;
  }
  favs.forEach(({project,card})=>{
    const src=resolveThumb(card.thumb);
    const rawText=(card.text||'').replace(/<[^>]+>/g,'');
    const htmlPreview=sanitizeColors(card.text||'').replace(/<br\s*\/?>/gi,' ').replace(/<\/(div|p)>/gi,' ').replace(/<(div|p)[^>]*>/gi,'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
    const preview=rawText.length>200?rawText.slice(0,200)+'…':rawText;
    const d=document.createElement('div');
    d.className='prompt-card';
    const midia=src
      ?`<div class="pc-thumb" style="cursor:zoom-in;" onclick="zoomImage('${src.replace(/'/g,"\\'")}',${isVid(card.thumb)})">${isVid(card.thumb)?`<video src="${src}" autoplay loop muted playsinline></video>`:thumbImgTag(card.thumb)}</div>`
      :`<div class="pc-thumb">⭐</div>`;
    d.innerHTML=`
      <div class="pc-media">${midia}<div class="pc-scrim"></div></div>
      ${card.tag?`<span class="pc-tag">${card.tag}</span>`:''}
      <div class="pc-top-actions">
        <button class="pc-round pc-star active" onclick="unfavFromHome('${project.id}','${card.id}')" title="${t('fav_removed')}">
          ${ICO_STAR_ON}
        </button>
      </div>
      <div class="pc-over">
        <div class="pc-title">${card.title||''}</div>
        <div class="pc-preview">${htmlPreview||preview}</div>
      </div>
      <div class="pc-panel">
        <div style="font-size:.64rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;" onclick="goToProject('${project.id}')">${project.emoji||'📁'} ${project.name}</div>
        <div class="pc-title">${card.title||''}</div>
        ${card.desc?`<div class="pc-desc">${card.desc}</div>`:''}
        <div class="pc-preview">${htmlPreview||preview}</div>
        <div class="pc-footer"><span class="pc-chars">${rawText.length} chars</span></div>
        <button class="pc-copy" id="favcopy_${card.id}" onclick="copyFav('${project.id}','${card.id}')">
          ${ICO_COPY} ${t('copy_btn')}
        </button>
      </div>`;
    grid.appendChild(d);
  });
}

function goToProject(projId){
  const p=db.projects.find(x=>x.id===projId);
  if(p){document.getElementById('favoritesPage').classList.remove('active');openProject(projId);}
}

async function unfavFromHome(projId,cardId){
  const p=db.projects.find(x=>x.id===projId);
  const cc=p?(p.cards||[]).find(x=>x.id===cardId):null;
  if(!cc)return;
  cc.favorite=false;renderFavoritesPage();
  showToast(t('fav_removed'));
  try{await apiPost('/prompts/'+cardId+'/favorite');}
  catch(err){cc.favorite=true;renderFavoritesPage();showToast(err.message,true);}
}
function copyFav(projId,cardId){
  const p=db.projects.find(x=>x.id===projId);
  const c=p?(p.cards||[]).find(x=>x.id===cardId):null;
  if(!c)return;
  const plain=(c.text||'').replace(/<b>(.*?)<\/b>/gi,'$1').replace(/<span[^>]*>(.*?)<\/span>/gi,'$1').replace(/<[^>]+>/g,'');
  navigator.clipboard.writeText(plain).then(()=>{
    const btn=document.getElementById('favcopy_'+cardId);
    if(btn){const o=btn.innerHTML;btn.classList.add('copied');btn.textContent='✓ Copiado';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML=o;},2000);}
    showToast(t('copied'));
  }).catch(()=>fallbackCopy(plain));
}

function renderCards(cards){
  const grid=document.getElementById('cardsGrid');
  grid.innerHTML='';
  // estado visual dos botões de ordenação
  const sc=getSortCard();
  const cb=document.getElementById('sortCardBtn');
  if(cb){cb.classList.toggle('active',sc==='alpha');cb.title=sc==='alpha'?t('sort_alpha'):t('sort_created');}
  // aplica ordenação escolhida, mantendo favoritos no topo
  const ordered=sortItems(cards,sc,'title');
  const sorted=ordered.sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0));
  if(!sorted.length){
    const e=document.createElement('div');
    e.className='empty-state';
    e.innerHTML='<p>'+t('empty_cards')+'</p>';
    grid.appendChild(e);
  }
  sorted.forEach(c=>{
    const src=resolveThumb(c.thumb);
    const rawText=(c.text||'').replace(/<[^>]+>/g,'');
    const preview=rawText.length>200?rawText.slice(0,200)+'…':rawText;
    // Versão do HTML do preview com quebras de linha normalizadas (mantém cores/negrito)
    const htmlPreview=sanitizeColors(c.text||'')
      .replace(/<br\s*\/?>/gi,' ')
      .replace(/<\/(div|p)>/gi,' ')
      .replace(/<(div|p)[^>]*>/gi,'')
      .replace(/\n+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    const attSrc=c.attachment?resolveThumb(c.attachment):null;

    const d=document.createElement('div');
    d.className='prompt-card';
    d.onclick=function(e){
      // não abre preview se clicou em botão de ação
      if(e.target.closest('button'))return;
      viewCard(c.id);
    };
    const thumbPos=c.thumbPos?`${c.thumbPos.x} ${c.thumbPos.y}`:'center center';
    const thumbPos2=c.thumbPos2?`${c.thumbPos2.x} ${c.thumbPos2.y}`:'center center';
    const src2=resolveThumb(c.thumb2);
    const hasTwoThumbs=src&&src2;
    const thumbHtml=src
      ?`<div class="pc-thumb" id="pcthumb_${c.id}">
          ${isVid(c.thumb)?`<video src="${src}" autoplay loop muted playsinline style="object-position:${thumbPos};"></video>`:thumbImgTag(c.thumb,`style="object-position:${thumbPos};"`)}
        </div>`
      :`<div class="pc-thumb">${c.emoji||'✨'}</div>`;
    const navHtml=hasTwoThumbs?`
      <div class="pc-nav">
        <button class="pc-nav-btn" onclick="pcPrevThumb('${c.id}',event)" title="Foto anterior">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="pc-nav-btn" onclick="pcNextThumb('${c.id}',event)" title="Próxima foto">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="pc-dots">
        <div class="pc-dot active" id="pcdot_${c.id}_0"></div>
        <div class="pc-dot" id="pcdot_${c.id}_1"></div>
      </div>`:'';

    d.innerHTML=`
      <div class="pc-media">
        ${thumbHtml}
        ${navHtml}
        <div class="pc-scrim"></div>
      </div>
      ${c.tag?`<span class="pc-tag">${c.tag}</span>`:''}
      <div class="pc-top-actions">
        <button class="pc-round pc-star${c.favorite?' active':''}" onclick="toggleFav('${c.id}')" title="${t('fav_added')}">
          ${c.favorite?ICO_STAR_ON:ICO_STAR_OFF}
        </button>
      </div>
      <div class="pc-over">
        <div class="pc-title">${c.title||''}</div>
        <div class="pc-preview">${htmlPreview||preview}</div>
      </div>
      <div class="pc-panel">
        <div class="pc-title">${c.title||''}</div>
        ${c.desc?`<div class="pc-desc">${c.desc.replace(/<[^>]+>/g,'')}</div>`:''}
        <div class="pc-preview">${htmlPreview||preview}</div>
        <div class="pc-footer">
          <span class="pc-chars">${rawText.length} chars</span>
          <div class="pc-actions">
            ${bonusMode?'':`<button class="ibtn ibtn-sm danger" onclick="deleteCard('${c.id}',event)" title="${t('remove')}">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M8 6V4h4v2M5 6l1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="ibtn ibtn-sm" onclick="editCard('${c.id}',event)" title="${t('card_edit')}">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M14.5 2.5a2.12 2.12 0 0 1 3 3L6 17l-4 1 1-4L14.5 2.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="ibtn ibtn-sm" onclick="openMoveCard('${c.id}')" title="${t('move_card')}">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M12 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="ibtn ibtn-sm" onclick="sharePromptToCommunity('${c.id}',event)" title="${t('community')}">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="6" r="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="14" cy="7" r="1.8" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 16c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>`}
          </div>
        </div>
        <button class="pc-copy" id="copy_${c.id}" onclick="copyCard('${c.id}')">
          ${ICO_COPY} ${t('copy_btn')}
        </button>
      </div>`;
    grid.appendChild(d);
  });
  if(!bonusMode){
    const n=document.createElement('div');
    n.className='new-card-btn';
    n.onclick=openNewCard;
    n.innerHTML=`<div class="plus">+</div><span>Novo Card</span>`;
    grid.appendChild(n);
  }
}

// ── SUBCATEGORIAS ────────────────────────────────────────
let activeSubcat=null;

// Pills de filtro no topo da grade de cards
function renderSubcatBar(){
  const bar=document.getElementById('subcatBar');
  const p=getProj(currentProjId);
  const subcats=(p&&p.subcats)||[];
  if(!subcats.length){bar.style.display='none';bar.innerHTML='';return;}
  bar.style.display='flex';
  const allCount=(p.cards||[]).length;
  let html=`<button class="subcat-pill${!activeSubcat?' active':''}" onclick="setSubcat(null)">Todos<span class="pill-count">${allCount}</span></button>`;
  subcats.forEach(sc=>{
    const cnt=(p.cards||[]).filter(c=>(c.subcats||[]).includes(sc)).length;
    const safe=sc.replace(/'/g,"\\'");
    html+=`<button class="subcat-pill${activeSubcat===sc?' active':''}" onclick="setSubcat('${safe}')">${sc}<span class="pill-count">${cnt}</span></button>`;
  });
  bar.innerHTML=html;
}

// Dropdown de subcategoria dentro do modal de card
function renderCardSubcatDropdown(selectedSubcat){
  renderCardSubcatPills(selectedSubcat ? [selectedSubcat] : []);
}

// Pills multi-seleção no modal de card
function renderCardSubcatPills(selectedSubcats){
  const p=getProj(currentProjId);
  const subcats=(p&&p.subcats)||[];
  const grp=document.getElementById('cardSubcatGroup');
  const pills=document.getElementById('cardSubcatPills');
  if(!subcats.length){grp.style.display='none';return;}
  grp.style.display='';
  const sel=new Set(selectedSubcats||[]);
  pills.innerHTML=subcats.map(sc=>{
    const on=sel.has(sc);
    const safe=sc.replace(/'/g,"\\'");
    return `<button type="button" class="subcat-pill${on?' active':''}" onclick="toggleCardSubcatPill(this,'${safe}')">${sc}</button>`;
  }).join('');
}

function toggleCardSubcatPill(btn, sc){
  btn.classList.toggle('active');
}

function setSubcat(sc){
  activeSubcat=sc;
  renderSubcatDrop();
  renderSubcatBar();
  filterCards();
}

function openManageSubcats(){
  renderSubcatList();
  document.getElementById('subcatModal').classList.add('open');
  setTimeout(()=>document.getElementById('subcatNewName').focus(),100);
}

function renderSubcatList(){
  const p=getProj(currentProjId);
  const subcats=(p&&p.subcats)||[];
  const list=document.getElementById('subcatList');
  if(!subcats.length){list.innerHTML='<p style="font-size:.78rem;color:var(--muted);text-align:center;padding:.5rem 0;">'+t('empty_subcats')+'</p>';return;}
  list.innerHTML=subcats.map((sc,i)=>`
    <div id="subcatRow_${i}" style="display:flex;align-items:center;gap:.4rem;padding:.45rem .6rem;background:var(--surface);border:1px solid var(--border);border-radius:9px;">
      <span id="subcatLabel_${i}" style="flex:1;font-size:.85rem;font-weight:700;">${sc}</span>
      <input id="subcatInput_${i}" type="text" value="${sc.replace(/"/g,'&quot;')}" style="display:none;flex:1;background:var(--bg);border:1px solid var(--accent);border-radius:6px;color:var(--text);font-size:.82rem;font-weight:700;padding:.25rem .5rem;outline:none;"
        onkeydown="if(event.key==='Enter')confirmRename(${i});else if(event.key==='Escape')cancelRename(${i});">
      <button class="ibtn ibtn-sm" onclick="startRename(${i})" id="subcatEditBtn_${i}" title="Renomear">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M14.5 2.5a2.12 2.12 0 0 1 3 3L6 17l-4 1 1-4L14.5 2.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="ibtn ibtn-sm" onclick="confirmRename(${i})" id="subcatSaveBtn_${i}" title="Salvar" style="display:none;color:var(--accent);">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="ibtn ibtn-sm danger" onclick="deleteSubcat(${i})" id="subcatDelBtn_${i}" title="Excluir">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M8 6V4h4v2M5 6l1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`).join('');
}

function startRename(i){
  const lbl=document.getElementById(`subcatLabel_${i}`);
  const inp=document.getElementById(`subcatInput_${i}`);
  const editBtn=document.getElementById(`subcatEditBtn_${i}`);
  const saveBtn=document.getElementById(`subcatSaveBtn_${i}`);
  lbl.style.display='none';
  inp.style.display='';
  editBtn.style.display='none';
  saveBtn.style.display='';
  inp.focus();
  inp.select();
}

function cancelRename(i){
  const p=getProj(currentProjId);
  const sc=(p&&p.subcats&&p.subcats[i])||'';
  const lbl=document.getElementById(`subcatLabel_${i}`);
  const inp=document.getElementById(`subcatInput_${i}`);
  const editBtn=document.getElementById(`subcatEditBtn_${i}`);
  const saveBtn=document.getElementById(`subcatSaveBtn_${i}`);
  inp.value=sc;
  lbl.style.display='';
  inp.style.display='none';
  editBtn.style.display='';
  saveBtn.style.display='none';
}

async function confirmRename(i){
  const p=getProj(currentProjId);
  if(!p||!p.subcats)return;
  const inp=document.getElementById(`subcatInput_${i}`);
  const newName=(inp?.value||'').trim();
  const oldName=p.subcats[i];
  if(!newName){showToast(t('name_empty'),true);inp?.focus();return;}
  if(newName===oldName){cancelRename(i);return;}
  if(p.subcats.includes(newName)){showToast(t('subcat_exists'),true);inp?.focus();return;}
  const subId=p.subcatIds&&p.subcatIds[oldName];
  if(!subId){showToast(t('subcat_missing'),true);return;}
  try{
    await apiPut('/subcategories/'+subId,{name:newName});
  }catch(err){showToast(err.message,true);inp?.focus();return;}
  // atualiza o nome em todos os cards (pivot já resolve no servidor)
  (p.cards||[]).forEach(c=>{
    if(c.subcats){const idx=c.subcats.indexOf(oldName);if(idx!==-1)c.subcats[idx]=newName;}
  });
  if(activeSubcat===oldName)activeSubcat=newName;
  p.subcats[i]=newName;
  delete p.subcatIds[oldName];
  p.subcatIds[newName]=subId;
  renderSubcatList();
  renderSubcatBar();
  filterCards();
  showToast(t('subcat_renamed'));
}

async function addSubcat(){
  const inp=document.getElementById('subcatNewName');
  const name=inp.value.trim();
  if(!name)return;
  const p=getProj(currentProjId);
  if(!p)return;
  if(!p.subcats)p.subcats=[];
  if(p.subcats.includes(name)){showToast(t('subcat_exists_short'),true);return;}
  try{
    const res=await apiPost('/categories/'+currentProjId+'/subcategories',{name});
    p.subcats.push(res.name);
    if(!p.subcatIds)p.subcatIds={};
    p.subcatIds[res.name]=res.id;
  }catch(err){showToast(err.message,true);return;}
  inp.value='';
  renderSubcatList();
  renderSubcatBar();
  // atualiza as pills do modal de card se ele estiver aberto
  const cardModal=document.getElementById('cardModal');
  if(cardModal&&cardModal.classList.contains('open')){
    const currentSel=[...document.querySelectorAll('#cardSubcatPills .subcat-pill.active')].map(b=>b.textContent);
    renderCardSubcatPills(currentSel);
  }
}

async function deleteSubcat(idx){
  const p=getProj(currentProjId);
  if(!p||!p.subcats)return;
  const name=p.subcats[idx];
  const subId=p.subcatIds&&p.subcatIds[name];
  if(!subId){showToast(t('subcat_missing'),true);return;}
  try{
    await apiDelete('/subcategories/'+subId);
  }catch(err){showToast(err.message,true);return;}
  p.subcats.splice(idx,1);
  delete p.subcatIds[name];
  (p.cards||[]).forEach(c=>{if(c.subcats)c.subcats=c.subcats.filter(s=>s!==name);});
  if(activeSubcat===name)activeSubcat=null;
  renderSubcatList();
  renderSubcatBar();
  filterCards();
}

function renderCardSubcatPicker(selected){}
function toggleCardSubcat(btn,sc){btn.classList.toggle('active');}
function getSelectedSubcats(){return [];}

function filterCards(){
  const q=(document.getElementById('cardSearch').value||'').toLowerCase();
  let filtered=q?allCards.filter(c=>
    (c.title||'').toLowerCase().includes(q)||
    (c.text||'').replace(/<[^>]+>/g,'').toLowerCase().includes(q)||
    (c.tag||'').toLowerCase().includes(q)||
    (c.desc||'').toLowerCase().includes(q)
  ):[...allCards];
  if(activeSubcat){
    filtered=filtered.filter(c=>Array.isArray(c.subcats)&&c.subcats.includes(activeSubcat));
  }
  renderCards(filtered);
}

// ── FAVORITES ────────────────────────────────────────────
async function toggleFav(id){
  const p=getProj(currentProjId);
  const c=p?(p.cards||[]).find(x=>x.id===id):null;
  if(!c)return;
  // na bibliotéca bônus o prompt é o mesmo para todo mundo, então o favorito
  // vive numa tabela à parte — a rota é outra
  const rota = bonusMode
    ? '/bonus/prompts/'+String(id).replace(/^bonus_/,'')+'/favorite'
    : '/prompts/'+id+'/favorite';
  c.favorite=!c.favorite;
  allCards=[...(p.cards||[])];
  renderCards(allCards);
  try{await apiPost(rota);}
  catch(err){c.favorite=!c.favorite;renderCards([...(p.cards||[])]);showToast(err.message,true);}
}

// ── PROJECT CRUD ─────────────────────────────────────────
function openNewProject(){
  editingProjId=null;
  document.getElementById('projModalTitle').textContent=t('cat_new');
  document.getElementById('projName').value='';
  document.getElementById('projDesc').value='';
  onColorPicked('#007AFF');
  document.getElementById('projDeleteBtn').style.display='none';
  fecharPaleta();
  document.getElementById('projModal').classList.add('open');
  setTimeout(()=>document.getElementById('projName').focus(),100);
}
function editProject(id,e){
  e&&e.stopPropagation();
  const p=db.projects.find(x=>x.id===id);
  if(!p)return;
  editingProjId=id;
  document.getElementById('projModalTitle').textContent=t('cat_edit');
  document.getElementById('projName').value=p.name||'';
  document.getElementById('projDesc').value=p.desc||'';
  onColorPicked((p.color||'#D2DAE0').toUpperCase());
  document.getElementById('projDeleteBtn').style.display='';
  fecharPaleta();
  document.getElementById('projModal').classList.add('open');
}
function editCurrentProject(){editProject(currentProjId);}
async function saveProjeto(){
  const name=document.getElementById('projName').value.trim();
  if(!name){document.getElementById('projName').focus();return;}
  const desc=document.getElementById('projDesc').value.trim();
  const payload={name,description:desc||null,color:corAtualDoModal()};
  try{
    if(editingProjId){
      const res=await apiPut('/categories/'+editingProjId,payload);
      const updated=mapCategory(res.data||res);
      const p=db.projects.find(x=>x.id===editingProjId);
      if(p){p.name=updated.name;p.desc=updated.desc;
            p.color=updated.color;p.colorBack=updated.colorBack;p.colorText=updated.colorText;}
      if(currentProjId===editingProjId){
        document.getElementById('projPageTitle').textContent=updated.name;
        document.getElementById('projPageDesc').textContent='';
      }
    } else {
      const res=await apiPost('/categories',payload);
      db.projects.push(mapCategory(res.data||res));
    }
    closeModal('projModal');renderProjects();showToast(t('cat_saved'));
  }catch(err){showToast(err.message,true);}
}
async function deleteProject(id,e){
  e&&e.stopPropagation();
  const p=db.projects.find(x=>x.id===id);
  if(!p||!confirm(t('confirm_delete_cat',{name:p.name})))return;
  try{
    await apiDelete('/categories/'+id);
    db.projects=db.projects.filter(x=>x.id!==id);
    renderProjects();showToast(t('cat_deleted'));
  }catch(err){showToast(err.message,true);}
}

// ── CARD CRUD ────────────────────────────────────────────
function openNewCard(){
  editingCardId=null;
  document.getElementById('cardModalTitle').textContent=t('card_new');
  document.getElementById('cardTitle').value='';
  document.getElementById('cardTag').value='';
  document.getElementById('cardDesc').innerHTML='';
  document.getElementById('cardText').innerHTML='';
  document.getElementById('cardThumb').value='';
  document.getElementById('cardThumb2').value='';
  document.getElementById('cardThumbPrev').innerHTML='<span>'+t('preview')+'</span>';
  document.getElementById('cardPosbtns').style.display='none';
  cardThumbPos={x:'center',y:'center'};
  cardThumbPos2={x:'center',y:'center'};
  switchThumbTab(1);
  document.getElementById('cardAttachment').value='';
  document.getElementById('cardAttachmentName').value='';
  document.getElementById('cardAttPrev').style.display='none';
  renderCardSubcatPills([]);
  document.getElementById('cardModal').classList.add('open');
  setTimeout(()=>document.getElementById('cardTitle').focus(),100);
}
function editCard(id,e){
  e&&e.stopPropagation();
  const p=getProj(currentProjId);
  const c=p?(p.cards||[]).find(x=>x.id===id):null;
  if(!c)return;
  editingCardId=id;
  document.getElementById('cardModalTitle').textContent=t('card_edit');
  document.getElementById('cardTitle').value=c.title||'';
  document.getElementById('cardTag').value=c.tag||'';
  document.getElementById('cardDesc').innerHTML=c.desc||'';
  document.getElementById('cardText').innerHTML=c.text||'';
  document.getElementById('cardThumb').value=c.thumb||'';
  document.getElementById('cardThumb2').value=c.thumb2||'';
  cardThumbPos=c.thumbPos||{x:'center',y:'center'};
  cardThumbPos2=c.thumbPos2||{x:'center',y:'center'};
  switchThumbTab(1);
  previewThumb('cardThumb','cardThumbPrev');
  applyThumbPos();
  document.getElementById('cardPosbtns').style.display=c.thumb?'grid':'none';
  document.getElementById('cardAttachment').value=c.attachment||'';
  document.getElementById('cardAttachmentName').value=c.attachmentName||'';
  updateAttPrev(c.attachment||'',c.attachmentName||'');
  renderCardSubcatPills(c.subcats||[]);
  document.getElementById('cardModal').classList.add('open');
}
async function saveCard(){
  const title=document.getElementById('cardTitle').value.trim();
  const ed=document.getElementById('cardText');
  const text=ed?sanitizeColors(ed.innerHTML.trim()):'';
  const plain=text.replace(/<br\s*\/?>/gi,'').replace(/<[^>]+>/g,'').trim();
  if(!title||!plain){if(!title)document.getElementById('cardTitle').focus();else ed&&ed.focus();return;}
  const tag=document.getElementById('cardTag').value.trim();
  const desc=sanitizeColors(document.getElementById('cardDesc').innerHTML.trim());
  const thumb=document.getElementById('cardThumb').value.trim();
  const thumb2=document.getElementById('cardThumb2').value.trim();
  const thumbPos=cardThumbPos||{x:'center',y:'center'};
  const thumbPos2=cardThumbPos2||{x:'center',y:'center'};
  const attachment=document.getElementById('cardAttachment').value.trim();
  const attachmentName=document.getElementById('cardAttachmentName').value.trim();
  // subcategorias — lê pills marcados (multi-seleção)
  const subcats=[...document.querySelectorAll('#cardSubcatPills .subcat-pill.active')].map(b=>b.textContent);
  const p=getProj(currentProjId);
  if(!p)return;
  const card={title,text,tag,desc,thumb,thumb2,thumbPos,thumbPos2,attachment,attachmentName,subcats};
  try{
    if(editingCardId){
      const existing=(p.cards||[]).find(x=>x.id===editingCardId);
      card.favorite=existing?existing.favorite:false;
      const res=await apiPut('/prompts/'+editingCardId,promptPayload(card));
      const updated=mapPrompt(res.data||res);
      const idx=(p.cards||[]).findIndex(x=>x.id===editingCardId);
      if(idx!==-1)p.cards[idx]=updated;
    } else {
      card.favorite=false;
      const res=await apiPost('/categories/'+currentProjId+'/prompts',promptPayload(card));
      if(!p.cards)p.cards=[];
      p.cards.push(mapPrompt(res.data||res));
    }
    closeModal('cardModal');
    allCards=[...(p.cards||[])];
    renderCards(allCards);
    renderSubcatBar();
    showToast(t('card_saved'));
  }catch(err){showToast(err.message,true);}
}
async function deleteCard(id,e){
  e&&e.stopPropagation();
  if(!confirm(t('confirm_delete_card')))return;
  const p=getProj(currentProjId);
  if(!p)return;
  try{
    await apiDelete('/prompts/'+id);
    p.cards=(p.cards||[]).filter(x=>x.id!==id);
    allCards=[...(p.cards||[])];renderCards(allCards);renderSubcatBar();showToast(t('card_deleted'));
  }catch(err){showToast(err.message,true);}
}

// ── COPY ─────────────────────────────────────────────────
function copyCard(id){
  const c=allCards.find(x=>x.id===id);
  if(!c)return;
  const plain=(c.text||'').replace(/<b>(.*?)<\/b>/gi,'$1').replace(/<span[^>]*>(.*?)<\/span>/gi,'$1').replace(/<[^>]+>/g,'');
  navigator.clipboard.writeText(plain).then(()=>{
    const btn=document.getElementById('copy_'+id);
    if(btn){btn.classList.add('copied');btn.textContent='✓ Copiado';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML='<svg width="11" height="11" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 13V4a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> Copiar';},2000);}
    showToast(t('copied'));
  }).catch(()=>fallbackCopy(plain));
}
function viewCard(id){
  const c=allCards.find(x=>x.id===id);
  if(!c)return;
  viewingCardId=id;
  viewingText=(c.text||'').replace(/<b>(.*?)<\/b>/gi,'$1').replace(/<span[^>]*>(.*?)<\/span>/gi,'$1').replace(/<mark[^>]*>(.*?)<\/mark>/gi,'$1').replace(/<[^>]+>/g,'');
  // tag
  const tagEl=document.getElementById('viewTag');
  tagEl.textContent=c.tag||''; tagEl.style.display=c.tag?'':'none';
  // título
  document.getElementById('viewTitle').textContent=c.title||'';
  // descrição/dica
  const descEl=document.getElementById('viewDesc');
  if(c.desc&&c.desc.replace(/<[^>]+>/g,'').trim()){
    descEl.innerHTML=sanitizeColors(c.desc);
    descEl.style.display='';
  } else {
    descEl.style.display='none';
  }
  // prompt
  document.getElementById('viewText').innerHTML=sanitizeColors(c.text||'');
  // imagem (thumb)
  const imgCol=document.getElementById('viewImgCol');
  const imgWrap=document.getElementById('viewImgWrap');
  let viewThumbIdx=0;
  function renderViewThumb(idx){
    // guarda o valor cru (path/URL) para exibir a miniatura e ampliar o original
    const thumbs=[[c.thumb,c.thumbPos],[c.thumb2,c.thumbPos2]].filter(t=>t[0]);
    if(!thumbs.length){imgCol.classList.add('hidden');imgWrap.innerHTML='';return;}
    imgCol.classList.remove('hidden');
    const [val,pos]=thumbs[idx]||thumbs[0];
    const posStr=pos?`${pos.x} ${pos.y}`:'center center';
    const full=resolveThumb(val);
    imgWrap.innerHTML=isVid(val)
      ?`<video src="${full}" autoplay loop muted playsinline style="object-position:${posStr};"></video>`
      :thumbImgTag(val,`style="object-position:${posStr};cursor:zoom-in;" onclick="openImgLightbox('${full.replace(/'/g,"\\'")}')" title="Clique para ampliar"`);
    // setas no preview (se houver 2 fotos)
    const existing=document.getElementById('viewNavBtns');
    if(existing)existing.remove();
    if(thumbs.length>1){
      const nav=document.createElement('div');
      nav.id='viewNavBtns';
      // mesmas rodinhas do card, centralizadas na vertical
      nav.className='pc-nav view-nav';
      nav.innerHTML=`
        <button class="pc-nav-btn" onclick="viewPrevThumb()" title="${t('photo1')}">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="pc-nav-btn" onclick="viewNextThumb()" title="${t('photo2')}">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>`;
      imgCol.appendChild(nav);
    }
  }
  window.viewNextThumb=function(){viewThumbIdx=(viewThumbIdx+1)%2;renderViewThumb(viewThumbIdx);};
  window.viewPrevThumb=function(){viewThumbIdx=(viewThumbIdx-1+2)%2;renderViewThumb(viewThumbIdx);};
  renderViewThumb(0);
  // anexo
  const attsEl=document.getElementById('viewAtts');
  attsEl.innerHTML='';
  if(c.attachment){
    const src=resolveThumb(c.attachment);
    const d=document.createElement('div');
    d.className='view-att';
    d.innerHTML=`${src?thumbImgTag(c.attachment,`onclick="lightbox('${c.id}')" title="Ver imagem" style="width:44px;height:44px;object-fit:cover;border-radius:7px;cursor:zoom-in;flex-shrink:0;"`):''}
      <div style="display:flex;flex-direction:column;gap:.25rem;min-width:0;">
        <div style="font-size:.72rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${c.attachmentName||t('attachment')}</div>
        <button class="hbtn" style="font-size:.7rem;padding:.2rem .55rem;" onclick="downloadAtt('${c.id}')">↓ Baixar anexo</button>
      </div>`;
    attsEl.appendChild(d);
  }
  document.getElementById('viewEditBtn').style.display=bonusMode?'none':'';
  document.getElementById('viewModal').classList.add('open');
}
function editFromView(){
  closeModal('viewModal');
  editCard(viewingCardId,null);
}

// Navegação de fotos no card miniatura
const pcThumbIdx={};
function pcNextThumb(cardId,e){
  e&&e.stopPropagation();
  _pcSwitchThumb(cardId,1);
}
function pcPrevThumb(cardId,e){
  e&&e.stopPropagation();
  _pcSwitchThumb(cardId,-1);
}
function _pcSwitchThumb(cardId,dir){
  const c=allCards.find(x=>x.id===cardId);
  if(!c)return;
  const thumbs=[[c.thumb,c.thumbPos],[c.thumb2,c.thumbPos2]].filter(t=>t[0]);
  if(thumbs.length<2)return;
  const cur=(pcThumbIdx[cardId]||0);
  const next=(cur+dir+thumbs.length)%thumbs.length;
  pcThumbIdx[cardId]=next;
  const [val,pos]=thumbs[next];
  const posStr=pos?`${pos.x} ${pos.y}`:'center center';
  const wrap=document.getElementById(`pcthumb_${cardId}`);
  if(!wrap)return;
  wrap.innerHTML=isVid(val)
    ?`<video src="${resolveThumb(val)}" autoplay loop muted playsinline style="object-position:${posStr};"></video>`
    :thumbImgTag(val,`style="object-position:${posStr};"`);
  // dots
  for(let i=0;i<thumbs.length;i++){
    const dot=document.getElementById(`pcdot_${cardId}_${i}`);
    if(dot)dot.classList.toggle('active',i===next);
  }
}

function openImgLightbox(src){
  const existing=document.getElementById('imgLightbox');
  if(existing)existing.remove();
  const lb=document.createElement('div');
  lb.className='img-lightbox';
  lb.id='imgLightbox';
  lb.innerHTML=`
    <button class="img-lightbox-close" onclick="document.getElementById('imgLightbox').remove()">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <img src="${src}">`;
  lb.onclick=function(e){if(e.target===lb)lb.remove();};
  document.body.appendChild(lb);
  // fechar com Escape
  const esc=e=>{if(e.key==='Escape'){lb.remove();document.removeEventListener('keydown',esc);}};
  document.addEventListener('keydown',esc);
}
function copyFromView(){
  navigator.clipboard.writeText(viewingText).then(()=>{
    const btn=document.getElementById('viewCopyBtn');
    const orig=btn.innerHTML;
    btn.textContent='✓ Copiado!';
    setTimeout(()=>btn.innerHTML=orig,2000);
    showToast(t('copied'));
  }).catch(()=>fallbackCopy(viewingText));
}
function fallbackCopy(t){
  const ta=document.createElement('textarea');
  ta.value=t;document.body.appendChild(ta);ta.select();
  document.execCommand('copy');document.body.removeChild(ta);
  showToast(t('copied'));
}

// ── GLOBAL SEARCH ─────────────────────────────────────────
function onGlobalSearch(){
  const q=document.getElementById('globalSearch').value.trim();
  const rs=document.getElementById('globalResultsSection');
  if(!q){clearGlobalSearch();return;}
  const ql=q.toLowerCase();
  const results=[];
  db.projects.forEach(proj=>{
    (proj.cards||[]).forEach(card=>{
      if((card.title||'').toLowerCase().includes(ql)||
         (card.text||'').replace(/<[^>]+>/g,'').toLowerCase().includes(ql)||
         (card.tag||'').toLowerCase().includes(ql)||
         (card.desc||'').toLowerCase().includes(ql)){
        results.push({proj,card});
      }
    });
  });
  const label=document.getElementById('grLabel');
  label.innerHTML=results.length>0
    ?`<strong>${results.length}</strong> resultado${results.length!==1?'s':''} para "<strong>${q}</strong>"`
    :`Nenhum resultado para "<strong>${q}</strong>"`;
  // ── Resultados agrupados por categoria ──────────────────
  // Cada categoria vira uma faixa com carrossel horizontal, para se saber de
  // onde veio cada card sem precisar abrir.
  const grid=document.getElementById('grGrid');
  grid.innerHTML='';

  const porCategoria=new Map();
  results.forEach(({proj,card})=>{
    if(!porCategoria.has(proj.id)) porCategoria.set(proj.id,{proj,cards:[]});
    porCategoria.get(proj.id).cards.push(card);
  });

  porCategoria.forEach(({proj,cards})=>{
    const faixa=document.createElement('div');
    faixa.className='gr-faixa';
    faixa.innerHTML=`
      <div class="gr-faixa-topo">
        <button class="gr-faixa-nome" onclick="openProject('${proj.id}')">
          <span class="gr-bolinha" style="background:${proj.color||'#d2dae0'}"></span>
          ${esc(proj.name)}
        </button>
        <span class="gr-faixa-qtd">${cards.length} ${cards.length===1?t('result_one'):t('result_many')}</span>
      </div>
      <div class="gr-trilho-wrap">
        <div class="gr-trilho"></div>
        <div class="barra-horizontal"><div class="barra-bolinha"></div></div>
      </div>`;

    const trilho=faixa.querySelector('.gr-trilho');
    cards.forEach(card=>{
      const txt=(card.text||'').replace(/<[^>]+>/g,'');
      const prev=hlText(txt.slice(0,150)+(txt.length>150?'…':''),q);
      const d=document.createElement('div');
      d.className='gr-card';
      d.onclick=e=>{if(!e.target.closest('.copy-btn')) irAteOCard(proj.id, card.id);};
      d.innerHTML=`
        <div class="gr-title">${hlText(card.title||'',q)}</div>
        ${card.tag?`<span style="font-size:.65rem;color:var(--accent);font-weight:700;">${esc(card.tag)}</span>`:''}
        <div class="gr-preview">${prev}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:.4rem;">
          <button class="copy-btn" id="gcopy_${card.id}" onclick="copyGlobal('${proj.id}','${card.id}')">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 13V4a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            ${t('copy_btn')}
          </button>
        </div>`;
      trilho.appendChild(d);
    });

    ligarBarraHorizontal(trilho, faixa.querySelector('.barra-horizontal'));

    grid.appendChild(faixa);
  });

  rs.style.display='block';
  const painel=document.getElementById('catPanel');
  if(painel) painel.style.display='none';
}
function hlText(t,q){
  if(!q)return t;
  const s=q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&');
  return t.replace(new RegExp('('+s+')','gi'),'<mark class="hl">$1</mark>');
}
function clearGlobalSearch(){
  const el=document.getElementById('globalSearch');if(el)el.value='';
  const rs=document.getElementById('globalResultsSection');if(rs)rs.style.display='none';
  const painel=document.getElementById('catPanel');if(painel)painel.style.display='';
  toggleClear('globalSearch','globalSearchClear');   // o X ficava aceso sozinho
}
function copyGlobal(pid,cid){
  const p=db.projects.find(x=>x.id===pid);
  const c=p?(p.cards||[]).find(x=>x.id===cid):null;
  if(!c)return;
  const plain=(c.text||'').replace(/<b>(.*?)<\/b>/gi,'$1').replace(/<span[^>]*>(.*?)<\/span>/gi,'$1').replace(/<[^>]+>/g,'');
  navigator.clipboard.writeText(plain).then(()=>{
    const btn=document.getElementById('gcopy_'+cid);
    if(btn){const o=btn.innerHTML;btn.classList.add('copied');btn.textContent='✓';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML=o;},2000);}
    showToast(t('copied'));
  }).catch(()=>fallbackCopy(plain));
}

// ── EXPORT / IMPORT ──────────────────────────────────────
async function exportData(){
  try{
    const data=await apiGet('/export');
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='promptart-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    showToast(t('backup_exported'));
  }catch(err){showToast(err.message,true);}
}

function triggerImport(){document.getElementById('importInput').value='';document.getElementById('importInput').click();}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    let imported;
    try{imported=JSON.parse(ev.target.result);}
    catch(pe){alert(t('json_invalid')+'\n'+pe.message);return;}
    const projects=Array.isArray(imported)?imported:Array.isArray(imported?.projects)?imported.projects:null;
    if(!projects){alert(t('file_invalid'));return;}
    if(!projects.length){showToast(t('file_empty'));return;}
    // Normaliza campos de versões antigas
    projects.forEach(p=>{
      if(!p.name&&p.nome)p.name=p.nome;
      if(!p.cards)p.cards=[];
      p.cards=p.cards.map(c=>({...c,title:c.title||c.titulo||'',text:c.text||c.texto||''}));
    });
    if(!confirm(t('confirm_import',{count:projects.length})))return;
    showToast(t('importing'));
    try{
      const res=await apiPost('/import',{projects});
      db.projects=(res.categories.data||res.categories).map(mapCategory);
      renderProjects();clearGlobalSearch();
      showToast(t('imported',{count:res.imported}));
    }catch(err){showToast(err.message,true);}
  };
  reader.onerror=()=>alert(t('file_unreadable'));
  reader.readAsText(file);
}

// ── THUMB / MEDIA ─────────────────────────────────────────
function isVid(url){return url&&/\.(mp4|webm|ogg)(\?.*)?$/i.test(url);}
function onThumbInput(inputId, previewId){
  previewThumb(inputId, previewId);
  syncUploadRemoveBtn(inputId);
}

// Valor pode ser URL externa ou path do storage (uploads/{user}/arquivo)
function resolveThumb(v){
  if(!v)return null;
  if(v.startsWith('http')||v.startsWith('blob:')||v.startsWith('/'))return v;
  return STORAGE_URL_BASE+'/'+v;
}
// URL da MINIATURA leve (poucos KB) para os cards. Cai no original quando não há
// thumb (URL externa, vídeo, ou upload antigo). Espelha a convenção do backend:
// uploads/{user}/{nome}.ext -> uploads/{user}/thumbs/{nome}.webp
function resolveThumbSmall(v){
  if(!v)return null;
  if(v.startsWith('http')||v.startsWith('blob:')||v.startsWith('/'))return v;
  if(isVid(v))return resolveThumb(v);
  const i=v.lastIndexOf('/');
  const dir=i===-1?'':v.slice(0,i+1);
  const file=i===-1?v:v.slice(i+1);
  const dot=file.lastIndexOf('.');
  const base=dot===-1?file:file.slice(0,dot);
  return STORAGE_URL_BASE+'/'+dir+'thumbs/'+base+'.webp';
}
// <img> da miniatura com fallback automático para o original se a thumb faltar.
function thumbImgTag(pathValue, imgAttrs=''){
  const small=resolveThumbSmall(pathValue);
  const full=resolveThumb(pathValue);
  const fb=full?` onerror="this.onerror=null;this.src='${full.replace(/'/g,"\\'")}'"`:'';
  return `<img src="${small}" loading="lazy" draggable="false"${fb} ${imgAttrs}>`;
}
function previewThumb(inputId,previewId){
  const url=document.getElementById(inputId).value.trim();
  const prev=document.getElementById(previewId);
  const usesAbsolutePos=(previewId==='cardThumbPrev');
  if(!url){
    prev.innerHTML='<span>Preview</span>';
    if(inputId==='cardThumb')document.getElementById('cardPosbtns').style.display='none';
    return;
  }
  const src=resolveThumb(url)||url;
  const pos=cardThumbPos?`${cardThumbPos.x} ${cardThumbPos.y}`:'center center';
  const styleStr=usesAbsolutePos
    ?`position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${pos};`
    :`width:100%;height:100%;object-fit:cover;object-position:${pos};`;
  if(isVid(src)){
    prev.innerHTML=`<video src="${src}" autoplay loop muted playsinline style="${styleStr}" onerror="this.parentNode.innerHTML='<span>'+t('invalid')+'</span>'"></video>`;
  } else {
    prev.innerHTML=`<img src="${src}" style="${styleStr}" onerror="this.parentNode.innerHTML='<span>'+t('invalid')+'</span>'">`;
  }
  if(inputId==='cardThumb')document.getElementById('cardPosbtns').style.display='grid';
}

let cardThumbPos={x:'center',y:'center'};
let cardThumbPos2={x:'center',y:'center'};
let activeThumbTab=1;
const POS_STEPS={x:['left','center','right'],y:['top','center','bottom']};

function switchThumbTab(n){
  activeThumbTab=n;
  document.getElementById('thumbTab1').classList.toggle('active',n===1);
  document.getElementById('thumbTab2').classList.toggle('active',n===2);
  document.getElementById('thumbPanel1').style.display=n===1?'':'none';
  document.getElementById('thumbPanel2').style.display=n===2?'':'none';
  // mostra preview da foto ativa
  const inputId=n===1?'cardThumb':'cardThumb2';
  previewThumb(inputId,'cardThumbPrev');
  syncUploadRemoveBtn(inputId);
  const pos=n===1?cardThumbPos:cardThumbPos2;
  applyThumbPosObj(pos);
  const val=document.getElementById(inputId).value.trim();
  document.getElementById('cardPosbtns').style.display=val?'grid':'none';
}

function shiftThumbPos(dir){
  const pos=activeThumbTab===1?cardThumbPos:cardThumbPos2;
  if(dir==='center'){pos.x='center';pos.y='center';}
  else if(dir==='left'){const i=POS_STEPS.x.indexOf(pos.x);pos.x=POS_STEPS.x[Math.max(0,i-1)];}
  else if(dir==='right'){const i=POS_STEPS.x.indexOf(pos.x);pos.x=POS_STEPS.x[Math.min(2,i+1)];}
  else if(dir==='up'){const i=POS_STEPS.y.indexOf(pos.y);pos.y=POS_STEPS.y[Math.max(0,i-1)];}
  else if(dir==='down'){const i=POS_STEPS.y.indexOf(pos.y);pos.y=POS_STEPS.y[Math.min(2,i+1)];}
  applyThumbPosObj(pos);
}

function applyThumbPos(){
  applyThumbPosObj(activeThumbTab===1?cardThumbPos:cardThumbPos2);
}

function applyThumbPosObj(pos){
  const prev=document.getElementById('cardThumbPrev');
  if(!prev)return;
  const el=prev.querySelector('img,video');
  if(el)el.style.objectPosition=`${pos.x} ${pos.y}`;
}

// ── UPLOAD ───────────────────────────────────────────────
function uploadProgEl(inputId){return document.getElementById(inputId+'Prog');}

function syncUploadRemoveBtn(inputId){
  const btn=document.getElementById(inputId+'Remove');
  if(!btn)return;
  const val=document.getElementById(inputId).value.trim();
  btn.style.display=val?'':'none';
}

async function onUploadPicked(e,inputId,previewId){
  const file=e.target.files[0];
  e.target.value='';
  if(!file)return;
  const prog=uploadProgEl(inputId);
  const fill=prog?prog.querySelector('.upload-prog-fill'):null;
  if(prog){prog.classList.add('show');if(fill)fill.style.width='0%';}
  try{
    const res=await apiUpload(file,pct=>{if(fill)fill.style.width=pct+'%';});
    document.getElementById(inputId).value=res.path;
    previewThumb(inputId,previewId);
    syncUploadRemoveBtn(inputId);
    updateStorageInfo();
    showToast(t('image_sent'));
  }catch(err){showToast(err.message,true);}
  finally{if(prog)setTimeout(()=>prog.classList.remove('show'),400);}
}

function clearUploadField(inputId,previewId){
  document.getElementById(inputId).value='';
  previewThumb(inputId,previewId);
  syncUploadRemoveBtn(inputId);
}

async function onAttachPicked(e){
  const file=e.target.files[0];
  e.target.value='';
  if(!file)return;
  const prog=document.getElementById('cardAttProg');
  const fill=prog?prog.querySelector('.upload-prog-fill'):null;
  if(prog){prog.classList.add('show');if(fill)fill.style.width='0%';}
  try{
    const res=await apiUpload(file,pct=>{if(fill)fill.style.width=pct+'%';});
    document.getElementById('cardAttachment').value=res.path;
    document.getElementById('cardAttachmentName').value=res.original_name||file.name;
    updateAttPrev(res.path,res.original_name||file.name);
    updateStorageInfo();
    showToast(t('file_sent'));
  }catch(err){showToast(err.message,true);}
  finally{if(prog)setTimeout(()=>prog.classList.remove('show'),400);}
}

async function updateStorageInfo(){
  try{
    const s=await apiGet('/me/storage');
    PROMPTART.user.storage_used_bytes=s.used_bytes;
    PROMPTART.user.storage_limit_bytes=s.limit_bytes;
    fillUserMenu();
  }catch(_){}
}

// ── ATTACHMENT ───────────────────────────────────────────
function clearCardAtt(){
  document.getElementById('cardAttachment').value='';
  document.getElementById('cardAttachmentName').value='';
  document.getElementById('cardAttPrev').style.display='none';
}
function updateAttPrev(path,name){
  const wrap=document.getElementById('cardAttPrev');
  if(!wrap)return;
  if(!path){wrap.style.display='none';return;}
  const src=resolveThumb(path);
  if(src&&!isVid(src)){
    document.getElementById('cardAttImg').src=src;
    document.getElementById('cardAttImg').style.display='';
  } else {
    document.getElementById('cardAttImg').removeAttribute('src');
    document.getElementById('cardAttImg').style.display='none';
  }
  document.getElementById('cardAttName').textContent=name||t('attachment');
  wrap.style.display='flex';
}
function downloadAtt(cardId){
  const c=allCards.find(x=>x.id===cardId)||(()=>{
    for(const p of db.projects){const f=(p.cards||[]).find(x=>x.id===cardId);if(f)return f;}
    return null;
  })();
  if(!c||!c.attachment)return;
  const src=resolveThumb(c.attachment);
  if(!src)return;
  const a=document.createElement('a');a.href=src;a.download=c.attachmentName||t('attachment');
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function zoomImage(src,isVideo,baixavel){
  if(!src)return;
  const marca=baixavel?' data-baixavel':' draggable="false"';
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  const media=isVideo
    ?`<video src="${src}"${marca} autoplay loop muted playsinline controls style="max-width:92vw;max-height:92vh;border-radius:10px;object-fit:contain;"></video>`
    :`<img src="${src}"${marca} style="max-width:92vw;max-height:92vh;border-radius:10px;object-fit:contain;">`;
  ov.innerHTML=media+'<button style="position:absolute;top:18px;right:18px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>';
  ov.onclick=(e)=>{ if(e.target.tagName!=='VIDEO') document.body.removeChild(ov); };
  document.body.appendChild(ov);
}
function lightbox(cardId){
  // anexo: abre a lupa em modo "pode baixar"
  const c=allCards.find(x=>x.id===cardId)||(()=>{
    for(const p of db.projects){const f=(p.cards||[]).find(x=>x.id===cardId);if(f)return f;}
    return null;
  })();
  if(!c||!c.attachment)return;
  const src=resolveThumb(c.attachment);if(!src)return;
  zoomImage(src,false,true);
}

// ── RICH TEXT FORMAT ─────────────────────────────────────
let fmtRange=null;
let fmtActiveEditor='cardText';

function fmtCheck(){
  _fmtCheckFor('cardText','fmtPop');
}
function fmtCheckDesc(){
  _fmtCheckFor('cardDesc','fmtPopDesc');
}
function _fmtCheckFor(editorId,popId){
  const otherId=popId==='fmtPop'?'fmtPopDesc':'fmtPop';
  document.getElementById(otherId)?.classList.remove('open');
  const ed=document.getElementById(editorId);
  const pop=document.getElementById(popId);
  if(!ed||!pop)return;
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed){pop.classList.remove('open');return;}
  const range=sel.getRangeAt(0);
  let node=range.commonAncestorContainer;
  let inside=false;
  while(node&&node!==document.body){if(node.id===editorId){inside=true;break;}node=node.parentNode;}
  if(!inside){pop.classList.remove('open');return;}
  fmtRange=range.cloneRange();
  fmtActiveEditor=editorId;
  fmtShow(range,pop);
}
function fmtShow(range,pop){
  const rect=range.getBoundingClientRect();
  pop.style.visibility='hidden';
  pop.style.top='-9999px';
  pop.classList.add('open');
  requestAnimationFrame(()=>{
    const ph=pop.offsetHeight||36;
    const pw=pop.offsetWidth||220;
    let left=rect.left+(rect.width/2)-(pw/2);
    left=Math.max(8,Math.min(left,window.innerWidth-pw-8));
    let top=rect.top-ph-8;
    if(top<8)top=rect.bottom+8;
    pop.style.left=left+'px';
    pop.style.top=top+'px';
    pop.style.visibility='';
  });
}
function fmtHide(){
  document.getElementById('fmtPop')?.classList.remove('open');
  document.getElementById('fmtPopDesc')?.classList.remove('open');
}
function fmtApply(type,val,editorId){
  const eid=editorId||fmtActiveEditor||'cardText';
  const popId=eid==='cardDesc'?'fmtPopDesc':'fmtPop';
  const ed=document.getElementById(eid);if(!ed)return;
  ed.focus({preventScroll:true});
  if(fmtRange){const sel=window.getSelection();sel.removeAllRanges();sel.addRange(fmtRange);}
  const sel=window.getSelection();
  if(!sel||sel.rangeCount===0||sel.isCollapsed)return;
  const range=sel.getRangeAt(0);
  const text=range.toString();if(!text)return;
  let html='';
  if(type==='bold')html=`<b>${text}</b>`;
  else if(type==='upper')html=`<span style="text-transform:uppercase;font-weight:600;">${text}</span>`;
  else if(type==='color')html=`<span style="color:${val};font-weight:500;">${text}</span>`;
  else if(type==='highlight')html=`<mark class="hl">${text}</mark>`;
  else if(type==='clear'){range.deleteContents();range.insertNode(document.createTextNode(text));fmtHide();return;}
  range.deleteContents();
  const tmp=document.createElement('template');tmp.innerHTML=html;
  range.insertNode(tmp.content);
  range.collapse(false);sel.removeAllRanges();sel.addRange(range);
  fmtHide();
}
document.addEventListener('mousedown',e=>{
  if(!e.target.closest('#fmtPop')&&!e.target.closest('#fmtPopDesc'))fmtHide();
});

// ── MODAL ────────────────────────────────────────────────
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>{
  let pressedOnOverlay = false;
  o.addEventListener('mousedown', e => { pressedOnOverlay = (e.target === o); });
  o.addEventListener('mouseup', e => {
    if (pressedOnOverlay && e.target === o) o.classList.remove('open');
    pressedOnOverlay = false;
  });
  o.addEventListener('touchstart', e => { pressedOnOverlay = (e.target === o); }, {passive:true});
  o.addEventListener('touchend', e => {
    if (pressedOnOverlay && e.target === o) o.classList.remove('open');
    pressedOnOverlay = false;
  });
});
// ── ATALHOS DE TECLADO + MAGIC MOUSE ─────────────────────
let shortcutsEnabled = true;

function toggleShortcutModal(){
  const m = document.getElementById('shortcutModal');
  m.classList.toggle('open');
}

/* A lista de atalhos saiu da ajuda, junto com o interruptor que a acompanhava.
   Os atalhos em si continuam ativos — quem descobrir, usa. A função fica para
   um eventual ajuste futuro e tolera a ausência dos elementos. */
function toggleShortcuts(enabled){
  shortcutsEnabled = enabled;
  document.getElementById('shortcutBtn')?.classList.toggle('active-shortcuts', enabled);
}

function closeShortcutOnBackdrop(e){
  if(e.target === document.getElementById('shortcutModal')) closeModal('shortcutModal');
}

(function(){
  function modalOpen(){return!!document.querySelector('.overlay.open');}
  function inInput(){const t=document.activeElement;return t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName));}
  function activePage(){
    if(currentProjId)return'project';
    if(document.getElementById('favoritesPage')?.classList.contains('active'))return'favs';
    return'home';
  }

  document.addEventListener('keydown',e=>{
    const ctrl=e.ctrlKey||e.metaKey;

    // ? abre/fecha o painel (sempre funciona, mesmo com atalhos desativados)
    if(e.key==='?'&&!ctrl&&!e.altKey&&!inInput()){
      toggleShortcutModal(); e.preventDefault(); return;
    }

    // a partir daqui, respeita o toggle
    if(!shortcutsEnabled) return;

    if(e.key==='Escape'){
      const opened=document.querySelectorAll('.overlay.open');
      if(opened.length){opened.forEach(m=>m.classList.remove('open'));e.preventDefault();return;}
      if(activePage()==='project'){goHome();e.preventDefault();}
      return;
    }

    if(e.key==='Enter'&&!e.shiftKey){
      if(document.activeElement?.id==='cardText')return;
      const cardModal=document.getElementById('cardModal');
      const projModal=document.getElementById('projModal');
      const subcatModal=document.getElementById('subcatModal');
      const genSaveModal=document.getElementById('genSaveModal');
      if(cardModal?.classList.contains('open')&&!inInput()){saveCard();e.preventDefault();return;}
      if(projModal?.classList.contains('open')&&!inInput()){saveProjeto();e.preventDefault();return;}
      if(subcatModal?.classList.contains('open')&&document.activeElement?.id!=='subcatNewName'){closeModal('subcatModal');e.preventDefault();return;}
      if(genSaveModal?.classList.contains('open')&&!inInput()){saveGenerated();e.preventDefault();return;}
      return;
    }

    if(ctrl&&e.key==='s'){
      e.preventDefault();
      const cardModal=document.getElementById('cardModal');
      const projModal=document.getElementById('projModal');
      if(cardModal?.classList.contains('open')){saveCard();return;}
      if(projModal?.classList.contains('open')){saveProjeto();return;}
    }

    if(ctrl&&e.key==='n'){
      e.preventDefault();
      if(modalOpen())return;
      if(activePage()==='project')openNewCard();
      else openNewProject();
      return;
    }

    if(!modalOpen()&&!inInput()){
      if(e.key==='Backspace'||(e.key==='ArrowLeft'&&e.altKey)){
        if(activePage()==='project'){goHome();e.preventDefault();}
        return;
      }
    }
  });

  // Magic Mouse / Trackpad swipe
  let swipeAcc=0, swipeTimer=null;
  document.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX))return;
    if(modalOpen())return;
    if(!shortcutsEnabled)return;
    if(activePage()!=='project')return;
    swipeAcc+=e.deltaX;
    clearTimeout(swipeTimer);
    swipeTimer=setTimeout(()=>{swipeAcc=0;},300);
    if(swipeAcc<-120){swipeAcc=0;goHome();}
  },{passive:true});
})();

// ── TOAST ────────────────────────────────────────────────
// mostra/esconde o campo de URL externa (fica oculto para não expor o caminho do upload)
function toggleUrlField(id){
  const campo=document.getElementById(id);
  if(!campo)return;
  campo.classList.toggle('show');
  if(campo.classList.contains('show'))campo.focus();
}

function showToast(msg,err){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast'+(err?' error':'');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ── SCROLL TOP ───────────────────────────────────────────
window.addEventListener('scroll',()=>{
  const btn=document.getElementById('scrollTopBtn');
  btn&&(window.scrollY>400?btn.classList.add('vis'):btn.classList.remove('vis'));
},{passive:true});

// ── UTILS ────────────────────────────────────────────────
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
const ALLOWED_COLORS=['#fa4d4d','#ff8c00','#f5c400','#28cd41','#007aff','#bf5af2'];
function sanitizeColors(html){
  if(!html)return html;
  const tmp=document.createElement('div');
  tmp.innerHTML=html;
  tmp.querySelectorAll('[style]').forEach(el=>{
    const col=(el.style.color||'').toLowerCase().replace(/\s/g,'');
    if(col){
      // normaliza rgb(...) para comparar; só mantém se bater com cor permitida
      const keep=ALLOWED_COLORS.some(hex=>{
        const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
        return col===hex || col===`rgb(${r},${g},${b})`;
      });
      if(!keep) el.style.color='';
    }
    // remove background-color colado (highlights brancos/escuros)
    if(el.style.backgroundColor) el.style.backgroundColor='';
    if(!el.getAttribute('style')) el.removeAttribute('style');
  });
  // remove atributo color="" legado
  tmp.querySelectorAll('font[color]').forEach(f=>{
    const col=(f.getAttribute('color')||'').toLowerCase();
    if(!ALLOWED_COLORS.includes(col)) f.removeAttribute('color');
  });
  return tmp.innerHTML;
}
function onEditorPaste(e){
  // cola sempre como texto puro — descarta cores/estilos copiados de fora
  e.preventDefault();
  const text=(e.clipboardData||window.clipboardData).getData('text/plain');
  // insere no ponto do cursor como texto simples
  const sel=window.getSelection();
  if(sel&&sel.rangeCount){
    const range=sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();sel.addRange(range);
  } else {
    document.getElementById('cardText').appendChild(document.createTextNode(text));
  }
}
// Preferências de ordenação: por dispositivo (localStorage)
/* A Home ordena por nome ou por ordem de criação. A biblioteca bônus, que o
   usuário não cria nem reordena, ordena por nome ou pela mais atualizada — que
   é o que responde "o que mudou desde a última vez que entrei". Preferências
   separadas, senão um modo estragaria o outro. */
function getSortProj(){
  return bonusMode
    ? (localStorage.getItem('sortBonus') || 'updated')
    : (localStorage.getItem('sortProj') || 'created');
}
function getSortCard(){return localStorage.getItem('sortCard')||'created';}
function setSortProj(mode){
  localStorage.setItem(bonusMode ? 'sortBonus' : 'sortProj', mode);
  renderProjects();
}
function setSortCard(mode){localStorage.setItem('sortCard',mode);if(typeof filterCards==='function')filterCards();}
function toggleSortProj(){
  const outro = bonusMode ? 'updated' : 'created';
  setSortProj(getSortProj() === 'alpha' ? outro : 'alpha');
}
function toggleSortCard(){setSortCard(getSortCard()==='alpha'?'created':'alpha');}
function sortItems(arr,mode,nameKey){
  const a=[...arr];
  if(mode==='alpha'){
    a.sort((x,y)=>(x[nameKey]||'').localeCompare((y[nameKey]||''),'pt',{sensitivity:'base'}));
  } else if(mode==='updated'){
    // mais recente primeiro: quem ganhou prompt novo sobe para o topo
    a.sort((x,y)=>String(y.atualizadaEm||'').localeCompare(String(x.atualizadaEm||'')));
  }
  // 'created' = ordem original (já é a ordem de criação no array)
  return a;
}
function toggleClear(inputId,btnId){
  const inp=document.getElementById(inputId);const btn=document.getElementById(btnId);
  if(!inp||!btn)return;
  btn.classList.toggle('show', inp.value.length>0);
}
function clearSearch(inputId,fnName,btnId){
  const inp=document.getElementById(inputId);if(!inp)return;
  inp.value='';
  document.getElementById(btnId).classList.remove('show');
  if(typeof window[fnName]==='function') window[fnName]();
  inp.focus();
}

// ── MOVE CARD ────────────────────────────────────────────
let movingCardId = null;
let moveDestProjId = null;

function openMoveCard(cardId) {
  const srcProj = db.projects.find(p => p.id === currentProjId);
  const card = srcProj ? (srcProj.cards||[]).find(c => c.id === cardId) : null;
  if(!card) return;
  movingCardId = cardId;
  moveDestProjId = null;
  document.getElementById('moveModalTitle').textContent = 'Mover card para...';
  document.getElementById('moveCardName').textContent =
    '"' + (card.title||'Card') + '" — em ' + (srcProj.name||'');
  // Resetar etapas
  document.getElementById('moveStep1').style.display = '';
  document.getElementById('moveStep2').style.display = 'none';
  // Montar lista de categorias
  const list = document.getElementById('moveProjectList');
  list.innerHTML = '';
  const others = db.projects.filter(p => p.id !== currentProjId);
  if(!others.length) {
    list.innerHTML = '<p style="font-size:.8rem;color:var(--muted);text-align:center;padding:1.5rem 0;">Nenhuma outra categoria disponível.</p>';
  } else {
    others.forEach(p => {
      const hasSubcats = (p.subcats||[]).length > 0;
      const d = document.createElement('div');
      d.className = 'proj-option';
      d.innerHTML = `<div>
        <div class="proj-option-name">${p.name}</div>
        <div class="proj-option-count">${(p.cards||[]).length} prompt${(p.cards||[]).length!==1?'s':''}${hasSubcats?' · '+p.subcats.length+' subcat'+( p.subcats.length!==1?'s':''):''}</div>
      </div>
      <svg style="margin-left:auto;color:var(--accent);flex-shrink:0;" width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M3 10h14M12 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      d.onclick = () => movePickCategory(p.id);
      list.appendChild(d);
    });
  }
  document.getElementById('moveModal').classList.add('open');
}

function movePickCategory(destId) {
  const destProj = db.projects.find(p => p.id === destId);
  if(!destProj) return;
  moveDestProjId = destId;
  const subcats = destProj.subcats||[];
  if(!subcats.length) {
    // sem subcategorias → move direto
    executeMoveToSubcat(null);
    return;
  }
  // tem subcategorias → mostrar etapa 2
  document.getElementById('moveModalTitle').textContent = 'Subcategoria em "'+destProj.name+'"';
  document.getElementById('moveStep1').style.display = 'none';
  document.getElementById('moveStep2').style.display = '';
  const subcatList = document.getElementById('moveSubcatList');
  subcatList.innerHTML = subcats.map(sc => {
    const cnt = (destProj.cards||[]).filter(c=>(c.subcats||[]).includes(sc)).length;
    return `<div class="proj-option" onclick="executeMoveToSubcat('${sc}')">
      <div>
        <div class="proj-option-name">${sc}</div>
        <div class="proj-option-count">${cnt} card${cnt!==1?'s':''}</div>
      </div>
      <svg style="margin-left:auto;color:var(--accent);flex-shrink:0;" width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M3 10h14M12 4l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;
  }).join('');
}

function moveBackToStep1() {
  moveDestProjId = null;
  document.getElementById('moveModalTitle').textContent = 'Mover card para...';
  document.getElementById('moveStep1').style.display = '';
  document.getElementById('moveStep2').style.display = 'none';
}

async function executeMoveToSubcat(subcat) {
  const srcProj = db.projects.find(p => p.id === currentProjId);
  const destProj = db.projects.find(p => p.id === moveDestProjId);
  if(!srcProj || !destProj || !movingCardId) return;
  const idx = (srcProj.cards||[]).findIndex(c => c.id === movingCardId);
  if(idx === -1) return;
  try{
    const res=await apiPost('/prompts/'+movingCardId+'/move',{
      category_id: destProj.id,
      subcategory: subcat||null
    });
    const moved=mapPrompt(res.data||res);
    srcProj.cards.splice(idx, 1);
    if(!destProj.cards) destProj.cards = [];
    destProj.cards.push(moved);
    closeModal('moveModal');
    allCards = [...(srcProj.cards||[])];
    renderCards(allCards);
    renderSubcatBar();
    const destino = subcat ? destProj.name+' › '+subcat : destProj.name;
    showToast(t('card_moved_to',{name:destino}));
  }catch(err){showToast(err.message,true);}
  movingCardId = null;
  moveDestProjId = null;
}

// ═══ GERADOR DE PROMPTS (3 modos: IMAGEM, TEXTO, EMOJI) ═══
let genMode='image';
// memória dos campos de texto livre (persiste ao trocar de aba)
const GTXT={};
function gtxtSet(id,val){GTXT[id]=val;}
function gtxtRestore(){
 // restaura valores salvos nos inputs/textareas após cada render
 for(const id in GTXT){const el=document.getElementById(id);if(el&&GTXT[id]!=null)el.value=GTXT[id];}
}
let genLang='en';

// ---------- DADOS: IMAGEM ----------
const IMG_SUBJECTS=[{id:"man",icon:"👨",name:"Homem"},{id:"woman",icon:"👩",name:"Mulher"},{id:"child",icon:"🧒",name:"Criança"},{id:"couple",icon:"👫",name:"Casal/Grupo"},{id:"animal",icon:"🐾",name:"Animal"},{id:"product",icon:"📦",name:"Produto"}];
const IMG_SUBJECT_FIELDS={
 person:[{id:"age",label:"Idade",ph:"jovem ~25, meia-idade, idoso...",en:v=>v,pt:v=>v},{id:"ethnicity",label:"Etnia / pele",ph:"negra, latino, asiático, branco...",en:v=>v,pt:v=>v},{id:"build",label:"Físico",ph:"atlético, magro, alto...",en:v=>"with a "+v+" build",pt:v=>"de físico "+v},{id:"hair",label:"Cabelo",ph:"cacheado curto preto, loiro liso...",en:v=>"with "+v+" hair",pt:v=>"com cabelo "+v},{id:"eyes",label:"Olhos",ph:"castanhos, azuis, verdes...",en:v=>"with "+v+" eyes",pt:v=>"com olhos "+v},{id:"clothing",label:"Roupa",ph:"terno cinza, jaqueta jeans...",en:v=>"wearing "+v,pt:v=>"vestindo "+v},{id:"expression",label:"Expressão",ph:"sorriso confiante, sério...",en:v=>"with a "+v+" expression",pt:v=>"com expressão "+v},{id:"extra",label:"Outros",ph:"óculos, barba, tatuagem...",en:v=>v,pt:v=>v}],
 animal:[{id:"species",label:"Espécie/raça",ph:"gato persa, golden, leão...",en:v=>v,pt:v=>v},{id:"color",label:"Cor/pelagem",ph:"pelo laranja, penas azuis...",en:v=>"with "+v,pt:v=>"com "+v},{id:"eyes",label:"Olhos",ph:"âmbar, verdes...",en:v=>"with "+v+" eyes",pt:v=>"com olhos "+v},{id:"age",label:"Idade",ph:"filhote, adulto...",en:v=>v,pt:v=>v},{id:"pose",label:"Pose",ph:"deitado, correndo...",en:v=>v,pt:v=>v},{id:"extra",label:"Outros",ph:"coleira, pelo molhado...",en:v=>v,pt:v=>v}],
 product:[{id:"what",label:"O que é",ph:"tênis, perfume, fone...",en:v=>v,pt:v=>v},{id:"brand",label:"Marca",ph:"(opcional)",en:v=>"branded "+v,pt:v=>"da marca "+v},{id:"material",label:"Material",ph:"couro preto, vidro fosco...",en:v=>"made of "+v,pt:v=>"feito de "+v},{id:"color",label:"Cor",ph:"vermelho metálico...",en:v=>"in "+v,pt:v=>"na cor "+v},{id:"extra",label:"Outros",ph:"detalhes dourados, logo...",en:v=>v,pt:v=>v}]
};
const IMG_LOC_CATS=["Interno","Externo","Estúdio","Estilizado"];
const IMG_LOCATIONS={"Interno":[{id:"home",icon:"🏠",name:"Casa/Sala",en:"cozy home interior living room",pt:"interior aconchegante de uma sala"},{id:"cafe",icon:"☕",name:"Café",en:"warm coffee shop interior",pt:"interior aconchegante de uma cafeteria"},{id:"office",icon:"💼",name:"Escritório",en:"modern office interior",pt:"interior de um escritório moderno"},{id:"loft",icon:"🏢",name:"Loft",en:"industrial loft with exposed brick",pt:"loft industrial com tijolos aparentes"},{id:"kitchen",icon:"🍳",name:"Cozinha",en:"bright modern kitchen",pt:"cozinha moderna e iluminada"}],"Externo":[{id:"street",icon:"🌆",name:"Rua/Cidade",en:"urban city street",pt:"rua de uma cidade urbana"},{id:"nature",icon:"🌲",name:"Natureza",en:"lush natural landscape",pt:"paisagem natural exuberante"},{id:"beach",icon:"🏖️",name:"Praia",en:"sunny beach by the ocean",pt:"praia ensolarada à beira-mar"},{id:"mountain",icon:"⛰️",name:"Montanha",en:"dramatic mountain landscape",pt:"paisagem montanhosa dramática"},{id:"rooftop",icon:"🌃",name:"Rooftop",en:"city rooftop at night with bokeh lights",pt:"rooftop na cidade à noite com luzes bokeh"},{id:"forest",icon:"🌳",name:"Floresta",en:"misty forest with filtered light",pt:"floresta enevoada com luz filtrada"}],"Estúdio":[{id:"white",icon:"⬜",name:"Fundo Branco",en:"clean seamless white studio background",pt:"fundo de estúdio branco infinito"},{id:"black",icon:"⬛",name:"Fundo Preto",en:"dramatic black studio background",pt:"fundo de estúdio preto dramático"},{id:"color_bg",icon:"🎨",name:"Fundo Colorido",en:"solid colored studio backdrop",pt:"fundo de estúdio de cor sólida"},{id:"gradient_bg",icon:"🌅",name:"Degradê",en:"smooth gradient studio backdrop",pt:"fundo de estúdio em degradê"}],"Estilizado":[{id:"surreal",icon:"🌀",name:"Surreal",en:"surreal dreamlike environment",pt:"ambiente surreal e onírico"},{id:"cyberpunk",icon:"🌃",name:"Cyberpunk",desc:"Neon roxo/ciano",en:"neon-lit cyberpunk city",pt:"cidade cyberpunk com neon"},{id:"fantasy",icon:"🏰",name:"Fantasia",en:"epic fantasy environment",pt:"ambiente épico de fantasia"},{id:"abstract",icon:"🟣",name:"Abstrato",en:"abstract minimal set with geometric props",pt:"cenário abstrato minimalista"}]};
const IMG_LIGHTING=[{id:"natural",icon:"☀️",name:"Natural",desc:"Luz do dia neutra",en:"natural daylight",pt:"luz natural do dia"},{id:"golden",icon:"🌅",name:"Golden Hour",desc:"Quente, fim de tarde",en:"warm golden-hour light",pt:"luz quente de golden hour"},{id:"blue_hour",icon:"🌌",name:"Blue Hour",desc:"Azulada, crepúsculo",en:"cool blue-hour twilight light",pt:"luz fria de blue hour"},{id:"soft",icon:"💡",name:"Suave/Softbox",desc:"Difusa, sem sombra dura",en:"soft diffused softbox lighting",pt:"luz suave e difusa de softbox"},{id:"dramatic",icon:"🎬",name:"Dramática",desc:"Alto contraste, sombras",en:"dramatic high-contrast lighting with deep shadows",pt:"luz dramática de alto contraste"},{id:"rim",icon:"🌗",name:"Contraluz",desc:"Borda iluminada por trás",en:"backlit rim lighting separating subject from background",pt:"luz de recorte (contraluz)"},{id:"neon",icon:"🟣",name:"Neon",desc:"Colorida, urbana noturna",en:"colorful neon lighting",pt:"iluminação colorida de neon"},{id:"studio3p",icon:"📸",name:"3 Pontos",desc:"Estúdio profissional",en:"professional three-point studio lighting",pt:"iluminação de estúdio 3 pontos"},{id:"cinematic",icon:"🎥",name:"Cinematográfica",desc:"Volumétrica, atmosfera",en:"cinematic volumetric lighting with atmosphere",pt:"iluminação cinematográfica volumétrica"},{id:"lowkey",icon:"🌑",name:"Low Key",desc:"Escura, sombria",en:"moody low-key lighting",pt:"iluminação low-key dramática"},{id:"highkey",icon:"⚪",name:"High Key",desc:"Clara, suave",en:"bright airy high-key lighting",pt:"iluminação high-key clara"},{id:"window",icon:"🪟",name:"Janela",desc:"Natural lateral suave",en:"soft natural window light from the side",pt:"luz natural suave de janela lateral"},{id:"hardsun",icon:"🌞",name:"Sol Forte",desc:"Direto, sombras duras",en:"harsh direct midday sunlight with hard shadows",pt:"luz solar forte com sombras duras"},{id:"overcast",icon:"☁️",name:"Nublado",desc:"Difusa, sem direção",en:"soft overcast diffused lighting",pt:"luz difusa de dia nublado"},{id:"spotlight",icon:"🔦",name:"Holofote",desc:"Foco único direcional",en:"single dramatic spotlight with dark falloff",pt:"holofote único dramático"},{id:"candle",icon:"🕯️",name:"Vela",desc:"Quente, intimista",en:"warm intimate candle-light glow",pt:"luz quente de vela"},{id:"split",icon:"🔵",name:"Dupla Cor",desc:"Azul + magenta",en:"dual-color split lighting (blue and magenta)",pt:"iluminação dupla (azul e magenta)"},{id:"godrays",icon:"⛅",name:"Raios de Luz",desc:"God rays volumétricos",en:"dramatic volumetric god rays",pt:"raios de luz volumétricos (god rays)"}];
const IMG_MOODS=[{id:"none",icon:"🚫",name:"Neutro",desc:"Sem ajuste de cor",en:"",pt:""},{id:"warm",icon:"🔥",name:"Quente",desc:"Tons laranja/amarelo",en:"warm color palette",pt:"paleta de cores quentes"},{id:"cool",icon:"❄️",name:"Frio",desc:"Tons azul/verde",en:"cool color palette",pt:"paleta de cores frias"},{id:"vibrant",icon:"🌈",name:"Vibrante",desc:"Cores fortes saturadas",en:"bold vibrant saturated colors",pt:"cores vibrantes e saturadas"},{id:"muted",icon:"🌫️",name:"Suave",desc:"Dessaturado, discreto",en:"muted desaturated tones",pt:"tons suaves dessaturados"},{id:"moody",icon:"🌑",name:"Sombrio",desc:"Escuro, dramático",en:"dark moody atmosphere",pt:"atmosfera escura e sombria"},{id:"pastel",icon:"🩰",name:"Pastel",desc:"Cores claras suaves",en:"soft pastel palette",pt:"paleta pastel suave"},{id:"teal_orange",icon:"🎬",name:"Teal&Orange",desc:"Look de cinema clássico",en:"cinematic teal-and-orange grade",pt:"correção teal-and-orange"},{id:"vintage",icon:"📻",name:"Vintage",desc:"Retrô, desbotado",en:"vintage faded retro color grade",pt:"correção vintage retrô"},{id:"highcontrast",icon:"⚫",name:"Alto Contraste",desc:"P&B marcante",en:"high-contrast punchy look",pt:"visual de alto contraste"},{id:"bw",icon:"🎞️",name:"P&B",desc:"Monocromático",en:"black and white monochrome",pt:"preto e branco monocromático"},{id:"dreamy",icon:"✨",name:"Onírico",desc:"Suave, etéreo",en:"dreamy ethereal soft glow",pt:"atmosfera onírica etérea"},{id:"earthy",icon:"🍂",name:"Terroso",desc:"Tons de terra naturais",en:"earthy natural tones",pt:"tons terrosos naturais"},{id:"cyberpunk_mood",icon:"🌃",name:"Cyberpunk",desc:"Neon roxo/ciano",en:"cyberpunk neon purple-and-cyan palette",pt:"paleta cyberpunk neon"}];
const IMG_STYLES=[{id:"photoreal",icon:"📷",name:"Foto Realista",desc:"Parece foto real, hiper-detalhada",en:"photorealistic professional photograph, ultra-detailed, 8K",pt:"fotografia profissional fotorrealista, ultra-detalhada, 8K"},{id:"cinematic",icon:"🎥",name:"Cinematográfico",desc:"Frame de filme, cor de cinema",en:"cinematic film still, anamorphic, color graded",pt:"frame cinematográfico, anamórfico, com correção de cor"},{id:"editorial",icon:"📰",name:"Editorial/Moda",desc:"Foto de revista, alta-costura",en:"high-fashion editorial photography",pt:"fotografia editorial de moda"},{id:"product_clean",icon:"🛍️",name:"Produto Limpo",desc:"Fundo neutro, e-commerce",en:"clean commercial product photography, e-commerce quality",pt:"fotografia comercial de produto limpa"},{id:"product_lux",icon:"💎",name:"Produto Luxo",desc:"Premium, reflexos, sofisticado",en:"luxury editorial product photography with dramatic reflections",pt:"fotografia de produto de luxo com reflexos"},{id:"3d_render",icon:"🧊",name:"Render 3D",desc:"CGI realista, materiais físicos",en:"hyper-realistic 3D CGI render, physically-based",pt:"render 3D CGI hiper-realista"},{id:"pixar",icon:"🎈",name:"3D Cartoon",desc:"Animação fofa estilo Pixar",en:"stylized 3D cartoon render, Pixar-style",pt:"render 3D cartoon estilo Pixar"},{id:"anime",icon:"🌸",name:"Anime",desc:"Ilustração japonesa, traço limpo",en:"anime illustration style, high detail",pt:"estilo de ilustração anime"},{id:"illustration",icon:"🎨",name:"Ilustração",desc:"Desenho digital pictórico",en:"digital illustration, painterly",pt:"ilustração digital pictórica"},{id:"watercolor",icon:"🖌️",name:"Aquarela",desc:"Pintura aguada, bordas suaves",en:"watercolor painting style with soft bleeding edges",pt:"pintura em aquarela com bordas suaves"},{id:"oilpaint",icon:"🪔",name:"Óleo",desc:"Pinceladas ricas, clássico",en:"classical oil painting with rich brushstrokes",pt:"pintura a óleo clássica"},{id:"film35",icon:"🎞️",name:"Filme 35mm",desc:"Analógico, grão natural",en:"shot on 35mm film, natural grain, analog look",pt:"filme 35mm, grão natural, analógico"},{id:"polaroid",icon:"📸",name:"Polaroid",desc:"Instantânea, vintage, moldura",en:"vintage Polaroid instant photo look with frame",pt:"foto Polaroid vintage com moldura"},{id:"comic",icon:"💥",name:"Comic/HQ",desc:"Quadrinhos, contorno forte",en:"comic-book illustration with bold ink outlines",pt:"ilustração estilo HQ com contornos fortes"},{id:"3d_clay",icon:"🟤",name:"Claymation",desc:"Massinha, stop-motion",en:"claymation stop-motion style with clay texture",pt:"claymation stop-motion com textura de massinha"}];
const IMG_ASPECTS=[{id:"",icon:"🚫",name:"Sem definir"},{id:"1:1",icon:"⬛",name:"1:1 Quadrado"},{id:"4:5",icon:"📱",name:"4:5 Feed"},{id:"9:16",icon:"📲",name:"9:16 Stories"},{id:"16:9",icon:"🖥️",name:"16:9 Wide"},{id:"21:9",icon:"🎬",name:"21:9 Cinema"},{id:"3:2",icon:"📷",name:"3:2 Foto"},{id:"2:3",icon:"🖼️",name:"2:3 Retrato"},{id:"4:3",icon:"📺",name:"4:3 Clássico"},{id:"3:4",icon:"🃏",name:"3:4 Vertical"}];
const IMG_CAM_SHOT=[["","— sem preferência —"],["extreme close-up macro shot","Extreme close-up (macro)"],["close-up portrait","Close-up / retrato"],["headshot portrait","Headshot (rosto)"],["bust shot (head and shoulders)","Busto"],["medium shot (waist up)","Plano médio (cintura)"],["cowboy shot (mid-thigh up)","Plano americano"],["full body shot","Corpo inteiro"],["wide establishing shot","Plano aberto/geral"],["extreme wide shot, subject small in frame","Plano muito aberto"],["overhead top-down shot","Visto de cima"],["high-angle shot looking down","Plongée"],["low-angle hero shot","Contra-plongée"],["eye-level shot","Altura dos olhos"],["over-the-shoulder shot","Por cima do ombro"],["dutch angle tilted shot","Câmera inclinada"],["profile side view","Perfil"],["three-quarter view","Três-quartos"],["from behind, back view","De costas"]];
const IMG_CAM_LENS=[["","— sem preferência —"],["8mm fisheye lens","8mm fisheye"],["14mm ultra-wide lens","14mm ultra-wide"],["24mm wide lens","24mm wide"],["35mm lens","35mm"],["50mm lens","50mm natural"],["85mm portrait lens","85mm retrato"],["105mm portrait lens","105mm retrato"],["135mm telephoto lens","135mm tele"],["200mm telephoto lens","200mm tele"],["100mm macro lens","100mm macro"],["tilt-shift lens","Tilt-shift"],["anamorphic cinema lens","Anamórfica"]];
const IMG_CAM_APER=[["","— sem preferência —"],["shot at f/1.2 with extremely shallow depth of field and creamy bokeh","f/1.2 extremo desfocado"],["shot at f/1.4 with very shallow depth of field and creamy bokeh","f/1.4 muito desfocado"],["shot at f/1.8 with shallow depth of field and soft bokeh","f/1.8 desfocado"],["shot at f/2.8 with shallow depth of field","f/2.8 leve desfoque"],["shot at f/4 with moderate depth of field","f/4 médio-raso"],["shot at f/5.6 with moderate depth of field","f/5.6 médio"],["shot at f/8 with good depth of field","f/8 boa nitidez"],["shot at f/11 with deep focus, everything sharp","f/11 tudo nítido"],["shot at f/16 with maximum deep focus","f/16 máxima nitidez"]];

// ---------- DADOS: TEXTO ----------
const TXT_FONTS=[{id:"gothic",icon:"🥀",name:"Gótica",txt:"ornate gothic blackletter font with sharp angular serifs, medieval calligraphic strokes"},{id:"handwritten",icon:"✍️",name:"Manuscrita",txt:"natural handwritten script with organic flowing strokes, casual pen-pressure variation"},{id:"calligraphy",icon:"🖋️",name:"Caligrafia",txt:"elegant brush calligraphy with refined flowing strokes, expressive thick-and-thin contrast"},{id:"paint",icon:"🎨",name:"Pintura",txt:"thick painted brush lettering with visible bristle strokes, dripping paint texture"},{id:"balloon",icon:"🎈",name:"Balão",txt:"inflated balloon lettering with rounded puffy 3D volume, glossy taut surface"},{id:"square",icon:"⬛",name:"Quadrada",txt:"bold geometric square sans-serif font with strict right angles, uniform stroke width"},{id:"bubble",icon:"🫧",name:"Bubble",txt:"chunky bubble font with thick rounded outlines, cartoon proportions"},{id:"graffiti",icon:"🎭",name:"Graffiti",txt:"urban graffiti lettering with spray-paint texture, dynamic overlapping tags"},{id:"retro70",icon:"🌈",name:"Retrô 70s",txt:"groovy 1970s retro lettering with wavy bulging letterforms, psychedelic flow"},{id:"serif_lux",icon:"👑",name:"Serif Luxo",txt:"elegant high-contrast luxury serif font with refined thin serifs, editorial sophistication"},{id:"sans_modern",icon:"📐",name:"Sans Moderna",txt:"clean modern sans-serif font with minimal geometric forms, tech-brand clarity"},{id:"horror",icon:"💀",name:"Horror",txt:"horror-style distorted lettering with jagged torn edges, dripping unsettling forms"},{id:"comic",icon:"💥",name:"Comic",txt:"bold comic-book lettering with strong outlines, impact-style weight"},{id:"pixel",icon:"👾",name:"Pixel 8-bit",txt:"pixel-art 8-bit lettering with crisp blocky pixels, retro video-game sprite font"},{id:"neon_script",icon:"💡",name:"Neon Script",txt:"glowing neon-tube script lettering with continuous luminous glass tubes"},{id:"chrome",icon:"🪞",name:"Chrome Y2K",txt:"liquid chrome Y2K lettering with mirror-metal reflective surface, futuristic gloss"}];
const TXT_MAT_CATS=["Metais","Orgânicos","Têxteis","Líquidos","Gasosos","Cremosos","Sólidos","Temáticos","Especiais"];
const TXT_MATERIALS={"Metais":[{id:"gold",icon:"✨",name:"Ouro",txt:"polished gold metal with warm yellow metallic reflectance"},{id:"chrome_mat",icon:"🪞",name:"Cromo",txt:"mirror-polished chrome with perfect environmental reflections"},{id:"copper",icon:"🟠",name:"Cobre",txt:"brushed copper metal with warm reddish tones and oxidation patina"},{id:"steel",icon:"⚙️",name:"Aço",txt:"brushed stainless steel with fine directional grain"},{id:"rust",icon:"🟤",name:"Enferrujado",txt:"rusted corroded metal with rough oxidized texture, flaking patina"},{id:"liquid_metal",icon:"💧",name:"Metal Líquido",txt:"flowing liquid metal like mercury with seamless reflective surface"}],"Orgânicos":[{id:"wood",icon:"🪵",name:"Madeira",txt:"natural wood with visible grain patterns, warm tones"},{id:"leaves",icon:"🌿",name:"Folhas",txt:"living foliage and leaves forming the letterforms, lush botanical growth"},{id:"flowers",icon:"🌸",name:"Flores",txt:"blooming flowers and petals composing each letter"},{id:"stone",icon:"🪨",name:"Pedra",txt:"carved natural stone with mineral texture, rough chiseled surface"},{id:"bone",icon:"🦴",name:"Osso/Marfim",txt:"polished bone or ivory with smooth organic surface, pale tones"},{id:"coral",icon:"🪸",name:"Coral",txt:"living coral reef texture with porous organic structure"},{id:"vine",icon:"🌱",name:"Galhos",txt:"intertwined branches and roots forming letters, gnarled woody structure"}],"Têxteis":[{id:"wool",icon:"🧶",name:"Lã",txt:"soft knitted wool with visible fuzzy fiber texture and cozy hand-knitted stitches"},{id:"crochet_t",icon:"🪡",name:"Crochê",txt:"handmade crochet with visible yarn loops and stitch pattern, artisanal texture"},{id:"knit",icon:"🧵",name:"Tricô",txt:"chunky knitted texture with thick interlocking stitches, soft yarn"},{id:"felt_t",icon:"🟥",name:"Feltro",txt:"soft felt material with coarse matte fiber texture, handcrafted look"},{id:"embroidery_t",icon:"🪧",name:"Bordado",txt:"embroidered satin-stitch thread with raised dimensional texture on fabric"},{id:"denim_t",icon:"👖",name:"Jeans",txt:"woven denim fabric with diagonal twill weave and frayed edges"},{id:"velvet_t",icon:"🟣",name:"Veludo",txt:"rich velvet fabric with soft plush nap and deep color"},{id:"plush_t",icon:"🧸",name:"Pelúcia",txt:"ultra-soft plush fur material with dense fluffy fibers"},{id:"fabric_t",icon:"🧺",name:"Tecido",txt:"woven cotton fabric with natural thread weave and soft folds"}],
"Líquidos":[{id:"water",icon:"💦",name:"Água",txt:"clear flowing water with realistic surface tension, splashes and transparency"},{id:"honey",icon:"🍯",name:"Mel",txt:"thick golden honey with slow viscous drips and glossy amber translucency"},{id:"lava",icon:"🌋",name:"Lava",txt:"molten glowing lava with incandescent orange flow and dark cooling crust"},{id:"paint_liquid",icon:"🎨",name:"Tinta Líquida",txt:"flowing liquid paint with vivid colors, glossy drips and swirling patterns"},{id:"milk",icon:"🥛",name:"Leite",txt:"opaque milk with soft white splashes and smooth liquid crowns"},{id:"oil",icon:"🛢️",name:"Óleo",txt:"dark glossy oil with iridescent rainbow surface sheen"},{id:"slime",icon:"🟢",name:"Slime",txt:"stretchy translucent slime with sticky gooey strands and glossy surface"}],"Gasosos":[{id:"smoke",icon:"💨",name:"Fumaça",txt:"swirling smoke forming letterforms, wispy ethereal tendrils"},{id:"fire",icon:"🔥",name:"Fogo",txt:"blazing fire with dynamic flames, glowing embers and hot luminous core"},{id:"cloud",icon:"☁️",name:"Nuvem",txt:"soft fluffy cloud vapor forming each letter, dreamy volumetric mist"},{id:"steam",icon:"♨️",name:"Vapor",txt:"hot translucent steam wisps forming letters, soft rising vapor"},{id:"plasma",icon:"⚡",name:"Plasma",txt:"crackling plasma energy with electric arcs, glowing ionized gas"},{id:"fog",icon:"🌫️",name:"Névoa",txt:"dense atmospheric fog forming letterforms, moody volumetric haze"}],"Cremosos":[{id:"cosmetic_cream",icon:"🧴",name:"Creme",txt:"smooth cosmetic cream with velvety matte-satin finish, opaque dense body, clean rounded peaks"},{id:"oil_paint",icon:"🎨",name:"Tinta Óleo",txt:"thick impasto oil paint with rich pigmented body, visible brush strokes, glossy wet sheen"},{id:"cream",icon:"🍦",name:"Chantilly",txt:"whipped cream with soft peaks, fluffy piped swirls"},{id:"chocolate",icon:"🍫",name:"Chocolate",txt:"glossy melted chocolate with smooth flowing drips and rich brown sheen"},{id:"frosting",icon:"🧁",name:"Glacê",txt:"piped buttercream frosting with decorative swirls and glossy surface"},{id:"butter",icon:"🧈",name:"Manteiga",txt:"soft butter with smooth creamy surface, pale yellow tones"},{id:"toothpaste",icon:"🦷",name:"Gel/Pasta",txt:"extruded toothpaste-like gel with glossy striped surface"},{id:"clay",icon:"🟫",name:"Massinha",txt:"soft modeling clay with matte malleable surface, finger-shaping marks"}],"Sólidos":[{id:"glass",icon:"🔮",name:"Vidro",txt:"clear glass with refractive transparency, caustic light and sharp highlights"},{id:"ice",icon:"🧊",name:"Gelo",txt:"frozen ice with internal cracks, frosty surface and cold blue translucency"},{id:"plastic",icon:"🔲",name:"Plástico",txt:"glossy molded plastic with smooth surface and vibrant color"},{id:"rubber",icon:"🟡",name:"Borracha",txt:"matte rubber with soft flexible surface"},{id:"concrete",icon:"🧱",name:"Concreto",txt:"raw concrete with rough cement texture, industrial grey tone"},{id:"crystal_gem",icon:"💎",name:"Diamante",txt:"faceted crystal gemstone with sharp cut planes, prismatic refraction"},{id:"sugar",icon:"🍬",name:"Candy",txt:"hard candy sugar glass with vivid translucent color and glossy surface"}],"Temáticos":[{id:"fruit",icon:"🍓",name:"Frutas",txt:"made of fresh juicy fruit (strawberries, citrus, berries) with realistic skin texture and glossy surface"},{id:"cactus",icon:"🌵",name:"Cacto/Planta",txt:"formed from living cactus and succulent plants with spines, green flesh and tiny flowers"},{id:"animal_print",icon:"🐆",name:"Pelagem Animal",txt:"covered in animal-fur texture with realistic markings (leopard spots, tiger stripes or fur)"},{id:"xmas",icon:"🎄",name:"Natal",txt:"decorated for Christmas with pine branches, ornaments, red ribbons, golden bells and snow"},{id:"halloween",icon:"🎃",name:"Halloween",txt:"Halloween-themed with carved pumpkins, cobwebs, bats and spooky orange-purple glow"},{id:"easter",icon:"🐣",name:"Páscoa",txt:"Easter-themed made of decorated chocolate eggs, pastel colors and spring flowers"},{id:"party_balloon",icon:"🎈",name:"Balão Metálico",txt:"shiny metallic foil party balloons (mylar) with reflective surface and inflated puffy volume"},{id:"porcelain",icon:"🏺",name:"Porcelana",txt:"delicate glossy porcelain with smooth glaze, fine painted blue patterns and subtle crackle"},{id:"holo_sticker",icon:"🌈",name:"Holográfico",txt:"holographic iridescent sticker surface with rainbow-shifting reflective foil"},{id:"icecream",icon:"🍦",name:"Sorvete",txt:"made of soft creamy ice cream with melting drips, sprinkles and a glossy frozen surface"},{id:"candy_cane",icon:"🍭",name:"Doces",txt:"made of colorful candy and lollipops with glossy sugar coating and swirl patterns"},{id:"flowers_t",icon:"🌸",name:"Flores",txt:"composed entirely of blooming flowers and petals in vivid colors"},{id:"balloon_latex",icon:"🎉",name:"Bexiga",txt:"made of glossy stretched latex party balloons with knotted ends and bright colors"},{id:"gemstone",icon:"💍",name:"Pedras Preciosas",txt:"encrusted with sparkling gemstones and diamonds with prismatic facets"},{id:"cake",icon:"🎂",name:"Bolo/Confeitaria",txt:"made of decorated cake and frosting with piped buttercream, fondant and edible glitter"},{id:"autumn",icon:"🍂",name:"Outono",txt:"made of autumn leaves in warm red, orange and brown tones with seasonal texture"}],
"Especiais":[{id:"neon",icon:"💡",name:"Neon",txt:"glowing neon tube with self-emitting light, vivid color and halo glow"},{id:"hologram",icon:"🌈",name:"Holograma",txt:"iridescent holographic surface with shifting rainbow reflections"},{id:"galaxy",icon:"🌌",name:"Galáxia",txt:"cosmic galaxy texture with stars, swirling nebula clouds"},{id:"crochet",icon:"🧶",name:"Crochê",txt:"knitted yarn and crochet with visible wool stitches, handmade texture"},{id:"origami",icon:"📄",name:"Origami",txt:"folded paper origami with crisp creases, geometric facets"},{id:"lego",icon:"🧱",name:"Blocos",txt:"interlocking toy building blocks with studs, glossy plastic"},{id:"sand",icon:"🏖️",name:"Areia",txt:"compacted sand with fine granular texture, warm beach tones"}]};
const TXT_TEXTURES=[{id:"honeycomb",icon:"⬡",name:"Colmeia",txt:"hexagonal honeycomb pattern across the surface"},{id:"grid",icon:"🔳",name:"Grade",txt:"geometric grid mesh pattern"},{id:"dots",icon:"⚫",name:"Pontos",txt:"repeating dot/polka pattern"},{id:"scales",icon:"🐍",name:"Escamas",txt:"overlapping reptilian scale texture"},{id:"woven",icon:"🧺",name:"Trançado",txt:"woven basket-weave texture"},{id:"cracks",icon:"🪨",name:"Rachaduras",txt:"craquelure cracked surface pattern"},{id:"bubbles",icon:"🫧",name:"Bolhas",txt:"porous bubble/foam surface texture"},{id:"brushed",icon:"〰️",name:"Escovado",txt:"fine brushed directional line texture"},{id:"carbon",icon:"🏁",name:"Fibra Carbono",txt:"carbon-fiber weave texture"},{id:"stripes",icon:"📏",name:"Listras",txt:"parallel stripe pattern"},{id:"crocodile",icon:"🐊",name:"Couro Croco",txt:"embossed crocodile leather texture"},{id:"quilted",icon:"🛋️",name:"Capitonê",txt:"quilted padded diamond-tufted texture"},{id:"hammered",icon:"🔨",name:"Martelado",txt:"hammered dimpled metal texture"},{id:"wood_grain",icon:"🪵",name:"Veio Madeira",txt:"natural wood grain texture"},{id:"marble_vein",icon:"🏛️",name:"Veio Mármore",txt:"marble veining texture"},{id:"none",icon:"⚪",name:"Sem textura",txt:""}];
const TXT_PARTICLES=[{id:"sparkles",icon:"✨",name:"Brilhos",txt:"floating sparkles and glitter particles catching light"},{id:"dust",icon:"🌫️",name:"Poeira",txt:"suspended dust particles drifting in the light"},{id:"embers",icon:"🔥",name:"Brasas",txt:"glowing floating embers and fire sparks rising"},{id:"snow",icon:"❄️",name:"Neve",txt:"falling snowflakes and frost particles"},{id:"splash",icon:"💦",name:"Respingos",txt:"dynamic liquid splash droplets frozen mid-air"},{id:"petals",icon:"🌸",name:"Pétalas",txt:"falling flower petals drifting through the air"},{id:"confetti",icon:"🎉",name:"Confete",txt:"colorful confetti pieces scattered through the air"},{id:"fireflies",icon:"🪲",name:"Vaga-lumes",txt:"glowing fireflies and floating light points"},{id:"stars",icon:"⭐",name:"Estrelas",txt:"twinkling stars and cosmic light specks"},{id:"electric",icon:"⚡",name:"Faíscas",txt:"crackling electric sparks and energy arcs"},{id:"smoke_heavy",icon:"🌪️",name:"Fumaça densa",txt:"thick volumetric smoke clouds swirling around"},{id:"water_drops",icon:"💧",name:"Gotas",txt:"water droplets and condensation beading on the surface"},{id:"none",icon:"🚫",name:"Sem partículas",txt:""}];
const TXT_BG_CATS=["Superfícies","Cores","Céu/Natureza","Cenas"];
const TXT_BACKGROUNDS={"Superfícies":[{id:"wall",icon:"🧱",name:"Parede",txt:"textured plaster wall background"},{id:"concrete_bg",icon:"🏗️",name:"Cimento",txt:"raw concrete surface background"},{id:"wood_bg",icon:"🪵",name:"Madeira",txt:"natural wood plank background with visible grain"},{id:"fabric_bg",icon:"🧵",name:"Tecido",txt:"woven fabric/linen textured background"},{id:"marble_bg",icon:"🏛️",name:"Mármore",txt:"polished marble background with elegant veining"},{id:"metal_bg",icon:"⚙️",name:"Metal",txt:"brushed metal sheet background"},{id:"brick_wall",icon:"🧱",name:"Tijolo",txt:"exposed red brick wall background"},{id:"velvet",icon:"🟥",name:"Veludo",txt:"rich velvet fabric background with soft folds"}],"Cores":[{id:"solid_white",icon:"⬜",name:"Branco",txt:"clean solid white seamless background"},{id:"solid_black",icon:"⬛",name:"Preto",txt:"deep solid black background"},{id:"gradient",icon:"🌅",name:"Degradê",txt:"smooth color gradient background"},{id:"pastel",icon:"🩰",name:"Pastel",txt:"soft pastel color background"},{id:"vibrant",icon:"🟣",name:"Vibrante",txt:"bold vibrant saturated color background"},{id:"duotone",icon:"🎨",name:"Duotone",txt:"two-tone duotone color background"},{id:"neon_grad",icon:"🌈",name:"Degradê Neon",txt:"vibrant neon gradient background"}],"Céu/Natureza":[{id:"blue_sky",icon:"☀️",name:"Céu Azul",txt:"clear blue sky background with soft white clouds"},{id:"sunset_sky",icon:"🌇",name:"Pôr do Sol",txt:"dramatic sunset sky background with orange and pink hues"},{id:"night_sky",icon:"🌙",name:"Noturno",txt:"night sky background with stars and moon"},{id:"galaxy_sky",icon:"🌌",name:"Galáctico",txt:"cosmic galaxy sky background with milky way and nebula"},{id:"aurora",icon:"🌠",name:"Aurora",txt:"night sky with glowing aurora borealis"},{id:"forest_nat",icon:"🌲",name:"Floresta",txt:"lush green forest background with soft bokeh"},{id:"ocean_nat",icon:"🌊",name:"Mar",txt:"ocean background with water and horizon"},{id:"mountains_nat",icon:"⛰️",name:"Montanhas",txt:"majestic mountain landscape background"}],"Cenas":[{id:"studio",icon:"📸",name:"Estúdio",txt:"professional studio backdrop with soft gradient falloff"},{id:"city",icon:"🌃",name:"Cidade",txt:"city night background with bokeh lights"},{id:"space_bg",icon:"🌌",name:"Espaço",txt:"deep space cosmic background with stars and nebula"},{id:"underwater",icon:"🌊",name:"Subaquático",txt:"underwater background with filtered caustic light"},{id:"desert",icon:"🏜️",name:"Deserto",txt:"desert background with sand dunes"},{id:"cyberpunk_bg",icon:"🌃",name:"Cyberpunk",txt:"cyberpunk city background with neon lights"},{id:"interior",icon:"🏠",name:"Interior",txt:"cozy interior room background"}]};
const TXT_LIGHTING=[{id:"studio_soft",icon:"💡",name:"Estúdio Suave",txt:"soft diffused studio lighting with even illumination"},{id:"dramatic",icon:"🎬",name:"Dramática",txt:"dramatic high-contrast lighting with deep shadows"},{id:"rim",icon:"🌗",name:"Contraluz",txt:"rim/backlight illuminating the edges of the letters"},{id:"neon_glow",icon:"🟣",name:"Neon Glow",txt:"colorful neon glow lighting with luminous color spill"},{id:"golden_hour",icon:"🌅",name:"Golden Hour",txt:"warm golden-hour lighting"},{id:"cinematic",icon:"🎥",name:"Cinematográfica",txt:"cinematic volumetric lighting with atmospheric depth"},{id:"colorful_dual",icon:"🔵",name:"Dupla Cor",txt:"dual-color split lighting (blue and magenta)"},{id:"spotlight",icon:"🔦",name:"Holofote",txt:"single dramatic spotlight focused on the subject"},{id:"window_light",icon:"🪟",name:"Janela",txt:"soft natural window light from the side"},{id:"hard_sun",icon:"🌞",name:"Sol Forte",txt:"harsh direct sunlight with hard sharp shadows"},{id:"led_studio",icon:"📸",name:"3 Pontos",txt:"professional three-point studio lighting setup"},{id:"god_rays",icon:"⛅",name:"Raios de Luz",txt:"dramatic god rays / volumetric light beams"}];
const TXT_REALISM=[{id:"photoreal",icon:"📷",name:"Fotorrealista",txt:"hyper-realistic photorealistic render, physically-based materials",dim:"3d"},{id:"render3d",icon:"🧊",name:"Render 3D",txt:"premium 3D render quality (Octane/Cinema 4D), polished materials",dim:"3d"},{id:"cartoon3d",icon:"🎈",name:"Cartoon 3D",txt:"stylized 3D cartoon render (Pixar-style), smooth appealing forms",dim:"3d"},{id:"claymation_r",icon:"🟤",name:"Claymation",txt:"claymation stop-motion aesthetic with handmade clay texture",dim:"3d"},{id:"inflatable",icon:"🎀",name:"Inflável 3D",txt:"glossy inflatable 3D render, balloon-like puffed forms",dim:"3d"},{id:"glass3d",icon:"🔮",name:"Vidro 3D",txt:"translucent glass 3D render with refraction and caustics",dim:"3d"},{id:"isometric3d",icon:"📐",name:"Isométrico",txt:"clean isometric 3D render with orthographic projection",dim:"3d"},{id:"lowpoly",icon:"💠",name:"Low Poly",txt:"low-poly 3D render with visible geometric faceted surfaces",dim:"3d"},{id:"voxel",icon:"🧱",name:"Voxel",txt:"voxel 3D render built from cubic blocks",dim:"3d"},{id:"flat_illust",icon:"🖼️",name:"Flat",txt:"flat vector illustration style, clean graphic shapes",dim:"2d"},{id:"hand_drawn",icon:"✏️",name:"À mão",txt:"hand-drawn illustration with visible pencil/ink strokes",dim:"2d"},{id:"watercolor_r",icon:"🎨",name:"Aquarela",txt:"watercolor painting style with soft color bleeding",dim:"2d"},{id:"comic_r",icon:"💥",name:"Comic",txt:"comic-book cel-shaded style with bold outlines",dim:"2d"},{id:"anime_r",icon:"🌸",name:"Anime",txt:"anime illustration style with vibrant colors",dim:"2d"},{id:"oil_paint",icon:"🖌️",name:"Óleo",txt:"oil painting style with rich impasto brushstrokes",dim:"2d"},{id:"neon_synth",icon:"🌆",name:"Synthwave",txt:"synthwave retrowave aesthetic with neon glow and grid horizon",dim:"2d"}];
const TXT_HARD=["","mole e deformável (soft squishy)","macio (soft)","dureza média (medium firmness)","rígido (rigid hard)","extremamente duro (rock-hard solid)"];
const TXT_HARD_LBL=["Nenhum","Mole","Macio","Médio","Rígido","Duríssimo"];
const TXT_DENS=["","very thin watery liquid that flows and drips freely, splashing easily","thin liquid that flows and drips easily","medium-viscosity liquid with controlled drips","thick viscous liquid like honey, slow heavy drips","solid that holds its shape, barely flowing"];
const TXT_DENS_LBL=["Nenhum","Água","Fino","Médio","Mel","Sólido"];
const TXT_DENS_NOTE=["","💧 Escorre muito","💧 Escorre fácil","💧 Escorre devagar","🍯 Mal escorre","🧊 Não escorre"];
const TXT_GLOSS=["","completely matte non-reflective finish","soft satin low-gloss finish","semi-gloss balanced reflectance","high-gloss shiny reflective surface","mirror-like fully reflective finish"];
const TXT_GLOSS_LBL=["Nenhum","Fosco","Suave","Semi-brilho","Brilhante","Espelhado"];

// ---------- DADOS: EMOJI ----------
const EMO_MAT_CATS=[["macios","Macios"],["rigidos","Rígidos"],["naturais","Naturais"],["especiais","Especiais"],["humanos","Humanos"]];
const EMO_MATERIALS={macios:[{id:"plush",icon:"🧸",name:"Pelúcia",desc:"Pelo denso, costura",surface:"ultra-soft plush toy material with dense fur fibers, visible stitching seams, soft polyfill",lighting:"warm diffused studio lighting revealing fur depth",detail:"individual fiber strands, blanket stitch seams, hangtag detail"},{id:"felt",icon:"🟥",name:"Feltro",desc:"Fibra áspera, costura",surface:"handmade felt material with coarse woven fiber texture, hand-stitched outline seams, flat matte surface",lighting:"soft even diffused lighting revealing felt fiber texture",detail:"felt fibers, blanket stitch outlines, imperfect handmade charm"},{id:"fabric",icon:"🧵",name:"Tecido",desc:"Algodão, dobras",surface:"natural woven fabric with visible thread weave pattern, natural creasing and drape",lighting:"diffused natural light revealing weave texture",detail:"thread crossings, frayed edges, natural wrinkle patterns"},{id:"latex",icon:"🫧",name:"Látex",desc:"Elástico, brilhante",surface:"smooth latex rubber surface with high specular gloss, slight translucency, elastic wrinkles",lighting:"hard key light with sharp specular highlights, rim light",detail:"glossy reflections, stretch wrinkles, color depth variation"},{id:"foam",icon:"🟡",name:"Foam",desc:"Esponjoso, matte",surface:"squishy memory foam with pore-level micro-texture, soft matte skin-like finish, compression deformation",lighting:"flat soft diffused lighting, gentle rim light",detail:"pore micro-texture, compression wrinkles, soft rounded edges"}],rigidos:[{id:"vinyl",icon:"💠",name:"Vinil",desc:"Art toy brilhante",surface:"smooth injection-molded vinyl/PVC surface with specular highlights, matte finish with gloss on details",lighting:"clean product studio lighting with controlled specular highlights",detail:"mold parting lines, painted detail edges, glossy eye inserts"},{id:"resin",icon:"💎",name:"Resina",desc:"Translúcido, bolhas",surface:"clear cast resin with trapped micro air bubbles, colored pigment clouds inside, high-gloss exterior",lighting:"partial backlight revealing internal structure with caustics",detail:"internal color swirls, air inclusions, prismatic edge refraction"},{id:"metal",icon:"⚙️",name:"Metal Diecast",desc:"Liga, esmaltada",surface:"diecast zinc alloy with factory enamel paint over metallic primer, fine engraved panel lines",lighting:"hard directional lighting with sharp metallic specularity",detail:"chipped paint exposing metal, panel lines, rivet details"},{id:"chrome",icon:"🪞",name:"Cromado",desc:"Reflexo espelhado",surface:"mirror-polished chrome finish with perfect environmental reflections, seamless specular surface",lighting:"studio lighting with gradient reflection cards in chrome surface",detail:"mirror reflections, sharp reflection edges, edge rim highlights"},{id:"plastic_matte",icon:"🔲",name:"Plástico Matte",desc:"ABS fosco",surface:"matte ABS plastic with orange-peel micro-texture, uniform diffuse reflectance, molded-in color",lighting:"soft product lighting revealing surface micro-texture",detail:"surface texture pattern, sharp molded edges, snap-fit joint lines"},{id:"ceramic",icon:"🏺",name:"Cerâmica",desc:"Esmalte brilhante",surface:"glazed ceramic with high-gloss glaze showing brushwork beneath, fine craquelure pattern",lighting:"directional studio light with sharp glaze specular reflections",detail:"glaze drips, brushstroke direction, hand-painted imperfection"}],naturais:[{id:"wood",icon:"🪵",name:"Madeira Pintada",desc:"Grão, acrílica",surface:"hand-painted solid wood with visible grain through acrylic paint, sanded smooth curves",lighting:"warm diffused natural lighting showing grain through paint",detail:"brush stroke texture, exposed grain at edges, wood knots"},{id:"wood_natural",icon:"🌿",name:"Madeira Natural",desc:"Polida, verniz",surface:"natural unpainted wood with clear varnish, pronounced grain, warm amber tones, oil sheen",lighting:"warm side lighting maximizing grain depth",detail:"grain direction changes, natural knots, pore texture"},{id:"stone",icon:"🪨",name:"Pedra/Mármore",desc:"Veios naturais",surface:"natural stone or marble with vein patterns, polished surface with subsurface scattering",lighting:"raking light revealing polish and veining depth",detail:"vein structures, crystal inclusions, polished reflections"},{id:"clay",icon:"🟤",name:"Argila Crua",desc:"Terrosa, artesanal",surface:"raw unglazed earthenware clay with grog texture, warm terracotta tones, finger marks, matte finish",lighting:"warm diffused light emphasizing clay texture",detail:"finger impressions, coil building lines, grog particles"},{id:"paper",icon:"📄",name:"Papel",desc:"Dobrável, kraft",surface:"kraft paper or cardboard with fiber texture, natural brown tones, crisp fold lines",lighting:"raking light revealing paper fiber texture and fold depth",detail:"cellulose fibers, fold score lines, raw cut edge fraying"},{id:"wax",icon:"🕯️",name:"Cera",desc:"Translúcido, ondas",surface:"smooth wax surface with subsurface translucency, color gradient, surface flow marks",lighting:"backlight revealing wax translucency, warm candle tones",detail:"cooling ripples, translucent edge glow, drip marks"}],especiais:[{id:"glass",icon:"🔮",name:"Vidro",desc:"Refração, caustics",surface:"optically clear borosilicate glass with specular reflections, caustic light projection, transparency",lighting:"backlit with caustic projections, hard accent lights",detail:"total internal reflection, caustic patterns, air bubble inclusions"},{id:"gold",icon:"✨",name:"Ouro",desc:"Reflexo quente, luxo",surface:"22-karat gold surface with warm yellow metallic reflectance, brushed or polished finish",lighting:"warm directional key light maximizing gold saturation",detail:"warm specularity, brushed direction, hallmark stamps"},{id:"enamel",icon:"🎨",name:"Esmalte",desc:"Cores vibrantes",surface:"vitreous enamel fired into metal cells with saturated colors, thin metal divider lines, glassy finish",lighting:"directional light revealing enamel gloss and translucency",detail:"color cell boundaries, surface undulation, bubble inclusions"},{id:"neon",icon:"💡",name:"Neon LED",desc:"Luz emissiva",surface:"edge-lit acrylic or neon tube with strong self-emission, color glow spilling onto surroundings",lighting:"dark environment with neon self-illumination as primary light",detail:"self-glowing surface, color halo falloff, acrylic edge glow"},{id:"ice",icon:"🧊",name:"Gelo",desc:"Facetas, caustics frios",surface:"clear or blue-tinted ice with internal crack patterns and bubble trails, frost on exterior, facet planes",lighting:"cold blue-white backlight revealing internal structure",detail:"crack and bubble patterns, frost micro-crystals, crystalline edges"},{id:"food_sugar",icon:"🍬",name:"Candy",desc:"Doce, translúcido",surface:"hard candy or sugar glass with bright saturated colors, high gloss, internal color depth",lighting:"bright clean lighting maximizing candy color saturation",detail:"swirl color patterns inside, smooth molded surface, air inclusions"}],humanos:[{id:"skin_realistic",icon:"👤",name:"Pele Realista",desc:"SSS, poros",surface:"photorealistic human skin with subsurface scattering, visible pore detail, micro-wrinkle texture",lighting:"3-point portrait lighting maximizing SSS effect",detail:"pore detail, fine surface hair, specular on nose and cheekbones"},{id:"skin_stylized",icon:"🎭",name:"Pele Estilizada",desc:"Suave, Pixar",surface:"stylized smooth skin with simplified subsurface scattering, no pore detail, enhanced smoothness",lighting:"warm animation-style lighting with soft fill and strong key",detail:"smooth transitions, enhanced eye specularity, clean grooming"},{id:"cartoon_flat",icon:"🎨",name:"Cartoon 2D",desc:"Cel shading",surface:"flat cel-shaded surface with hard shadow transitions, bold outline strokes, pure color fills",lighting:"flat stylized toon-shader lighting with step shadows",detail:"crisp outlines, flat color regions, exaggerated proportions"},{id:"miniature",icon:"🪆",name:"Miniatura",desc:"Plástico, pintado",surface:"injection-molded miniature figurine plastic with factory paint, base included",lighting:"clean product photography lighting for collectible display",detail:"painted details, mold lines, display base, paint-over-plastic"}]};
const EMO_STYLE_CATS=[["3d","3D/CGI"],["brinquedo","Brinquedo"],["pessoa","Pessoa"],["produto","Produto"],["arte","Arte"]];
const EMO_STYLES={"3d":[{id:"pixar3d",label:"Pixar/Disney",desc:"Animação cinematic",shape:"Pixar/Disney 3D render style — smooth stylized surfaces, expressive oversized eyes, rich saturated palette",mood:"warm, expressive, cinematic animation quality",bg:"soft gradient background with ambient occlusion ground shadow",output:"photorealistic CGI animation render, Pixar quality, 8K"},{id:"hyperreal3d",label:"Hiper-realista",desc:"CGI fotorrealista",shape:"hyper-realistic 3D CGI indistinguishable from photography, physically-based rendering",mood:"premium, photographic, commercial product quality",bg:"clean seamless white or gradient background, three-point lighting",output:"photorealistic CGI, PBR rendering, 8K"},{id:"lowpoly",label:"Low Poly",desc:"Faces geométricas",shape:"low-polygon 3D model with visible geometric face planes, faceted surfaces, clean edges",mood:"modern, geometric, minimal",bg:"clean neutral background with soft lighting revealing polygons",output:"3D render, low-poly aesthetic"},{id:"claymation",label:"Claymation",desc:"Massinha, stop motion",shape:"claymation stop-motion aesthetic with fingerprint marks, imperfect handmade form, chunky proportions",mood:"charming, handmade, nostalgic",bg:"simple diorama-style miniature set background",output:"claymation render, stop-motion aesthetic"},{id:"isometric3d",label:"Isométrico",desc:"Game art, sem perspectiva",shape:"perfect isometric 3D projection at 45-degree angle, game-art aesthetic, orthographic",mood:"clean, technical, game-ready",bg:"transparent or clean flat background",output:"isometric 3D render, game asset quality"},{id:"octane3d",label:"Octane/C4D",desc:"Render físico premium",shape:"premium studio CGI render with volumetric lighting, physically accurate material simulation",mood:"premium, technical excellence, award-winning",bg:"volumetric studio environment with HDRI lighting, subtle fog",output:"Octane render, Cinema 4D quality, volumetric, 8K"}],brinquedo:[{id:"chibi",label:"Chibi/Kawaii",desc:"Cabeça enorme, fofo",shape:"chibi toy proportions with oversized spherical head, tiny body, huge shiny eyes, cute features",mood:"extremely cute, wholesome, huggable",bg:"pure white seamless background with soft ground shadow",output:"hyper-realistic 3D render of a physical toy, 8K"},{id:"artToy",label:"Designer Art Toy",desc:"KAWS, Bearbrick",shape:"designer art toy inspired by KAWS/Bearbrick — geometric form, graphic face elements, collectible vinyl",mood:"cool, collectible, design-forward, gallery-worthy",bg:"minimal gradient or white background with drop shadow",output:"photorealistic product render, collectible art toy, 8K"},{id:"classic_toy",label:"Clássico",desc:"Nostálgico, pintado",shape:"classic vintage toy design with rounded friendly forms, simple painted details, timeless proportions",mood:"nostalgic, friendly, universally appealing",bg:"warm soft white background with gentle shadow",output:"photorealistic product render, classic toy photography, 8K"},{id:"horror_toy",label:"Creepy Cute",desc:"Estranho, uncanny",shape:"unsettling distorted toy proportions, cracked worn surface, haunted aesthetic, hollow dark eyes",mood:"eerie, dark, creepy cute, uncanny valley",bg:"dark vignetted background, dramatic side lighting",output:"photorealistic 3D render, horror collector toy, cinematic, 8K"},{id:"funko_style",label:"Funko Pop",desc:"Cabeça bobble, vinil",shape:"Funko Pop vinyl proportions — oversized round head, tiny body, large black oval eyes, minimal features",mood:"collectible, fan culture",bg:"clean white or color-matched gradient background",output:"photorealistic vinyl figure render, 8K"}],pessoa:[{id:"portrait_real",label:"Retrato Real",desc:"Foto DSLR",shape:"photorealistic portrait, natural human proportions, detailed skin texture, authentic expression",mood:"authentic, human, natural, editorial",bg:"natural background, professional portrait lighting",output:"photorealistic portrait, 50mm lens, natural lighting, 8K"},{id:"portrait_cinematic",label:"Cinemático",desc:"Filme, anamórfico",shape:"cinematic film portrait with anamorphic lens, lens flare, dramatic color grading",mood:"dramatic, cinematic, film-quality",bg:"cinematic background with environmental context, anamorphic bokeh",output:"cinematic film quality, anamorphic lens, color graded"},{id:"cartoon_char",label:"Cartoon 3D",desc:"Animação moderna",shape:"modern CG character with stylized proportions, expressive eyes, smooth skin, bold color design",mood:"expressive, animated, fun",bg:"simple color-appropriate background",output:"CG animation character render, Disney/Pixar style, 8K"},{id:"anime_style",label:"Anime",desc:"Olhos grandes, 2.5D",shape:"anime/manga style with large expressive eyes, detailed hair strands, cel-shading influence",mood:"expressive, dramatic, anime aesthetic",bg:"atmospheric anime background with bokeh",output:"anime-style 3D render, 2.5D, illustration quality"},{id:"miniature_fig",label:"Miniatura RPG",desc:"28mm pintado",shape:"28mm tabletop miniature with extreme detail for scale, hand-painted acrylic, dramatic highlighting",mood:"detailed, hobby craft, collector quality",bg:"neutral display background or diorama base",output:"macro photograph of painted miniature, 8K"},{id:"sculpture",label:"Escultura",desc:"Mármore, bronze",shape:"classical sculpture aesthetic in chosen material, idealized proportions, monumental quality",mood:"classical, timeless, gallery quality",bg:"museum-style neutral background with sculptural lighting",output:"museum-quality sculpture photograph, directional lighting, 8K"}],produto:[{id:"product_clean",label:"E-commerce",desc:"Fundo branco",shape:"clean product composition, three-quarter angle, floating with soft drop shadow, hero shot",mood:"clean, trustworthy, commercial",bg:"pure white seamless background with soft drop shadow",output:"commercial product photography, e-commerce standard, 8K"},{id:"product_luxury",label:"Produto Luxo",desc:"Reflexos, premium",shape:"luxury product editorial with reflective surface, dramatic lighting, magazine quality",mood:"premium, aspirational, luxury brand",bg:"dark dramatic background or premium surface with reflection",output:"luxury editorial product photography, magazine quality, 8K"},{id:"food_photo",label:"Food Photo",desc:"Apetitoso, styling",shape:"professional food photography, appetizing hero angle showing texture, food styling with props",mood:"appetizing, fresh, artisan",bg:"styled table surface or rustic background with props",output:"professional food photography, magazine recipe quality, 8K"},{id:"food_hyper",label:"Comida CGI",desc:"Hiper-realista",shape:"hyper-realistic CGI food render indistinguishable from photography, accurate food materials",mood:"perfect, idealized food",bg:"clean product background with food styling context",output:"hyper-realistic CGI food render, PBR, 8K"},{id:"miniature_scene",label:"Miniatura",desc:"Tilt-shift, diorama",shape:"forced-perspective miniature scene, tilt-shift with selective focus, diorama quality",mood:"charming, cinematic, playful scale",bg:"miniature diorama environment",output:"tilt-shift miniature photography, selective focus, 8K"}],arte:[{id:"concept_art",label:"Concept Art",desc:"Pintura digital",shape:"professional concept art, painterly digital illustration, strong value composition, cinematic framing",mood:"epic, narrative, film-concept quality",bg:"fully rendered environmental context background",output:"concept art, digital painting quality, cinematic"},{id:"watercolor",label:"Aquarela",desc:"Bordas suaves",shape:"watercolor illustration with wet-on-wet color bleeding, soft edges, visible paper texture",mood:"soft, artistic, handmade, book illustration",bg:"textured watercolor paper background with color washes",output:"high-quality watercolor illustration, book-publishing standard"},{id:"pixel_art",label:"Pixel Art",desc:"16-bit retrô",shape:"precise pixel art with visible pixel grid, limited palette, retro game sprite aesthetic",mood:"nostalgic, gaming, retro charm",bg:"simple pixel art or black game-screen background",output:"pixel art, clean pixel grid, game sprite quality"},{id:"sticker",label:"Sticker",desc:"Borda branca, kawaii",shape:"sticker design with thick white outline, high contrast colors, flat graphic, die-cut appearance",mood:"cute, graphic, collectible",bg:"transparent or white background showing die-cut shape",output:"sticker graphic design, vector-like precision, print-ready"},{id:"nft_art",label:"NFT/Generative",desc:"Arte generativa",shape:"generative digital art with algorithmic patterns, bold color combinations, abstract treatment",mood:"collectible, digital-native, algorithmic",bg:"dark or high-contrast background",output:"generative digital art, high-contrast, collectible presentation"}]};

// ---------- DADOS: VÍDEO ----------
const VID_SUBJECTS=[{id:"man",icon:"👨",name:"Homem",desc:"Pessoa masculina"},{id:"woman",icon:"👩",name:"Mulher",desc:"Pessoa feminina"},{id:"child",icon:"🧒",name:"Criança",desc:"Menino ou menina"},{id:"couple",icon:"👫",name:"Casal/Grupo",desc:"Duas+ pessoas"},{id:"animal",icon:"🐾",name:"Animal",desc:"Pet ou selvagem"},{id:"product",icon:"📦",name:"Produto",desc:"Objeto comercial"},{id:"scene",icon:"🏞️",name:"Só Cenário",desc:"Sem sujeito"}];
const VID_SUBJECT_FIELDS={
 person:[{id:"age",label:"Idade",ph:"jovem ~25, idoso...",en:v=>v,pt:v=>v},{id:"ethnicity",label:"Etnia/pele",ph:"negra, asiático...",en:v=>v,pt:v=>v},{id:"hair",label:"Cabelo",ph:"cacheado preto, loiro liso...",en:v=>"with "+v+" hair",pt:v=>"com cabelo "+v},{id:"eyes",label:"Olhos",ph:"castanhos, azuis...",en:v=>"with "+v+" eyes",pt:v=>"com olhos "+v},{id:"clothing",label:"Roupa",ph:"vestido vermelho, terno...",en:v=>"wearing "+v,pt:v=>"vestindo "+v},{id:"extra",label:"Outros",ph:"óculos, barba...",en:v=>v,pt:v=>v}],
 animal:[{id:"species",label:"Espécie/raça",ph:"gato persa, leão...",en:v=>v,pt:v=>v},{id:"color",label:"Cor/pelagem",ph:"pelo laranja...",en:v=>"with "+v,pt:v=>"com "+v},{id:"extra",label:"Outros",ph:"filhote, coleira...",en:v=>v,pt:v=>v}],
 product:[{id:"what",label:"O que é",ph:"tênis, perfume...",en:v=>v,pt:v=>v},{id:"material",label:"Material",ph:"couro, vidro fosco...",en:v=>"made of "+v,pt:v=>"feito de "+v},{id:"color",label:"Cor",ph:"vermelho metálico...",en:v=>"in "+v,pt:v=>"na cor "+v},{id:"extra",label:"Outros",ph:"logo visível...",en:v=>v,pt:v=>v}],
 scene:[{id:"desc",label:"Descrição do que aparece",ph:"floresta densa, cidade futurista...",en:v=>v,pt:v=>v}]
};
const VID_LOC_CATS=["Interno","Externo","Estúdio","Estilizado","Céu/Água"];
const VID_LOCATIONS={"Interno":[{id:"home",icon:"🏠",name:"Casa",en:"cozy home interior",pt:"interior aconchegante de uma casa"},{id:"cafe",icon:"☕",name:"Café",en:"warm coffee shop interior",pt:"interior de uma cafeteria"},{id:"office",icon:"💼",name:"Escritório",en:"modern office interior",pt:"escritório moderno"},{id:"loft",icon:"🏢",name:"Loft",en:"industrial loft with exposed brick",pt:"loft industrial com tijolos aparentes"},{id:"kitchen",icon:"🍳",name:"Cozinha",en:"bright modern kitchen",pt:"cozinha moderna e iluminada"},{id:"bar",icon:"🍸",name:"Bar/Boate",en:"moody bar or nightclub interior",pt:"interior de bar ou boate com clima"},{id:"warehouse",icon:"📦",name:"Galpão",en:"large empty warehouse interior",pt:"galpão amplo e vazio"},{id:"church",icon:"⛪",name:"Igreja/Templo",en:"grand church interior with tall windows",pt:"interior amplo de igreja com janelas altas"}],"Externo":[{id:"street",icon:"🌆",name:"Rua/Cidade",en:"urban city street",pt:"rua de uma cidade"},{id:"nature",icon:"🌲",name:"Natureza",en:"lush natural landscape",pt:"paisagem natural exuberante"},{id:"beach",icon:"🏖️",name:"Praia",en:"sunny beach by the ocean",pt:"praia ensolarada à beira-mar"},{id:"mountain",icon:"⛰️",name:"Montanha",en:"dramatic mountain landscape",pt:"paisagem montanhosa"},{id:"rooftop",icon:"🌃",name:"Rooftop/Noite",en:"city rooftop at night with bokeh lights",pt:"rooftop à noite com luzes em bokeh"},{id:"forest",icon:"🌳",name:"Floresta",en:"misty forest with filtered light",pt:"floresta enevoada"},{id:"desert",icon:"🏜️",name:"Deserto",en:"vast desert with dunes",pt:"deserto vasto com dunas"},{id:"field",icon:"🌾",name:"Campo",en:"open field with tall grass",pt:"campo aberto com grama alta"},{id:"snow",icon:"🏔️",name:"Neve",en:"snowy winter landscape",pt:"paisagem nevada de inverno"},{id:"ruins",icon:"🏛️",name:"Ruínas",en:"ancient stone ruins",pt:"ruínas antigas de pedra"},{id:"alley",icon:"🌃",name:"Beco",en:"narrow urban alley with neon signs",pt:"beco urbano estreito com letreiros de neon"}],"Estúdio":[{id:"white",icon:"⬜",name:"Fundo Branco",en:"clean white studio background",pt:"fundo de estúdio branco limpo"},{id:"black",icon:"⬛",name:"Fundo Preto",en:"dramatic black studio background",pt:"fundo de estúdio preto"},{id:"gradient_bg",icon:"🌅",name:"Degradê",en:"smooth gradient studio backdrop",pt:"fundo de estúdio em degradê"},{id:"colorbg",icon:"🎨",name:"Cor Sólida",en:"solid colored studio backdrop",pt:"fundo de estúdio de cor sólida"},{id:"cyclorama",icon:"🎬",name:"Ciclorama",en:"seamless cyclorama studio with soft curve",pt:"estúdio ciclorama com curva suave"}],"Estilizado":[{id:"cyberpunk",icon:"🌃",name:"Cyberpunk",en:"neon-lit cyberpunk city",pt:"cidade cyberpunk com neon"},{id:"fantasy",icon:"🏰",name:"Fantasia",en:"epic fantasy environment",pt:"ambiente épico de fantasia"},{id:"surreal",icon:"🌀",name:"Surreal",en:"surreal dreamlike environment",pt:"ambiente surreal e onírico"},{id:"space",icon:"🌌",name:"Espaço",en:"outer space cosmic environment",pt:"ambiente cósmico do espaço"},{id:"postapoc",icon:"☢️",name:"Pós-apocalíptico",en:"post-apocalyptic wasteland",pt:"terra devastada pós-apocalíptica"},{id:"retrowave",icon:"🌆",name:"Synthwave 80s",en:"retro synthwave neon-grid environment",pt:"ambiente synthwave retrô com grade de neon"},{id:"noir",icon:"🕵️",name:"Film Noir",en:"black-and-white film noir setting with venetian blind shadows",pt:"cenário film noir em P&B com sombras de persiana"}],"Céu/Água":[{id:"sky",icon:"☀️",name:"Céu Aberto",en:"open blue sky with clouds",pt:"céu azul aberto com nuvens"},{id:"sunset",icon:"🌇",name:"Pôr do Sol",en:"dramatic sunset sky",pt:"céu de pôr do sol dramático"},{id:"night_sky",icon:"🌙",name:"Céu Noturno",en:"starry night sky",pt:"céu noturno estrelado"},{id:"storm",icon:"⛈️",name:"Tempestade",en:"stormy sky with dark clouds and lightning",pt:"céu de tempestade com relâmpagos"},{id:"underwater",icon:"🌊",name:"Subaquático",en:"underwater scene with caustic light",pt:"cena subaquática com luz de caustics"},{id:"ocean",icon:"🌊",name:"Mar Aberto",en:"open ocean with waves",pt:"mar aberto com ondas"},{id:"clouds",icon:"☁️",name:"Mar de Nuvens",en:"above a sea of clouds",pt:"acima de um mar de nuvens"},{id:"aurora",icon:"🌠",name:"Aurora Boreal",en:"night sky with glowing aurora borealis",pt:"céu noturno com aurora boreal"}]};
const VID_CAM_CATS=["Dolly/Zoom","Pan/Tilt","Orbit/Arco","Grua/Vertical","Drone","Tracking","Especiais"];
const VID_CAM_MOVES={"Dolly/Zoom":[{id:"sdollyin",name:"Slow Dolly In",desc:"Avança devagar",txt:"Slow dolly in, camera moves slowly forward toward the subject"},{id:"sdollyout",name:"Slow Dolly Out",desc:"Recua devagar",txt:"Slow dolly out, camera moves slowly backwards away from the subject"},{id:"fdollyin",name:"Fast Dolly In",desc:"Avança rápido",txt:"Fast dolly in, camera moves rapidly forward toward the subject, urgent motion"},{id:"zolly",name:"Vertigo (Zolly)",desc:"Dolly zoom, vertigem",txt:"Vertigo effect, dolly zoom, camera moves backward while zooming in, background expands"},{id:"macrozoom",name:"Extreme Macro Zoom",desc:"Até micro detalhes",txt:"Extreme macro zoom, zoom transition from subject to micro details of surface"},{id:"cosmiczoom",name:"Cosmic Hyper Zoom",desc:"Do amplo ao macro",txt:"Cosmic hyper zoom, fast zoom transition from extreme wide view down to macro level"},{id:"optzoomin",name:"Optical Zoom In",desc:"Lente amplia",txt:"Smooth optical zoom in, lens magnifies subject, camera stays stationary"},{id:"optzoomout",name:"Optical Zoom Out",desc:"Lente abre",txt:"Smooth optical zoom out, lens widens, background becomes blurry"},{id:"snapzoom",name:"Snap/Crash Zoom",desc:"Zoom violento",txt:"Snap zoom, crash zoom, rapid zoom directly into the subject"}],"Pan/Tilt":[{id:"tiltup",name:"Tilt Up",desc:"Inclina pra cima",txt:"Tilt up, camera pans vertically up from bottom to top"},{id:"tiltdown",name:"Tilt Down",desc:"Inclina pra baixo",txt:"Tilt down, camera pans vertically down from top to bottom"},{id:"truckleft",name:"Truck Left",desc:"Desliza p/ esquerda",txt:"Truck left, camera moves sideways on a track to the left"},{id:"truckright",name:"Truck Right",desc:"Desliza p/ direita",txt:"Truck right, camera moves sideways on a track to the right"},{id:"whippan",name:"Whip Pan",desc:"Giro violento",txt:"Whip pan, camera whips violently to the side with extreme directional motion blur"}],"Orbit/Arco":[{id:"orbit180",name:"Orbit 180",desc:"Meia volta",txt:"Orbit 180, camera moves in a half-circle around the subject"},{id:"orbit360",name:"Fast 360 Orbit",desc:"Giro completo rápido",txt:"Fast 360 orbit, camera spins rapidly 360 degrees around the subject"},{id:"arc",name:"Slow Cinematic Arc",desc:"Curva ampla, revela perfil",txt:"Slow cinematic arc, camera moves in a wide curve to reveal side profile"}],"Grua/Vertical":[{id:"pedup",name:"Pedestal Up",desc:"Sobe na vertical",txt:"Pedestal up, camera rises vertically straight up from waist to eye level"},{id:"peddown",name:"Pedestal Down",desc:"Desce na vertical",txt:"Pedestal down, camera lowers vertically straight down"},{id:"craneup",name:"Crane Up",desc:"Grua sobe, revela",txt:"Crane up, camera lifts high into the air"},{id:"cranedown",name:"Crane Down",desc:"Grua desce até o sujeito",txt:"Crane down, camera descends slowly to the subject"}],"Drone":[{id:"flyover",name:"Drone Fly Over",desc:"Sobrevoo de altura",txt:"Drone fly over, high altitude flight moving forward over the landscape"},{id:"dronereveal",name:"Epic Drone Reveal",desc:"Sobe e inclina, revela",txt:"Epic drone reveal, rising and tilting down to reveal the scene"},{id:"droneorbit",name:"Drone Orbit",desc:"Círculo amplo de drone",txt:"Large scale drone orbit, massive sweeping circle around the landscape"},{id:"fpvdive",name:"FPV Drone Dive",desc:"Mergulho agressivo",txt:"FPV drone dive, aggressive diving motion down a vertical structure"},{id:"topdown",name:"Top Down (God's Eye)",desc:"Direto de cima, giro",txt:"Top down shot, camera pointing straight down, slow twist"}],"Tracking":[{id:"ots",name:"Over the Shoulder",desc:"Por cima do ombro",txt:"Over the shoulder shot, camera mounted behind subject A framing subject B"},{id:"leading",name:"Leading Shot",desc:"Recua acompanhando",txt:"Leading shot, camera moves backward matching the subject's speed"},{id:"following",name:"Following Shot",desc:"Segue por trás",txt:"Following shot, camera follows behind the subject matching speed"},{id:"sidetrack",name:"Side Tracking",desc:"Paralelo ao sujeito",txt:"Side tracking, camera trucks alongside the subject"},{id:"povwalk",name:"POV Walk",desc:"1ª pessoa caminhando",txt:"POV walk, first person camera moving forward with bobbing motion"},{id:"handheld",name:"Handheld",desc:"Tremido, documentário",txt:"Handheld camera, shaky motion, natural movement, documentary style"}],"Especiais":[{id:"fisheye",name:"Fisheye",desc:"Olho de peixe",txt:"Fisheye lens, extreme wide-angle distortion, circular frame"},{id:"reveal",name:"Reveal from Behind",desc:"Revela por trás de objeto",txt:"Wipe movement, camera slides laterally from behind foreground object to reveal the scene"},{id:"blurreveal",name:"Reveal from Blur",desc:"Foco surge do desfoque",txt:"Rack focus, start completely out of focus, slowly pull focus until sharp"},{id:"rackfocus",name:"Rack Focus",desc:"Muda foco frente/fundo",txt:"Rack focus, focus shifts from the foreground object to the background subject"},{id:"dutch",name:"Dutch Angle Roll",desc:"Inclinada no eixo Z",txt:"Dutch angle, camera roll, tilted sideways on Z-axis"},{id:"hyperlapse",name:"Hyperlapse",desc:"Time-lapse em movimento",txt:"Hyperlapse, camera moves forward rapidly, time accelerated, fast motion, light trails"},{id:"bullettime",name:"Bullet Time",desc:"Momento congelado",txt:"Bullet time, frozen moment, ultra slow motion, camera orbit right"}]};
const VID_LIGHTING=[{id:"natural",icon:"☀️",name:"Natural",desc:"Luz do dia",en:"natural daylight",pt:"luz natural do dia"},{id:"golden",icon:"🌅",name:"Golden Hour",desc:"Quente, fim de tarde",en:"warm golden-hour light",pt:"luz quente de golden hour"},{id:"blue_hour",icon:"🌌",name:"Blue Hour",desc:"Azulada, crepúsculo",en:"cool blue-hour twilight light",pt:"luz fria de blue hour"},{id:"dramatic",icon:"🎬",name:"Dramática",desc:"Alto contraste",en:"dramatic high-contrast lighting",pt:"luz dramática de alto contraste"},{id:"neon",icon:"🟣",name:"Neon",desc:"Colorida, noturna",en:"colorful neon lighting",pt:"iluminação colorida de neon"},{id:"cinematic",icon:"🎥",name:"Cinematográfica",desc:"Volumétrica",en:"cinematic volumetric lighting",pt:"iluminação cinematográfica volumétrica"},{id:"soft",icon:"💡",name:"Suave",desc:"Difusa",en:"soft diffused lighting",pt:"luz suave e difusa"},{id:"lowkey",icon:"🌑",name:"Low Key",desc:"Escura, sombria",en:"moody low-key lighting",pt:"iluminação low-key sombria"},{id:"highkey",icon:"⚪",name:"High Key",desc:"Clara, sem sombra",en:"bright airy high-key lighting",pt:"iluminação high-key clara"},{id:"godrays",icon:"⛅",name:"God Rays",desc:"Raios volumétricos",en:"volumetric god rays",pt:"raios de luz volumétricos"},{id:"rim",icon:"🌗",name:"Contraluz",desc:"Borda iluminada",en:"backlit rim lighting separating subject from background",pt:"luz de recorte (contraluz)"},{id:"window",icon:"🪟",name:"Luz de Janela",desc:"Natural lateral",en:"soft natural window light from the side",pt:"luz natural suave de janela"},{id:"hardsun",icon:"🌞",name:"Sol Forte",desc:"Direto, sombras duras",en:"harsh direct sunlight with hard shadows",pt:"luz solar forte com sombras duras"},{id:"candle",icon:"🕯️",name:"Luz de Vela",desc:"Quente, intimista",en:"warm intimate candle-light glow",pt:"luz quente de vela"},{id:"split",icon:"🔵",name:"Dupla Cor",desc:"Azul + magenta",en:"dual-color split lighting (blue and magenta)",pt:"iluminação dupla (azul e magenta)"},{id:"firelight",icon:"🔥",name:"Luz de Fogo",desc:"Tremeluzente",en:"flickering warm firelight",pt:"luz de fogo tremeluzente"},{id:"moonlight",icon:"🌙",name:"Luar",desc:"Azul frio noturno",en:"cool blue moonlight",pt:"luar azul frio"}];
const VID_STYLES=[{id:"photoreal",icon:"📷",name:"Realista",desc:"Foto/vídeo real",en:"photorealistic, ultra-detailed",pt:"fotorrealista, ultra-detalhado"},{id:"cinematic",icon:"🎥",name:"Cinematográfico",desc:"Cinema, color grade",en:"cinematic film look, color graded, anamorphic",pt:"visual cinematográfico, com correção de cor, anamórfico"},{id:"docu",icon:"📹",name:"Documentário",desc:"Cru, natural",en:"raw documentary style, natural and unpolished",pt:"estilo documentário cru e natural"},{id:"3d",icon:"🧊",name:"3D/CGI",desc:"Render 3D",en:"hyper-realistic 3D CGI render",pt:"render 3D CGI hiper-realista"},{id:"pixar",icon:"🎈",name:"3D Cartoon",desc:"Pixar style",en:"stylized 3D cartoon animation, Pixar-style",pt:"animação 3D cartoon estilo Pixar"},{id:"claymation",icon:"🟤",name:"Claymation",desc:"Massinha, stop-motion",en:"claymation stop-motion style with clay texture",pt:"claymation stop-motion com massinha"},{id:"anime",icon:"🌸",name:"Anime",desc:"Animação japonesa",en:"anime animation style",pt:"estilo de animação anime"},{id:"2danim",icon:"✏️",name:"Animação 2D",desc:"Cartoon desenhado",en:"hand-drawn 2D cartoon animation style",pt:"animação 2D desenhada à mão"},{id:"film",icon:"🎞️",name:"Filme Analógico",desc:"35mm, grão",en:"35mm film look with natural grain",pt:"filme 35mm com grão natural"},{id:"super8",icon:"📽️",name:"Super 8",desc:"Caseiro retrô",en:"vintage Super 8 home-movie look with heavy grain",pt:"filme caseiro Super 8 com grão pesado"},{id:"vhs",icon:"📼",name:"VHS/Anos 90",desc:"Fita, ruído",en:"retro VHS tape look with noise and scanlines",pt:"fita VHS retrô com ruído e scanlines"},{id:"bw",icon:"🎬",name:"Preto & Branco",desc:"Monocromático",en:"black and white monochrome",pt:"preto e branco monocromático"},{id:"noir",icon:"🕵️",name:"Film Noir",desc:"P&B dramático",en:"film noir style, high-contrast black and white with deep shadows",pt:"film noir P&B de alto contraste"},{id:"hyperreal",icon:"💎",name:"Hiper-realista",desc:"Detalhe extremo",en:"hyper-detailed premium commercial look, flawless",pt:"visual comercial premium hiper-detalhado"},{id:"dreamy",icon:"✨",name:"Onírico",desc:"Suave, etéreo",en:"dreamy ethereal soft-glow look",pt:"visual onírico e etéreo"}];
const VID_AUDIO=[{id:"ambience",icon:"🌫️",name:"Ambiência",desc:"Som do ambiente",ph:"vento suave, ondas, cidade...",en:"Ambience: ",pt:"Ambiência: "},{id:"sfx",icon:"💥",name:"Efeitos",desc:"SFX pontuais",ph:"passos, porta, vidro...",en:"Sound effects: ",pt:"Efeitos sonoros: "},{id:"music",icon:"🎵",name:"Música",desc:"Trilha sonora",ph:"piano emotivo, épica...",en:"Music: ",pt:"Música: "},{id:"dialogue",icon:"💬",name:"Diálogo/Voz",desc:"Fala, narração",ph:"a mulher diz '...', narração grave...",en:"Dialogue: ",pt:"Diálogo: "},{id:"silence",icon:"🔇",name:"Silêncio",desc:"Sem áudio",ph:"",en:"No audio, complete silence",pt:"Sem áudio, silêncio completo"}];
const VID_CAM_SHOT=[["","— sem preferência —"],["extreme close-up macro shot","Extreme close-up (macro)"],["close-up shot","Close-up"],["headshot framing","Headshot (rosto)"],["bust shot (head and shoulders)","Busto"],["medium shot (waist up)","Plano médio (cintura)"],["cowboy shot (mid-thigh up)","Plano americano"],["full body shot","Corpo inteiro"],["wide establishing shot","Plano aberto/geral"],["extreme wide shot, subject small in frame","Plano muito aberto"],["aerial shot","Aéreo"],["high-angle shot looking down","Plongée"],["low-angle hero shot","Contra-plongée"],["eye-level shot","Altura dos olhos"],["over-the-shoulder shot","Por cima do ombro"],["profile side view","Perfil"],["three-quarter view","Três-quartos"]];
const VID_CAM_LENS=[["","— sem preferência —"],["8mm fisheye lens","8mm fisheye"],["14mm ultra-wide lens","14mm ultra-wide"],["24mm wide lens","24mm wide"],["35mm lens","35mm"],["50mm lens","50mm natural"],["85mm portrait lens","85mm retrato"],["135mm telephoto lens","135mm tele"],["200mm telephoto lens","200mm tele"],["100mm macro lens","100mm macro"],["anamorphic cinema lens","Anamórfica"]];
const VID_CAM_APER=[["","— sem preferência —"],["shot at f/1.2 with extremely shallow depth of field and creamy bokeh","f/1.2 extremo desfocado"],["shot at f/1.4 with very shallow depth of field and creamy bokeh","f/1.4 muito desfocado"],["shot at f/1.8 with shallow depth of field and soft bokeh","f/1.8 desfocado"],["shot at f/2.8 with shallow depth of field","f/2.8 leve"],["shot at f/5.6 with moderate depth of field","f/5.6 médio"],["shot at f/8 with good depth of field","f/8 boa nitidez"],["shot at f/11 with deep focus, everything sharp","f/11 tudo nítido"]];
const VID_DURATION=[["","— sem preferência —"],["3 seconds","3 segundos"],["5 seconds","5 segundos"],["8 seconds","8 segundos"],["10 seconds","10 segundos"]];
const VID_ASPECT=[["","— sem preferência —"],["16:9","16:9 horizontal"],["9:16","9:16 vertical/Reels"],["1:1","1:1 quadrado"],["21:9","21:9 cinema"],["4:5","4:5 feed"]];

// ---------- VÍDEO: estado + render + build ----------
function renderVidControls(){
 const s=GS.vid;let h='';
 let n=0;const N=()=>String(++n); // numeração segue as seções que aparecem
 // sub-modo texto→vídeo ou imagem→vídeo
 h+=`<div class="gen-sec"><div class="gen-sec-t">Modo</div>
   <div class="gcat-row">
     <button type="button" class="gcat ${s.submode==='text'?'active':''}" onclick="vidSetSub('text')">📝 Texto → Vídeo</button>
     <button type="button" class="gcat ${s.submode==='image'?'active':''}" onclick="vidSetSub('image')">🖼 Imagem → Vídeo</button>
   </div>
   <div class="gen-hint">${s.submode==='image'?'Anima uma imagem que você já tem (referenciada como [IMAGEM 1]).':'Gera o vídeo a partir de descrição completa de texto.'}</div></div>`;

 if(s.submode==='text'){
  h+=sectionHTML(N()+' · Sujeito',`<div class="gopt-grid">${optGrid(VID_SUBJECTS,s.subject,false,'vidPickSubject','name')}</div><div id="vidSubjFields" style="margin-top:.6rem;"></div>`);
  if(vidGroup()!=='scene') h+=sectionHTML(N()+' · Consistência (série)',layerConsHTML());
  h+=sectionHTML(N()+' · Cenário',`<div class="gcat-row">${catTabs(VID_LOC_CATS,s.locCat,'vidPickLocCat')}</div><div class="gopt-grid">${optGrid(VID_LOCATIONS[s.locCat],s.loc,false,'vidPickLoc','name')}</div><input type="text" id="vidLocExtra" class="gen-in" placeholder="ex: ao entardecer, com neblina, rua molhada..." oninput="buildGen()" style="margin-top:.5rem;">`);
  h+=sectionHTML(N()+' · Ação / o que acontece',`<textarea id="vidAction" class="gen-in" placeholder="ex: a mulher vira lentamente a cabeça e sorri para a câmera enquanto as folhas caem ao fundo..." oninput="buildGen()" style="min-height:70px;resize:vertical;line-height:1.5;"></textarea>`);
 } else {
  h+=sectionHTML(N()+' · Ação a animar',`<div class="gen-hint" style="margin-bottom:.5rem;">A imagem será referenciada como <span class="gen-ph">[IMAGEM 1]</span> no prompt.</div><textarea id="vidAction" class="gen-in" placeholder="ex: a câmera se aproxima lentamente enquanto o cabelo se move com o vento..." oninput="buildGen()" style="min-height:70px;resize:vertical;line-height:1.5;"></textarea>`);
 }

 h+=sectionHTML(N()+' · Movimento de câmera (pode escolher vários)',`<div class="gcat-row">${catTabs(VID_CAM_CATS,s.camCat,'vidPickCamCat')}</div><div class="gopt-grid">${optGrid(VID_CAM_MOVES[s.camCat],s.camMoves,true,'vidToggleCam','name')}</div><div id="vidCamNote" class="gen-hint" style="margin-top:.5rem;"></div>`);

 if(s.submode==='text'){
  h+=sectionHTML(N()+' · Câmera (detalhes)',`<div class="gen-row2">
     <label class="gen-fld"><span>Enquadramento</span><select id="vidCamShot" class="gen-in" onchange="buildGen()">${VID_CAM_SHOT.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
     <label class="gen-fld"><span>Lente</span><select id="vidCamLens" class="gen-in" onchange="buildGen()">${VID_CAM_LENS.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label></div>
     <div class="gen-row2"><label class="gen-fld"><span>Abertura</span><select id="vidCamAper" class="gen-in" onchange="buildGen()">${VID_CAM_APER.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
     <label class="gen-fld"><span>Câmera/filme</span><input type="text" id="vidCamBody" class="gen-in" placeholder="ex: ARRI Alexa, 35mm film..." oninput="buildGen()"></label></div>
     <input type="text" id="vidCamExtra" class="gen-in" placeholder="ex: 24fps, slow motion 120fps, motion blur..." oninput="buildGen()" style="margin-top:.4rem;">`);
  h+=sectionHTML(N()+' · Iluminação',`<div class="gopt-grid">${optGrid(VID_LIGHTING,s.light,false,'vidPickLight','name')}</div>`);
  h+=sectionHTML(N()+' · Emoção',layerEmotionHTML());
  h+=sectionHTML(N()+' · Texturas',layerTexturesHTML());
  h+=sectionHTML(N()+' · Estilo',`<div class="gopt-grid">${optGrid(VID_STYLES,s.style,false,'vidPickStyle','name')}</div>`);
 }

 h+=sectionHTML(N()+' · Áudio',`<div class="gopt-grid">${optGrid(VID_AUDIO,s.audio,true,'vidToggleAudio','name')}</div><div id="vidAudioFields" style="margin-top:.6rem;"></div>`);
 h+=sectionHTML(N()+' · Técnico',`<div class="gen-row2"><label class="gen-fld"><span>Duração</span><select id="vidDuration" class="gen-in" onchange="buildGen()">${VID_DURATION.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label><label class="gen-fld"><span>Proporção</span><select id="vidAspect" class="gen-in" onchange="buildGen()">${VID_ASPECT.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label></div>`);

 setTimeout(()=>{if(s.submode==='text')vidRenderFields();vidRenderAudioFields();vidUpdateCamNote();},0);
 return h;
}
function vidGroup(){const s=GS.vid.subject;if(['man','woman','child','couple'].includes(s))return'person';if(s==='animal')return'animal';if(s==='product')return'product';return'scene';}
function vidRenderFields(){const g=vidGroup();const fields=VID_SUBJECT_FIELDS[g];const mem=GS.vid.fieldMem[g]||{};const el=document.getElementById('vidSubjFields');if(!el)return;el.innerHTML=fields.map(f=>`<label class="gen-fld"><span>${f.label}</span><input type="text" id="vidf_${f.id}" class="gen-in" value="${(mem[f.id]||'').replace(/"/g,'&quot;')}" placeholder="${f.ph}" oninput="GS.vid.fieldMem['${g}']['${f.id}']=this.value;buildGen()"></label>`).join('');}
function vidSetSub(m){GS.vid.submode=m;renderGenControls();buildGen();}
function vidPickSubject(id){const pg=vidGroup();GS.vid.subject=id;const ng=vidGroup();if(pg!==ng)GS.vid.fieldMem[ng]=GS.vid.fieldMem[ng]||{};renderGenControls();buildGen();}
function vidPickLocCat(c){GS.vid.locCat=c;renderGenControls();buildGen();}
function vidPickLoc(id){GS.vid.loc=id;renderGenControls();buildGen();}
function vidPickCamCat(c){GS.vid.camCat=c;renderGenControls();buildGen();}
function vidToggleCam(id){const m=GS.vid.camMoves;m.has(id)?m.delete(id):m.add(id);renderGenControls();buildGen();}
function vidFindCam(id){for(const c of Object.values(VID_CAM_MOVES)){const f=c.find(m=>m.id===id);if(f)return f;}return null;}
function vidUpdateCamNote(){const el=document.getElementById('vidCamNote');if(!el)return;const names=[...GS.vid.camMoves].map(id=>vidFindCam(id)?.name).filter(Boolean);el.textContent=names.length?'✓ '+names.join(' → '):'Nenhum movimento (câmera estática)';}
function vidPickLight(id){GS.vid.light=id;renderGenControls();buildGen();}
function vidPickStyle(id){GS.vid.style=id;renderGenControls();buildGen();}
function vidToggleAudio(id){const a=GS.vid.audio;if(id==='silence'){GS.vid.audio=new Set(['silence']);}else{a.delete('silence');a.has(id)?a.delete(id):a.add(id);if(a.size===0)a.add('ambience');}renderGenControls();buildGen();}
function vidRenderAudioFields(){const el=document.getElementById('vidAudioFields');if(!el)return;const active=[...GS.vid.audio].filter(id=>id!=='silence');el.innerHTML=active.map(id=>{const a=VID_AUDIO.find(x=>x.id===id);return `<label class="gen-fld"><span>${a.icon} ${a.name}</span><input type="text" id="vidaudio_${id}" class="gen-in" value="${(GS.vid.audioMem[id]||'').replace(/"/g,'&quot;')}" placeholder="${a.ph}" oninput="GS.vid.audioMem['${id}']=this.value;buildGen()"></label>`;}).join('');}

function vidSubjectDesc(L){
 const g=vidGroup();const fields=VID_SUBJECT_FIELDS[g];const mem=GS.vid.fieldMem[g]||{};
 const parts=fields.map(f=>{const v=(mem[f.id]||'').trim();if(!v)return'';return (L==='en'?f.en:f.pt)(v);}).filter(Boolean);
 if(g==='scene') return parts.join(', ');
 const base={man:"a man",woman:"a woman",child:"a child",couple:"a couple",animal:"an animal",product:"a product"}[GS.vid.subject];
 const baseP={man:"um homem",woman:"uma mulher",child:"uma criança",couple:"um casal",animal:"um animal",product:"um produto"}[GS.vid.subject];
 const b=L==='en'?base:baseP;
 return parts.length?b+", "+parts.join(", "):b;
}

function buildVid(){
 const L=genLang,s=GS.vid;const lines=[];
 const action=gv('vidAction');
 const camTxts=[...s.camMoves].map(id=>vidFindCam(id)?.txt).filter(Boolean);
 const audioParts=[...s.audio].map(id=>{const a=VID_AUDIO.find(x=>x.id===id);if(id==='silence')return L==='en'?a.en:a.pt;const v=(GS.vid.audioMem[id]||'').trim();return v?((L==='en'?a.en:a.pt)+v):null;}).filter(Boolean);
 const duration=gv('vidDuration'),aspect=gv('vidAspect');

 if(s.submode==='image'){
  lines.push(L==='en'?"Animate the provided image [IMAGE 1].":"Anime a imagem fornecida [IMAGE 1].");
  if(action) lines.push((L==='en'?"ACTION":"AÇÃO")+": "+action+".");
  if(camTxts.length) lines.push((L==='en'?"CAMERA MOVEMENT":"MOVIMENTO DE CÂMERA")+": "+camTxts.join(", then ")+".");
  if(audioParts.length) lines.push((L==='en'?"AUDIO":"ÁUDIO")+": "+audioParts.join(" | ")+".");
  const t=[];if(duration)t.push(duration);if(aspect)t.push(aspect);
  if(t.length) lines.push((L==='en'?"TECHNICAL":"TÉCNICO")+": "+t.join(", ")+".");
  lines.push(L==='en'?"Keep the subject and style consistent with the source image.":"Mantenha o sujeito e o estilo consistentes com a imagem de origem.");
 } else {
  const loc=Object.values(VID_LOCATIONS).flat().find(l=>l.id===s.loc);
  const light=VID_LIGHTING.find(l=>l.id===s.light);
  const style=VID_STYLES.find(x=>x.id===s.style);
  const locExtra=gv('vidLocExtra');
  const camDet=[gv('vidCamShot'),gv('vidCamLens'),gv('vidCamAper'),gv('vidCamBody'),gv('vidCamExtra')].filter(Boolean);
  const camadas=layerLines(L,false);
  lines.push((L==='en'?"SUBJECT":"SUJEITO")+": "+vidSubjectDesc(L)+".");
  if(camadas.cons&&vidGroup()!=='scene') lines.push(camadas.cons);
  if(action) lines.push((L==='en'?"ACTION":"AÇÃO")+": "+action+".");
  lines.push((L==='en'?"SETTING":"CENÁRIO")+": "+(L==='en'?loc.en:loc.pt)+(locExtra?", "+locExtra:"")+".");
  if(camTxts.length) lines.push((L==='en'?"CAMERA MOVEMENT":"MOVIMENTO DE CÂMERA")+": "+camTxts.join(", then ")+".");
  if(camDet.length) lines.push((L==='en'?"CAMERA":"CÂMERA")+": "+camDet.join(", ")+".");
  lines.push((L==='en'?"LIGHTING":"ILUMINAÇÃO")+": "+(L==='en'?light.en:light.pt)+".");
  if(camadas.emotion) lines.push(camadas.emotion);
  if(camadas.textures) lines.push(camadas.textures);
  lines.push((L==='en'?"STYLE":"ESTILO")+": "+(L==='en'?style.en:style.pt)+".");
  if(audioParts.length) lines.push((L==='en'?"AUDIO":"ÁUDIO")+": "+audioParts.join(" | ")+".");
  const t=[];if(duration)t.push(duration);if(aspect)t.push(aspect);
  if(t.length) lines.push((L==='en'?"TECHNICAL":"TÉCNICO")+": "+t.join(", ")+".");
 }
 const tips=L==='en'?[
  {label:"🎬 Add cinematic grade",add:"Apply a strong cinematic color grade with teal-and-orange tones and film contrast."},
  {label:"🐢 Slow motion",add:"Render the action in smooth slow motion (120fps look) for dramatic emphasis."},
  {label:"✨ Atmosphere & particles",add:"Add atmospheric haze, dust or floating particles drifting through the light for depth."},
  {label:"🔊 Reinforce audio sync",add:"Sync sound design tightly with the on-screen action and camera movement."},
  {label:"📽️ Add film grain",add:"Add subtle 35mm film grain and gentle gate weave for an organic analog texture."}
 ]:[
  {label:"🎬 Correção cinematográfica",add:"Aplique uma correção de cor cinematográfica forte, com tons teal-and-orange e contraste de cinema."},
  {label:"🐢 Câmera lenta",add:"Renderize a ação em câmera lenta suave (visual de 120fps) para ênfase dramática."},
  {label:"✨ Atmosfera e partículas",add:"Adicione névoa atmosférica, poeira ou partículas flutuando na luz para dar profundidade."},
  {label:"🔊 Reforçar sincronia de áudio",add:"Sincronize o design de som de forma precisa com a ação em tela e o movimento de câmera."},
  {label:"📽️ Grão de filme",add:"Adicione grão sutil de filme 35mm e leve oscilação de quadro para textura analógica orgânica."}
 ];
 return {text:lines.join("\n\n"),tips};
}

// ---------- DADOS: LOGOMARCA ----------
const LOGO_OBJ_CATS=["Vestível","Adesivos/Papel","Sinalização","3D/Objeto","Especial"];
const LOGO_OBJECTS={
"Vestível":[
 {id:"enamel_pin",icon:"📌",name:"Pin Esmaltado",desc:"Broche metal + esmalte",en:"a hard-enamel metal lapel pin with crisp polished metal borders, glossy enamel color fill, and a butterfly clutch backing",pt:"um pin de lapela de metal com esmalte duro, bordas de metal polido nítidas e preenchimento de esmalte brilhante"},
 {id:"soft_enamel",icon:"🎖️",name:"Pin Esmalte Macio",desc:"Relevo, esmalte rebaixado",en:"a soft-enamel pin with raised metal lines and recessed colored enamel, slight texture depth",pt:"um pin de esmalte macio com linhas de metal em relevo e esmalte colorido rebaixado"},
 {id:"embroidery",icon:"🧵",name:"Bordado",desc:"Patch costurado em tecido",en:"an embroidered patch with raised satin-stitch thread texture, merrow border stitching, mounted on fabric",pt:"um patch bordado com textura de pontos de cetim em relevo, borda overloque, montado em tecido"},
 {id:"woven_label",icon:"🏷️",name:"Etiqueta Tecida",desc:"Tag de roupa costurada",en:"a woven clothing label tag with fine thread detail, stitched onto garment fabric",pt:"uma etiqueta de roupa tecida com detalhe fino de fios, costurada no tecido"},
 {id:"rubber_patch",icon:"🟫",name:"Etiqueta Borracha",desc:"PVC emborrachado",en:"a soft rubber/PVC patch with raised molded relief, matte rubbery surface, stitched or velcro-backed",pt:"um patch de borracha/PVC macio com relevo moldado, superfície emborrachada fosca"},
 {id:"leather_patch",icon:"🟤",name:"Patch de Couro",desc:"Couro gravado, jaqueta",en:"an embossed leather patch with debossed logo, natural grain, stitched onto denim or a jacket",pt:"um patch de couro com logo gravado em baixo-relevo, grão natural, costurado em jeans ou jaqueta"},
 {id:"tshirt_print",icon:"👕",name:"Estampa Camiseta",desc:"Serigrafia em tecido",en:"a screen-printed logo on a cotton t-shirt with natural fabric folds and ink texture",pt:"uma estampa serigráfica em camiseta de algodão com dobras naturais do tecido"},
 {id:"cap_embro",icon:"🧢",name:"Boné Bordado",desc:"Logo bordado em boné",en:"an embroidered logo on the front panel of a cap, raised thread, structured crown",pt:"um logo bordado no painel frontal de um boné, fio em relevo"}
],
"Adesivos/Papel":[
 {id:"sticker",icon:"🔖",name:"Adesivo Vinil",desc:"Die-cut, borda branca",en:"a die-cut glossy vinyl sticker with a thin white border, slight peel at one corner, on a surface",pt:"um adesivo de vinil brilhante die-cut com fina borda branca, levemente descolado num canto"},
 {id:"holographic",icon:"🌈",name:"Adesivo Holográfico",desc:"Iridescente, arco-íris",en:"a holographic iridescent sticker with rainbow-shifting reflective foil surface",pt:"um adesivo holográfico iridescente com superfície reflexiva que muda em arco-íris"},
 {id:"transparent_sticker",icon:"🪟",name:"Adesivo Transparente",desc:"Clear, sem fundo",en:"a transparent clear sticker applied on a glass surface, only the printed logo visible",pt:"um adesivo transparente aplicado sobre vidro, com apenas o logo impresso visível"},
 {id:"embossed_paper",icon:"📄",name:"Papel Relevo",desc:"Alto/baixo relevo",en:"a blind-embossed logo pressed into thick textured paper, subtle raised relief with soft shadows",pt:"um logo gravado em relevo seco sobre papel texturizado grosso, relevo sutil com sombras suaves"},
 {id:"foil_stamp",icon:"✨",name:"Hot Stamping",desc:"Foil metálico dourado",en:"a metallic gold foil-stamped logo on premium dark cardstock, reflective hot-foil finish",pt:"um logo em hot stamping de foil metálico dourado sobre papel escuro premium, acabamento reflexivo"},
 {id:"business_card",icon:"💳",name:"Cartão de Visita",desc:"Logo em cartão premium",en:"the logo on a premium business card with subtle texture, professional flat-lay presentation",pt:"o logo num cartão de visita premium com textura sutil, apresentação flat-lay profissional"},
 {id:"wax_seal",icon:"🔴",name:"Selo de Cera",desc:"Lacre vermelho gravado",en:"the logo pressed into a red wax seal with embossed relief and natural wax imperfections",pt:"o logo prensado em um selo de cera vermelha com relevo gravado e imperfeições naturais"},
 {id:"letterpress",icon:"🖨️",name:"Letterpress",desc:"Tipografia rebaixada",en:"a letterpress-printed logo deeply pressed into cotton paper with tactile recessed impression",pt:"um logo em letterpress profundamente prensado em papel algodão, com impressão rebaixada tátil"}
],
"Sinalização":[
 {id:"neon",icon:"💡",name:"Letreiro Neon",desc:"Tubo de neon brilhante",en:"the logo as a glowing neon tube sign mounted on a dark textured wall, vivid self-illuminated glow with color spill",pt:"o logo como letreiro de tubo de neon brilhante montado em parede escura texturizada, brilho vívido auto-iluminado"},
 {id:"led_sign",icon:"🔆",name:"Painel LED",desc:"Luz difusa moderna",en:"the logo as a backlit LED sign with soft even diffused glow on an interior wall",pt:"o logo como painel LED retroiluminado com brilho difuso suave em parede interna"},
 {id:"lightbox",icon:"🔳",name:"Light Box",desc:"Caixa de luz",en:"the logo in an illuminated light box sign with even internal backlighting, mounted on a wall",pt:"o logo em uma caixa de luz iluminada com retroiluminação interna uniforme"},
 {id:"storefront",icon:"🏪",name:"Fachada de Loja",desc:"Sinalização externa",en:"the logo as a large dimensional storefront sign mounted above a shop entrance, exterior daylight",pt:"o logo como grande sinalização dimensional na fachada acima da entrada de uma loja, luz do dia"},
 {id:"wall_3d",icon:"🧱",name:"Logo na Parede 3D",desc:"Letras com volume",en:"the logo as 3D dimensional letters mounted on an office reception wall, with realistic drop shadows",pt:"o logo como letras dimensionais 3D montadas na parede de recepção de um escritório, com sombras realistas"},
 {id:"window_decal",icon:"🪟",name:"Adesivo de Vitrine",desc:"Logo em vidro de loja",en:"the logo as frosted or vinyl decal applied to a storefront glass window",pt:"o logo como adesivo jateado ou de vinil aplicado na vitrine de vidro de uma loja"},
 {id:"flag",icon:"🚩",name:"Bandeira/Banner",desc:"Tecido ao vento",en:"the logo printed on a fabric flag or banner waving in the wind outdoors",pt:"o logo impresso em uma bandeira ou banner de tecido tremulando ao vento"}
],
"3D/Objeto":[
 {id:"3d_extrude",icon:"🧊",name:"Extrusão 3D",desc:"Logo com profundidade",en:"the logo extruded into a clean 3D dimensional object with realistic depth, bevels and studio lighting",pt:"o logo extrudado em objeto 3D dimensional limpo, com profundidade realista, chanfros e luz de estúdio"},
 {id:"balloon",icon:"🎈",name:"Inflável/Balão",desc:"Forma inflada brilhante",en:"the logo as a glossy inflated balloon object with puffy rounded volume and soft highlights",pt:"o logo como objeto inflável brilhante, com volume arredondado e brilhos suaves"},
 {id:"keychain",icon:"🔑",name:"Chaveiro",desc:"Acrílico ou metal",en:"the logo as an acrylic or metal keychain charm with a ring, resting on a surface",pt:"o logo como chaveiro de acrílico ou metal com argola, apoiado em uma superfície"},
 {id:"pillow",icon:"🛋️",name:"Almofada",desc:"Logo costurado/estampado",en:"the logo on a soft plush cushion/pillow with fabric texture and natural creases",pt:"o logo em uma almofada macia com textura de tecido e dobras naturais"},
 {id:"mug",icon:"☕",name:"Caneca",desc:"Logo em cerâmica",en:"the logo printed on a ceramic mug with glossy glaze, product photography",pt:"o logo impresso em uma caneca de cerâmica com glaze brilhante, fotografia de produto"},
 {id:"tote",icon:"🛍️",name:"Ecobag",desc:"Logo em sacola de tecido",en:"the logo screen-printed on a canvas tote bag with natural fabric texture",pt:"o logo serigrafado em uma ecobag de canvas com textura natural do tecido"},
 {id:"packaging",icon:"📦",name:"Embalagem",desc:"Caixa de produto",en:"the logo on premium product packaging box, clean studio product shot",pt:"o logo em uma embalagem premium de produto, foto de estúdio limpa"},
 {id:"coin",icon:"🪙",name:"Moeda/Medalha",desc:"Relevo em metal",en:"the logo struck as relief into a metal commemorative coin or medallion with raised detail",pt:"o logo cunhado em relevo numa moeda ou medalha de metal com detalhe elevado"}
],
"Especial":[
 {id:"hologram",icon:"🌀",name:"Holograma",desc:"Projeção futurista",en:"the logo as a glowing translucent holographic projection floating in the air, sci-fi style",pt:"o logo como projeção holográfica translúcida brilhante flutuando no ar, estilo sci-fi"},
 {id:"sketch",icon:"✏️",name:"Sketch à Mão",desc:"Desenho a lápis",en:"the logo as a hand-drawn pencil sketch on paper, loose construction lines and shading",pt:"o logo como esboço a lápis feito à mão no papel, com linhas de construção soltas e sombreamento"},
 {id:"blueprint",icon:"📐",name:"Blueprint",desc:"Planta técnica",en:"the logo as a technical blueprint drawing with white lines on blue paper, measurement annotations",pt:"o logo como desenho técnico blueprint, linhas brancas sobre papel azul, com anotações de medidas"},
 {id:"chalk",icon:"🖍️",name:"Giz/Lousa",desc:"Desenho em quadro-negro",en:"the logo hand-drawn in white chalk on a blackboard with chalky texture",pt:"o logo desenhado à mão em giz branco sobre lousa, com textura de giz"},
 {id:"graffiti",icon:"🎨",name:"Graffiti",desc:"Spray em muro",en:"the logo as a spray-paint graffiti mural on an urban concrete wall with drips and texture",pt:"o logo como mural de graffiti em spray sobre muro urbano de concreto, com escorridos e textura"},
 {id:"smoke",icon:"💨",name:"Fumaça",desc:"Formado por fumaça",en:"the logo formed from elegant swirling smoke against a dark background",pt:"o logo formado por fumaça elegante e sinuosa sobre fundo escuro"},
 {id:"latte",icon:"☕",name:"Latte Art",desc:"Espuma de café",en:"the logo as latte art drawn in milk foam on the surface of a coffee",pt:"o logo como latte art desenhado na espuma de leite sobre um café"},
 {id:"tattoo",icon:"🖊️",name:"Tatuagem",desc:"Logo tatuado na pele",en:"the logo as a realistic tattoo on skin with fine line detail",pt:"o logo como tatuagem realista na pele com detalhe de linhas finas"},
 {id:"pixel",icon:"👾",name:"Pixel Art",desc:"Estilo 8-bit",en:"the logo recreated as pixel art with crisp blocky pixels, retro 8-bit style",pt:"o logo recriado como pixel art com pixels nítidos, estilo retrô 8-bit"}
]
};
const LOGO_SURF_CATS=["Superfícies","Tecidos","Estúdio","Natureza/Cena"];
const LOGO_SURFACES={"Superfícies":[{id:"wood_table",icon:"🪵",name:"Mesa Madeira",desc:"Madeira natural",en:"resting on a natural wood table surface",pt:"sobre uma mesa de madeira natural"},{id:"marble_surf",icon:"🏛️",name:"Mármore",desc:"Pedra polida",en:"on a polished marble surface",pt:"sobre uma superfície de mármore polido"},{id:"concrete_surf",icon:"🪨",name:"Concreto",desc:"Cimento bruto",en:"on a raw concrete surface",pt:"sobre uma superfície de concreto bruto"},{id:"leather_surf",icon:"🟤",name:"Couro",desc:"Couro texturizado",en:"on a leather surface",pt:"sobre uma superfície de couro"},{id:"metal_surf",icon:"⚙️",name:"Metal",desc:"Chapa metálica",en:"on a brushed metal surface",pt:"sobre uma superfície de metal escovado"},{id:"water_surf",icon:"💧",name:"Água/Molhado",desc:"Reflexo, gotas",en:"on a wet reflective surface with water droplets",pt:"sobre uma superfície molhada reflexiva com gotas"},{id:"glass_surf",icon:"🪟",name:"Vidro",desc:"Reflexo de vidro",en:"on a glossy glass surface with reflections",pt:"sobre uma superfície de vidro brilhante com reflexos"},{id:"sand_surf",icon:"🏖️",name:"Areia",desc:"Areia fina",en:"on a fine sand surface",pt:"sobre uma superfície de areia fina"}],"Tecidos":[{id:"fabric",icon:"🧵",name:"Tecido",desc:"Pano texturizado",en:"on a soft textured fabric surface",pt:"sobre uma superfície de tecido texturizado"},{id:"denim",icon:"👖",name:"Jeans",desc:"Denim",en:"on a denim fabric surface",pt:"sobre uma superfície de tecido jeans"},{id:"linen",icon:"🧺",name:"Linho",desc:"Linho natural",en:"on a natural linen fabric surface",pt:"sobre uma superfície de linho natural"},{id:"velvet",icon:"🟥",name:"Veludo",desc:"Veludo macio",en:"on a rich velvet fabric surface with soft folds",pt:"sobre uma superfície de veludo com dobras suaves"},{id:"knit",icon:"🧶",name:"Malha/Tricô",desc:"Lã tricotada",en:"on a knitted wool surface",pt:"sobre uma superfície de lã tricotada"}],"Estúdio":[{id:"white_studio",icon:"⬜",name:"Branco",desc:"Fundo infinito",en:"on a seamless white studio background",pt:"sobre fundo de estúdio branco infinito"},{id:"black_studio",icon:"⬛",name:"Preto",desc:"Fundo dramático",en:"on a dramatic black background",pt:"sobre fundo preto dramático"},{id:"gradient_surf",icon:"🌅",name:"Degradê",desc:"Transição suave",en:"on a smooth gradient background",pt:"sobre um fundo em degradê suave"},{id:"color_studio",icon:"🎨",name:"Cor Sólida",desc:"Cor única",en:"on a solid colored studio background",pt:"sobre fundo de estúdio de cor sólida"},{id:"paper_surf",icon:"📄",name:"Papel",desc:"Papel texturizado",en:"on a clean textured paper surface",pt:"sobre uma superfície de papel texturizado"}],"Natureza/Cena":[{id:"plant_surf",icon:"🌿",name:"Plantas/Folhas",desc:"Vegetação",en:"surrounded by natural green leaves and plants",pt:"cercado por folhas verdes e plantas naturais"},{id:"stone_nature",icon:"🗿",name:"Rocha Natural",desc:"Pedra bruta",en:"on a natural rough stone surface outdoors",pt:"sobre uma rocha natural áspera ao ar livre"},{id:"wood_wall",icon:"🪵",name:"Parede Madeira",desc:"Painel rústico",en:"mounted on a rustic wood plank wall",pt:"montado em uma parede de tábuas de madeira rústica"},{id:"brick_wall",icon:"🧱",name:"Parede Tijolo",desc:"Tijolo aparente",en:"mounted on an exposed brick wall",pt:"montado em uma parede de tijolos aparentes"},{id:"office_wall",icon:"🏢",name:"Parede Escritório",desc:"Recepção moderna",en:"mounted on a modern office reception wall",pt:"montado na parede de recepção de um escritório moderno"}]}
const LOGO_LIGHTING=[{id:"studio",icon:"💡",name:"Estúdio Suave",desc:"Difusa, produto",en:"soft diffused studio product lighting",pt:"luz suave e difusa de estúdio de produto"},{id:"dramatic",icon:"🎬",name:"Dramática",desc:"Alto contraste",en:"dramatic high-contrast lighting with deep shadows",pt:"luz dramática de alto contraste"},{id:"rim",icon:"🌗",name:"Contraluz",desc:"Borda iluminada",en:"backlit rim lighting separating the logo from the background",pt:"luz de recorte (contraluz) destacando o logo"},{id:"natural",icon:"☀️",name:"Natural",desc:"Luz do dia",en:"soft natural daylight",pt:"luz natural suave do dia"},{id:"neon_glow",icon:"🟣",name:"Neon Glow",desc:"Brilho colorido",en:"colorful neon glow lighting with color spill",pt:"iluminação neon colorida com brilho derramado"},{id:"golden",icon:"🌅",name:"Golden Hour",desc:"Quente",en:"warm golden-hour lighting",pt:"luz quente de golden hour"},{id:"blue_hour",icon:"🌌",name:"Blue Hour",desc:"Azulada",en:"cool blue-hour twilight lighting",pt:"luz fria de blue hour"},{id:"spotlight",icon:"🔦",name:"Holofote",desc:"Foco único",en:"a single dramatic spotlight focused on the logo",pt:"um holofote único e dramático focado no logo"},{id:"dual_color",icon:"🔵",name:"Dupla Cor",desc:"Azul + magenta",en:"dual-color split lighting (blue and magenta)",pt:"iluminação dupla dividida (azul e magenta)"},{id:"soft_box3p",icon:"📸",name:"3 Pontos",desc:"Estúdio pro",en:"professional three-point studio lighting",pt:"iluminação profissional de estúdio em 3 pontos"},{id:"window_light",icon:"🪟",name:"Janela",desc:"Lateral suave",en:"soft natural window light from the side",pt:"luz natural suave vinda de uma janela lateral"},{id:"hard_sun",icon:"🌞",name:"Sol Forte",desc:"Sombras duras",en:"harsh direct sunlight with hard sharp shadows",pt:"luz solar forte com sombras duras"},{id:"low_key",icon:"🌑",name:"Low Key",desc:"Escura, sombria",en:"moody low-key lighting with deep blacks",pt:"iluminação low-key escura e sombria"},{id:"high_key",icon:"⚪",name:"High Key",desc:"Clara, limpa",en:"bright airy high-key lighting",pt:"iluminação high-key clara e limpa"},{id:"god_rays",icon:"⛅",name:"God Rays",desc:"Raios volumétricos",en:"dramatic volumetric god rays",pt:"raios de luz volumétricos dramáticos"},{id:"candle",icon:"🕯️",name:"Vela",desc:"Quente intimista",en:"warm intimate candle-light glow",pt:"luz quente e intimista de vela"},{id:"reflective_card",icon:"🪞",name:"Rebatedores",desc:"Reflexos suaves",en:"studio lighting with reflective gradient cards creating smooth highlights",pt:"luz de estúdio com rebatedores criando brilhos suaves"}]
const LOGO_STYLE=[{id:"photoreal",icon:"📷",name:"Fotorrealista",desc:"Foto de produto real",en:"photorealistic product photography, ultra-detailed, sharp focus, 8K",pt:"fotografia de produto fotorrealista, ultra-detalhada, foco nítido, 8K"},{id:"3d_render",icon:"🧊",name:"Render 3D",desc:"CGI premium",en:"premium 3D CGI render, physically-based materials, Octane quality",pt:"render 3D CGI premium, materiais físicos, qualidade Octane"},{id:"mockup_clean",icon:"🛍️",name:"Mockup Limpo",desc:"E-commerce",en:"clean commercial mockup presentation, e-commerce quality, minimal",pt:"apresentação de mockup comercial limpa, qualidade e-commerce, minimalista"},{id:"editorial",icon:"📰",name:"Editorial",desc:"Revista, premium",en:"high-end editorial branding presentation, magazine quality",pt:"apresentação de marca editorial premium, qualidade de revista"},{id:"flatlay",icon:"📐",name:"Flat Lay",desc:"Visto de cima",en:"top-down flat-lay branding composition with props",pt:"composição de marca flat-lay vista de cima, com props"},{id:"lifestyle",icon:"🌿",name:"Lifestyle",desc:"Em contexto real",en:"lifestyle branding photo showing the logo in a real-world context",pt:"foto de marca lifestyle mostrando o logo num contexto real"},{id:"hyperreal",icon:"💎",name:"Hiper-realista",desc:"Detalhe extremo",en:"hyper-realistic render with extreme micro-detail, flawless premium look",pt:"render hiper-realista com micro-detalhe extremo, visual premium impecável"},{id:"cinematic",icon:"🎥",name:"Cinematográfico",desc:"Cor de cinema",en:"cinematic look with color grading and shallow depth of field",pt:"visual cinematográfico com correção de cor e profundidade de campo rasa"},{id:"macro",icon:"🔬",name:"Macro",desc:"Close extremo",en:"extreme macro photography showing fine material texture detail",pt:"fotografia macro extrema mostrando detalhe fino da textura do material"},{id:"vintage",icon:"📻",name:"Vintage",desc:"Retrô desbotado",en:"vintage retro aesthetic with faded tones and film grain",pt:"estética vintage retrô com tons desbotados e grão de filme"},{id:"minimal",icon:"⚪",name:"Minimalista",desc:"Limpo, espaçado",en:"minimalist clean composition with lots of negative space",pt:"composição minimalista e limpa com bastante espaço negativo"},{id:"3d_clay_style",icon:"🟤",name:"Claymation",desc:"Massinha",en:"claymation stop-motion aesthetic with handmade clay texture",pt:"estética claymation stop-motion com textura de massinha feita à mão"}]
const LOGO_ASPECT=[{id:"",icon:"🚫",name:"Sem definir"},{id:"1:1",icon:"⬛",name:"1:1 Quadrado"},{id:"4:5",icon:"📱",name:"4:5 Feed"},{id:"3:4",icon:"🃏",name:"3:4 Vertical"},{id:"2:3",icon:"🖼️",name:"2:3 Retrato"},{id:"9:16",icon:"📲",name:"9:16 Stories"},{id:"16:9",icon:"🖥️",name:"16:9 Wide"},{id:"21:9",icon:"🎬",name:"21:9 Cinema"},{id:"3:2",icon:"📷",name:"3:2 Foto"},{id:"4:3",icon:"📺",name:"4:3 Clássico"}]

const LOGO_MAT_CATS=["Metais","Pétreos","Translúcidos","Orgânicos","Têxteis","Temáticos","Especiais"];
const LOGO_MATERIALS={"Metais":[{id:"gold",icon:"🥇",name:"Ouro",desc:"Dourado polido",en:"polished gold metal with warm reflective shine",pt:"ouro polido com brilho reflexivo quente"},{id:"chrome",icon:"🪞",name:"Cromado",desc:"Espelhado",en:"mirror-polished chrome with sharp reflections",pt:"cromo espelhado com reflexos nítidos"},{id:"brushed_metal",icon:"⚙️",name:"Metal Escovado",desc:"Aço fosco",en:"brushed stainless steel with fine directional grain",pt:"aço inox escovado com grão direcional fino"},{id:"copper",icon:"🟠",name:"Cobre",desc:"Avermelhado",en:"warm copper metal with reddish tones and patina",pt:"cobre quente com tons avermelhados e pátina"},{id:"rose_gold",icon:"🌹",name:"Ouro Rosé",desc:"Dourado rosado",en:"polished rose gold metal with pinkish warm sheen",pt:"ouro rosé polido com brilho rosado quente"},{id:"black_metal",icon:"⬛",name:"Metal Preto",desc:"Níquel negro",en:"matte black nickel metal finish",pt:"acabamento de metal níquel negro fosco"},{id:"liquid_metal",icon:"💧",name:"Metal Líquido",desc:"Mercúrio fluido",en:"flowing liquid metal like mercury with reflective surface",pt:"metal líquido fluido como mercúrio com superfície reflexiva"}],"Pétreos":[{id:"marble",icon:"🏛️",name:"Mármore",desc:"Veios elegantes",en:"polished marble with elegant veining",pt:"mármore polido com veios elegantes"},{id:"concrete",icon:"🪨",name:"Concreto",desc:"Cimento bruto",en:"raw concrete with rough industrial texture",pt:"concreto bruto com textura industrial áspera"},{id:"granite",icon:"⛰️",name:"Granito",desc:"Pedra granulada",en:"speckled polished granite stone",pt:"granito polido com textura granulada"},{id:"sandstone",icon:"🏜️",name:"Arenito",desc:"Pedra terrosa",en:"warm sandstone with porous earthy texture",pt:"arenito quente com textura porosa e terrosa"}],"Translúcidos":[{id:"glass",icon:"🔮",name:"Vidro",desc:"Refração",en:"translucent glass with refraction and caustics",pt:"vidro translúcido com refração e caustics"},{id:"ice",icon:"🧊",name:"Gelo",desc:"Cristalino frio",en:"clear ice with internal cracks and cold blue translucency",pt:"gelo transparente com rachaduras internas e translucidez azul fria"},{id:"crystal",icon:"💎",name:"Cristal",desc:"Facetado",en:"faceted crystal with prismatic light refraction",pt:"cristal facetado com refração prismática de luz"},{id:"resin",icon:"🫧",name:"Resina",desc:"Acrílico fundido",en:"clear cast resin with glossy depth",pt:"resina fundida transparente com profundidade brilhante"},{id:"jelly",icon:"🟢",name:"Gelatina",desc:"Translúcido mole",en:"soft translucent jelly with glossy wobbly surface",pt:"gelatina translúcida macia com superfície brilhante"}],"Orgânicos":[{id:"wood",icon:"🪵",name:"Madeira",desc:"Grão natural",en:"natural wood with visible grain and warm tones",pt:"madeira natural com grão visível e tons quentes"},{id:"leather",icon:"🟤",name:"Couro",desc:"Gravado",en:"embossed leather with natural grain",pt:"couro gravado com grão natural"},{id:"clay_3d",icon:"🟫",name:"Massinha",desc:"Claymation",en:"soft sculpted clay with fingerprint texture",pt:"massinha esculpida macia com textura de digitais"},{id:"paper_mat",icon:"📄",name:"Papel",desc:"Dobrável",en:"folded paper with crisp creases",pt:"papel dobrado com vincos nítidos"},{id:"plant",icon:"🌿",name:"Vegetal",desc:"Folhas/flores",en:"living foliage, leaves and flowers forming the shape",pt:"folhagem viva, folhas e flores formando a forma"}],"Têxteis":[{id:"wool",icon:"🧶",name:"Lã",desc:"Tricô macio",en:"soft knitted wool with fuzzy fiber texture",pt:"lã tricotada macia com textura de fibra felpuda"},{id:"crochet",icon:"🪡",name:"Crochê",desc:"Feito à mão",en:"handmade crochet with visible yarn loops and stitches",pt:"crochê feito à mão com laços de fio e pontos visíveis"},{id:"embroidery",icon:"🪧",name:"Bordado",desc:"Pontos em relevo",en:"embroidered satin-stitch thread with raised texture",pt:"bordado em ponto cetim com textura em relevo"},{id:"felt",icon:"🟥",name:"Feltro",desc:"Fibra fosca",en:"soft felt material with coarse matte fiber",pt:"feltro macio com fibra fosca e áspera"},{id:"plush",icon:"🧸",name:"Pelúcia",desc:"Pelo fofo",en:"ultra-soft plush fur with dense fluffy fibers",pt:"pelúcia ultra-macia com fibras fofas e densas"},{id:"denim_mat",icon:"👖",name:"Jeans",desc:"Denim trançado",en:"woven denim fabric with twill weave",pt:"tecido jeans trançado com tramado twill"},{id:"velvet_mat",icon:"🟣",name:"Veludo",desc:"Macio profundo",en:"rich velvet with soft plush nap",pt:"veludo rico com superfície macia e aveludada"},{id:"knit_mat",icon:"🧵",name:"Tricô Grosso",desc:"Pontos grandes",en:"chunky knit with thick interlocking stitches",pt:"tricô grosso com pontos espessos entrelaçados"}],
"Temáticos":[{id:"fruit_l",icon:"🍓",name:"Frutas",desc:"Suculento",en:"made of fresh juicy fruit with glossy realistic skin and vibrant color",pt:"feito de frutas frescas e suculentas com casca brilhante e cor vibrante"},{id:"cactus_l",icon:"🌵",name:"Cacto/Planta",desc:"Suculenta viva",en:"formed from living cactus and succulent plants with spines and tiny flowers",pt:"formado por cactos e suculentas vivas com espinhos e pequenas flores"},{id:"xmas_l",icon:"🎄",name:"Natal",desc:"Festivo",en:"decorated for Christmas with pine, ornaments, red ribbons and golden bells",pt:"decorado para o Natal com pinheiro, enfeites, fitas vermelhas e sinos dourados"},{id:"halloween_l",icon:"🎃",name:"Halloween",desc:"Assustador",en:"Halloween-themed with carved pumpkins, cobwebs and spooky glow",pt:"temático de Halloween com abóboras, teias e brilho assustador"},{id:"easter_l",icon:"🐣",name:"Páscoa",desc:"Chocolate",en:"made of decorated chocolate Easter eggs with pastel colors",pt:"feito de ovos de Páscoa de chocolate decorados com cores pastel"},{id:"foil_balloon",icon:"🎈",name:"Balão Metálico",desc:"Aniversário",en:"shiny metallic foil party balloon (mylar) with reflective inflated surface",pt:"balão metálico de festa (mylar) com superfície reflexiva e inflada"},{id:"porcelain_l",icon:"🏺",name:"Porcelana",desc:"Esmalte fino",en:"delicate glossy porcelain with smooth glaze and fine painted patterns",pt:"porcelana delicada e brilhante com esmalte liso e padrões pintados finos"},{id:"holo_l",icon:"🌈",name:"Holográfico",desc:"Adesivo iridescente",en:"holographic iridescent sticker surface with rainbow-shifting foil",pt:"superfície de adesivo holográfico iridescente com foil arco-íris"},{id:"icecream_l",icon:"🍦",name:"Sorvete",desc:"Cremoso gelado",en:"made of soft creamy ice cream with melting drips and sprinkles",pt:"feito de sorvete cremoso com escorridos derretendo e granulado"},{id:"candy_l",icon:"🍭",name:"Doces",desc:"Açúcar brilhante",en:"made of colorful candy and lollipops with glossy sugar coating",pt:"feito de doces e pirulitos coloridos com cobertura de açúcar brilhante"},{id:"flowers_l",icon:"🌸",name:"Flores",desc:"Floral",en:"composed of blooming flowers and petals in vivid colors",pt:"composto por flores e pétalas desabrochando em cores vivas"},{id:"cake_l",icon:"🎂",name:"Confeitaria",desc:"Bolo decorado",en:"made of decorated cake and piped buttercream frosting with fondant",pt:"feito de bolo decorado e chantilly em bico, com pasta americana"},{id:"gem_l",icon:"💍",name:"Pedras Preciosas",desc:"Cravejado",en:"encrusted with sparkling gemstones and diamonds with prismatic facets",pt:"cravejado de pedras preciosas e diamantes com facetas prismáticas"},{id:"animal_fur_l",icon:"🐆",name:"Pelagem Animal",desc:"Estampa selvagem",en:"covered in realistic animal fur texture with markings (leopard, tiger)",pt:"coberto por textura realista de pelagem animal com manchas (leopardo, tigre)"}],
"Especiais":[{id:"neon_mat",icon:"💡",name:"Neon",desc:"Luz emissiva",en:"glowing neon tube with self-emitting light",pt:"tubo de neon brilhante com luz auto-emissiva"},{id:"hologram_mat",icon:"🌈",name:"Holográfico",desc:"Iridescente",en:"iridescent holographic surface with shifting rainbow reflections",pt:"superfície holográfica iridescente com reflexos arco-íris"},{id:"galaxy",icon:"🌌",name:"Galáxia",desc:"Cósmico",en:"cosmic galaxy texture with stars and nebula",pt:"textura cósmica de galáxia com estrelas e nebulosa"},{id:"candy",icon:"🍬",name:"Candy",desc:"Doce brilhante",en:"glossy hard candy with vivid translucent color",pt:"candy duro brilhante com cor translúcida vívida"},{id:"smoke_mat",icon:"💨",name:"Fumaça",desc:"Etéreo",en:"formed from swirling ethereal smoke",pt:"formado por fumaça etérea e sinuosa"},{id:"fire_mat",icon:"🔥",name:"Fogo",desc:"Chamas",en:"made of blazing fire with glowing embers",pt:"feito de fogo ardente com brasas brilhantes"}]};
const LOGO_CAM_SHOT=[["","— sem preferência —"],["extreme close-up macro shot","Extreme close-up (macro)"],["close-up detail shot","Close-up / detalhe"],["product hero shot","Hero shot de produto"],["three-quarter angle view","Vista 3/4"],["front-on straight view","Vista frontal reta"],["top-down flat lay view","Vista de cima (flat lay)"],["overhead bird's-eye view","Vista aérea (de cima)"],["low-angle hero shot","Contra-plongée (baixo)"],["high-angle shot looking down","Plongée (alto)"],["45-degree angle","Ângulo de 45°"],["dramatic perspective view","Perspectiva dramática"],["dutch tilted angle","Ângulo holandês (inclinado)"],["side profile view","Perfil lateral"],["isometric view","Vista isométrica"],["floating centered composition","Flutuando centralizado"],["over-the-edge tabletop shot","Sobre a borda da mesa"]];
const LOGO_CAM_LENS=[["","— sem preferência —"],["100mm macro lens","100mm macro"],["105mm macro lens","105mm macro"],["85mm portrait lens","85mm retrato"],["50mm lens","50mm natural"],["35mm lens","35mm"],["24mm wide lens","24mm wide"],["16mm ultra-wide lens","16mm ultra-wide"],["135mm telephoto lens","135mm tele"],["tilt-shift lens","Tilt-shift"],["anamorphic lens","Anamórfica"]];
const LOGO_CAM_APER=[["","— sem preferência —"],["shot at f/1.2 with extremely shallow depth of field and creamy bokeh","f/1.2 extremo desfocado"],["shot at f/1.4 with very shallow depth of field and creamy bokeh","f/1.4 muito desfocado"],["shot at f/1.8 with shallow depth of field and soft bokeh","f/1.8 fundo desfocado"],["shot at f/2.8 with shallow depth of field","f/2.8 leve desfoque"],["shot at f/4 with moderate depth of field","f/4 médio-raso"],["shot at f/5.6 with moderate depth of field","f/5.6 médio"],["shot at f/8 with good depth of field","f/8 boa nitidez"],["shot at f/11 with deep focus","f/11 quase tudo nítido"],["shot at f/16 with deep focus, everything sharp","f/16 tudo nítido"]];

// ---------- LOGO: render + build ----------
function renderLogoControls(){
 const s=GS.logo;let h='';
 h+=`<div class="gen-sec"><div class="gen-sec-t">Logo de referência</div>
   <div class="gen-hint">Sua logo anexada será referenciada como <span class="gen-ph">[IMAGE 1]</span> no prompt. Não precisa anexar aqui — o prompt já indica onde ela entra.</div></div>`;
 h+=sectionHTML('1 · Transformar em... (pode escolher vários)',`<div class="gcat-row">${catTabs(LOGO_OBJ_CATS,s.objCat,'logoPickObjCat')}</div><div class="gopt-grid">${optGrid(LOGO_OBJECTS[s.objCat],s.objs,true,'logoToggleObj','name')}</div><div id="logoObjNote" class="gen-hint" style="margin-top:.5rem;"></div>`);
 h+=sectionHTML('2 · Material / acabamento (pode escolher vários)',`<div class="gcat-row">${catTabs(LOGO_MAT_CATS,s.matCat,'logoPickMatCat')}</div><div class="gopt-grid">${optGrid(LOGO_MATERIALS[s.matCat],s.mats,true,'logoToggleMat','name')}</div>
   <input type="text" id="logoMaterial" class="gen-in" placeholder="Material/acabamento extra (texto livre): ex: dourado escovado, vermelho metálico..." oninput="buildGen()" style="margin-top:.5rem;"></div>`);
 h+=sectionHTML('3 · Superfície / fundo',`<div class="gcat-row">${catTabs(LOGO_SURF_CATS,s.surfCat,'logoPickSurfCat')}</div><div class="gopt-grid">${optGrid(LOGO_SURFACES[s.surfCat],s.surface,false,'logoPickSurface','name')}</div>
   <input type="text" id="logoSurfExtra" class="gen-in" placeholder="Superfície/fundo extra (texto livre): ex: com vegetação ao redor, fundo escuro..." oninput="buildGen()" style="margin-top:.5rem;"></div>`);
 h+=sectionHTML('4 · Câmera',`<div class="gen-row2">
    <label class="gen-fld"><span>Enquadramento</span><select id="logoCamShot" class="gen-in" onchange="buildGen()">${LOGO_CAM_SHOT.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
    <label class="gen-fld"><span>Lente</span><select id="logoCamLens" class="gen-in" onchange="buildGen()">${LOGO_CAM_LENS.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label></div>
    <label class="gen-fld"><span>Abertura (profundidade)</span><select id="logoCamAper" class="gen-in" onchange="buildGen()">${LOGO_CAM_APER.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`);
 h+=sectionHTML('5 · Iluminação',`<div class="gopt-grid">${optGrid(LOGO_LIGHTING,s.light,false,'logoPickLight','name')}</div>`);
 h+=sectionHTML('6 · Estilo de render',`<div class="gopt-grid">${optGrid(LOGO_STYLE,s.style,false,'logoPickStyle','name')}</div>`);
 h+=sectionHTML('7 · Proporção',`<div class="gopt-grid">${optGrid(LOGO_ASPECT,s.aspect,false,'logoPickAspect','name')}</div>`);
 h+=sectionHTML('8 · Detalhes extras',`<textarea id="logoExtra" class="gen-in" placeholder="ex: com sombra suave, leve desgaste, reflexo no chão..." oninput="buildGen()" style="min-height:50px;resize:vertical;line-height:1.5;"></textarea>`);
 setTimeout(()=>logoUpdateObjNote(),0);
 return h;
}
function logoFindObj(id){for(const cat of Object.values(LOGO_OBJECTS)){const f=cat.find(o=>o.id===id);if(f)return f;}return null;}
function logoUpdateObjNote(){const el=document.getElementById('logoObjNote');if(!el)return;const names=[...GS.logo.objs].map(id=>logoFindObj(id)?.name).filter(Boolean);el.textContent=names.length?'✓ '+names.join(' + '):'Selecione pelo menos uma transformação';}
function logoPickObjCat(cat){GS.logo.objCat=cat;renderGenControls();buildGen();}
function logoToggleObj(id){const o=GS.logo.objs;o.has(id)?o.delete(id):o.add(id);renderGenControls();buildGen();}
function logoPickMatCat(cat){GS.logo.matCat=cat;renderGenControls();buildGen();}
function logoToggleMat(id){const m=GS.logo.mats;m.has(id)?m.delete(id):m.add(id);renderGenControls();buildGen();}
function logoPickSurfCat(cat){GS.logo.surfCat=cat;const items=LOGO_SURFACES[cat];if(!items.find(o=>o.id===GS.logo.surface))GS.logo.surface=items[0].id;renderGenControls();buildGen();}
function logoPickSurface(id){GS.logo.surface=id;renderGenControls();buildGen();}
function logoPickLight(id){GS.logo.light=id;renderGenControls();buildGen();}
function logoPickStyle(id){GS.logo.style=id;renderGenControls();buildGen();}
function logoPickAspect(id){GS.logo.aspect=id;renderGenControls();buildGen();}

function buildLogo(){
 const L=genLang,s=GS.logo;
 const objs=[...s.objs].map(id=>logoFindObj(id)).filter(Boolean);
 const surf=LOGO_SURFACES[s.surfCat]?.find(x=>x.id===s.surface)||Object.values(LOGO_SURFACES).flat().find(x=>x.id===s.surface);
 const light=LOGO_LIGHTING.find(x=>x.id===s.light);
 const style=LOGO_STYLE.find(x=>x.id===s.style);
 const matSel=[...s.mats].map(id=>{const m=Object.values(LOGO_MATERIALS).flat().find(x=>x.id===id);return m?(L==='en'?m.en:m.pt):null;}).filter(Boolean);
 const material=gv('logoMaterial'),surfExtra=gv('logoSurfExtra'),extra=gv('logoExtra');
 const cam=[gv('logoCamShot'),gv('logoCamLens'),gv('logoCamAper')].filter(Boolean);
 if(!objs.length) return {text:(L==='en'?'Select at least one transformation.':'Selecione ao menos uma transformação.'),tips:[]};
 const objText=objs.map(o=>L==='en'?o.en:o.pt).join(L==='en'?', and also as ':', e também como ');
 const lines=[];
 if(L==='en'){
  lines.push(`Transform the logo shown in [IMAGE 1] into ${objText}.`);
  lines.push(`Keep the exact shapes, proportions and details of the original logo perfectly intact — only change its material and presentation.`);
  const matParts=[...matSel];if(material)matParts.push(material);
  if(matParts.length) lines.push(`MATERIAL/FINISH: ${matParts.join(", ")}.`);
  const placeParts=[];if(surf&&surf.en)placeParts.push(surf.en);if(surfExtra)placeParts.push(surfExtra);
  if(placeParts.length) lines.push(`PLACEMENT: ${placeParts.join(", ")}.`);
  if(cam.length) lines.push(`CAMERA: ${cam.join(", ")}.`);
  lines.push(`LIGHTING: ${light.en}.`);
  if(extra) lines.push(`EXTRA: ${extra}.`);
  lines.push(`STYLE: ${style.en}.`);
  if(s.aspect) lines.push(`ASPECT RATIO: ${s.aspect}.`);
 } else {
  lines.push(`Transforme a logomarca mostrada em [IMAGE 1] em ${objText}.`);
  lines.push(`Mantenha as formas, proporções e detalhes exatos da logo original perfeitamente intactos — mude apenas o material e a apresentação.`);
  const matParts=[...matSel];if(material)matParts.push(material);
  if(matParts.length) lines.push(`MATERIAL/ACABAMENTO: ${matParts.join(", ")}.`);
  const placeParts=[];if(surf&&surf.pt)placeParts.push(surf.pt);if(surfExtra)placeParts.push(surfExtra);
  if(placeParts.length) lines.push(`POSICIONAMENTO: ${placeParts.join(", ")}.`);
  if(cam.length) lines.push(`CÂMERA: ${cam.join(", ")}.`);
  lines.push(`ILUMINAÇÃO: ${light.pt}.`);
  if(extra) lines.push(`EXTRA: ${extra}.`);
  lines.push(`ESTILO: ${style.pt}.`);
  if(s.aspect) lines.push(`PROPORÇÃO: ${s.aspect}.`);
 }
 const tips=L==='en'?[
  {label:"🪞 Add reflection",add:"Add a subtle reflection of the logo on the surface below it for a premium product feel."},
  {label:"✨ Add highlights",add:"Emphasize realistic specular highlights and edge light to make the material read clearly."},
  {label:"🎬 Cinematic mood",add:"Apply a cinematic color grade and shallow depth of field with a softly blurred background."},
  {label:"🔍 Macro detail",add:"Extreme close-up macro view showing the material texture in fine microscopic detail."},
  {label:"🖼️ Negative space",add:"Leave clean negative space around the logo for branding text or layout."}
 ]:[
  {label:"🪞 Adicionar reflexo",add:"Adicione um reflexo sutil do logo na superfície abaixo para dar sensação de produto premium."},
  {label:"✨ Realçar brilhos",add:"Enfatize brilhos especulares realistas e luz de borda para o material ficar bem evidente."},
  {label:"🎬 Clima cinematográfico",add:"Aplique uma correção de cor cinematográfica e profundidade de campo rasa com fundo levemente desfocado."},
  {label:"🔍 Detalhe macro",add:"Vista macro em extreme close-up mostrando a textura do material em detalhe microscópico."},
  {label:"🖼️ Espaço negativo",add:"Deixe espaço negativo limpo ao redor do logo para texto de marca ou layout."}
 ];
 return {text:lines.join("\n\n"),tips};
}


// ---------- DADOS: PERSONAGEM ----------
const CHAR_TYPES=[{id:"human",icon:"🧑",name:"Humano",desc:"Pessoa"},{id:"animal",icon:"🐾",name:"Animal",desc:"Bicho realista"},{id:"anthro",icon:"🦊",name:"Antropomórfico",desc:"Animal humanizado"},{id:"creature",icon:"🐉",name:"Criatura",desc:"Monstro/fantasia"},{id:"robot",icon:"🤖",name:"Robô/Mecha",desc:"Máquina"},{id:"mascot",icon:"📣",name:"Mascote/Produto",desc:"Marca, objeto vivo"}];
// Arquétipos de Jung — cada um com formas (gestalt), cores e traços
const CHAR_ARCHETYPES=[
 {id:"hero",icon:"🦸",name:"Herói",desc:"Corajoso, determinado",shape:"square and slightly triangular build, broad strong shoulders, upright confident posture, balanced proportions",color:"bold primary colors, heroic blue and red, gold accents",traits:"brave, determined, noble, strong jawline, confident expression"},
 {id:"villain",icon:"😈",name:"Vilão",desc:"Ameaçador, astuto",shape:"sharp angular triangular silhouette, pointed features, tall and narrow, asymmetrical menacing forms",color:"dark palette, deep purple, black, toxic green or blood red accents",traits:"menacing, cunning, sharp angular features, piercing eyes, sinister smile"},
 {id:"mentor",icon:"🧙",name:"Mentor/Sábio",desc:"Sábio, guia",shape:"tall dignified silhouette, flowing robes, slightly stooped wise posture, rounded calm shapes",color:"muted earthy tones, deep blue, silver, white beard tones",traits:"wise, calm, experienced, kind eyes, weathered face, reassuring presence"},
 {id:"trickster",icon:"🃏",name:"Trapaceiro",desc:"Travesso, imprevisível",shape:"asymmetrical playful silhouette, mix of curves and zigzags, dynamic off-balance pose, exaggerated limbs",color:"clashing vibrant colors, purple and green, mismatched palette",traits:"mischievous, playful, sly grin, unpredictable energy, expressive face"},
 {id:"innocent",icon:"😇",name:"Inocente",desc:"Puro, gentil",shape:"round soft silhouette, large head, small body, pillowy bulbous shapes, low center of gravity",color:"soft pastel palette, light blue, pink, cream, warm whites",traits:"innocent, sweet, large round eyes, soft cheeks, gentle smile"},
 {id:"caregiver",icon:"🤱",name:"Cuidador",desc:"Acolhedor, protetor",shape:"warm rounded silhouette, soft welcoming posture, gentle curves, comfortable proportions",color:"warm comforting tones, soft orange, warm beige, gentle green",traits:"nurturing, warm, kind smile, caring eyes, welcoming open posture"},
 {id:"explorer",icon:"🧭",name:"Explorador",desc:"Aventureiro, curioso",shape:"lean athletic silhouette, dynamic ready-to-move posture, practical gear, slightly angular",color:"earthy adventure tones, khaki, brown, forest green, sky blue",traits:"adventurous, curious, alert eyes, weathered practical look, energetic stance"},
 {id:"rebel",icon:"🤘",name:"Rebelde",desc:"Ousado, transgressor",shape:"edgy angular silhouette, asymmetrical attitude pose, sharp jagged details, confident stance",color:"high-contrast palette, black, red, metallic, neon accents",traits:"rebellious, bold, defiant expression, edgy style, intense gaze"},
 {id:"lover",icon:"💕",name:"Amante",desc:"Apaixonado, sensual",shape:"elegant flowing curved silhouette, graceful posture, soft harmonious S-curves",color:"romantic warm palette, deep red, rose, soft pink, warm gold",traits:"charming, passionate, expressive eyes, warm inviting smile, graceful"},
 {id:"ruler",icon:"👑",name:"Soberano",desc:"Poderoso, imponente",shape:"imposing tall silhouette, broad commanding posture, structured regal forms, symmetrical authority",color:"royal palette, deep purple, gold, crimson, rich jewel tones",traits:"regal, commanding, proud posture, sharp confident gaze, authoritative"},
 {id:"creator",icon:"🎨",name:"Criador",desc:"Criativo, visionário",shape:"expressive asymmetrical silhouette, artistic flowing forms, dynamic creative posture",color:"vibrant creative palette, rainbow accents, expressive bold colors",traits:"imaginative, visionary, bright curious eyes, expressive hands, artistic flair"},
 {id:"sage",icon:"📚",name:"Erudito",desc:"Inteligente, analítico",shape:"slender thoughtful silhouette, composed upright posture, clean geometric forms, glasses",color:"intellectual cool palette, navy, grey, deep teal, muted tones",traits:"intelligent, analytical, thoughtful expression, observant eyes, refined"},
 {id:"jester",icon:"🤡",name:"Bobo da Corte",desc:"Engraçado, caótico",shape:"exaggerated bouncy silhouette, mix of big circles and rectangles, comedic off-balance pose",color:"loud playful palette, bright clashing primaries, polka dots",traits:"funny, energetic, huge expressive grin, rubbery exaggerated features"},
 {id:"warrior",icon:"⚔️",name:"Guerreiro",desc:"Forte, disciplinado",shape:"powerful muscular silhouette, wide square stance, armored angular forms, battle-ready posture",color:"strong metallic palette, steel grey, iron, deep red, bronze",traits:"strong, disciplined, battle-scarred, intense focused eyes, commanding"},
 {id:"antihero",icon:"🕶️",name:"Anti-herói",desc:"Ambíguo, durão",shape:"lean rugged silhouette, slouched cool posture, mix of sharp and grounded forms",color:"desaturated moody palette, dark grey, brown leather, muted blue",traits:"morally grey, brooding, weary eyes, rough edges, reluctant charisma"}];
const CHAR_SHAPE_OVERRIDE=[{id:"auto",icon:"✨",name:"Pelo arquétipo",desc:"Usa a forma do arquétipo"},{id:"round",icon:"⭕",name:"Circular",desc:"Amigável, suave, fofo"},{id:"square",icon:"⬛",name:"Quadrado",desc:"Forte, estável, confiável"},{id:"triangle",icon:"🔺",name:"Triangular",desc:"Dinâmico, perigoso, ágil"},{id:"tall",icon:"📏",name:"Alongado",desc:"Elegante, esguio"},{id:"mixed",icon:"🔷",name:"Misto",desc:"Personalidade em camadas"}];
const CHAR_AGE=[{id:"",icon:"🚫",name:"Sem definir"},{id:"baby",icon:"👶",name:"Bebê"},{id:"child",icon:"🧒",name:"Criança"},{id:"teen",icon:"🧑",name:"Adolescente"},{id:"young",icon:"🧑",name:"Jovem adulto"},{id:"adult",icon:"🧔",name:"Adulto"},{id:"elder",icon:"👴",name:"Idoso"}];
const CHAR_BUILD=[{id:"",icon:"🚫",name:"Sem definir"},{id:"slim",icon:"🌿",name:"Magro"},{id:"athletic",icon:"💪",name:"Atlético"},{id:"average",icon:"🧍",name:"Médio"},{id:"muscular",icon:"🏋️",name:"Musculoso"},{id:"chubby",icon:"🧸",name:"Fofinho"},{id:"tall_thin",icon:"📏",name:"Alto e magro"},{id:"short",icon:"🍄",name:"Baixinho"}];
const CHAR_STYLE_CATS=["2D/Desenho","3D/CGI","Pintura","Especial"];
const CHAR_STYLES={"2D/Desenho":[{id:"pencil",icon:"✏️",name:"Lápis",desc:"Esboço a grafite",en:"detailed graphite pencil sketch with construction lines, hatching and shading"},{id:"inked",icon:"🖋️",name:"Nanquim",desc:"Tinta, contornos",en:"clean inked illustration with bold ink outlines and crosshatching"},{id:"manga",icon:"🇯🇵",name:"Mangá",desc:"P&B japonês",en:"black-and-white manga style with screentones and dynamic linework"},{id:"anime",icon:"🌸",name:"Anime",desc:"Animação japonesa colorida",en:"colorful anime style with cel shading, expressive large eyes and detailed hair"},{id:"cartoon",icon:"📺",name:"Cartoon",desc:"Desenho ocidental",en:"western cartoon style with bold outlines, flat colors and exaggerated features"},{id:"comic",icon:"💥",name:"HQ/Comic",desc:"Quadrinhos americanos",en:"american comic-book style with dynamic inking, bold shadows and halftone dots"},{id:"chibi",icon:"🥰",name:"Chibi",desc:"Mini fofo",en:"chibi style with oversized head, tiny body and super-deformed cute proportions"},{id:"flat_vector",icon:"🔷",name:"Vetor Flat",desc:"Geométrico limpo",en:"flat vector illustration with clean geometric shapes and minimal shading"},{id:"storybook",icon:"📖",name:"Livro Infantil",desc:"Ilustração de livro",en:"whimsical children's storybook illustration style, soft and charming"},{id:"pixel",icon:"👾",name:"Pixel Art",desc:"Retrô 8/16-bit",en:"pixel art character sprite with crisp pixels and limited retro palette"}],"3D/CGI":[{id:"pixar",icon:"🎈",name:"Pixar/Disney",desc:"3D animação cinema",en:"Pixar/Disney style 3D render with smooth stylized surfaces and expressive features"},{id:"hyperreal3d",icon:"💎",name:"Hiper-realista",desc:"CGI fotorrealista",en:"hyper-realistic 3D CGI render with detailed textures and physically-based materials"},{id:"stylized3d",icon:"🎮",name:"Game Stylized",desc:"3D de jogo estilizado",en:"stylized 3D game-character render with hand-painted textures"},{id:"lowpoly",icon:"📐",name:"Low Poly",desc:"Facetas geométricas",en:"low-poly 3D character with faceted geometric surfaces"},{id:"claymation",icon:"🟤",name:"Claymation",desc:"Massinha stop-motion",en:"claymation stop-motion character with clay fingerprint texture"},{id:"vinyl_toy",icon:"🧸",name:"Art Toy",desc:"Boneco de vinil",en:"designer vinyl art-toy render with glossy molded surfaces"},{id:"felt3d",icon:"🧶",name:"Feltro/Pelúcia",desc:"Brinquedo macio",en:"soft plush felt toy character with fabric texture and stitching"}],"Pintura":[{id:"digital_paint",icon:"🖌️",name:"Pintura Digital",desc:"Concept art",en:"professional digital painting, concept-art quality with painterly brushwork"},{id:"watercolor",icon:"🎨",name:"Aquarela",desc:"Aguada suave",en:"watercolor painting style with soft bleeding edges and paper texture"},{id:"oil",icon:"🪔",name:"Óleo",desc:"Clássico, textura",en:"classical oil painting with rich impasto brushstrokes"},{id:"gouache",icon:"🟦",name:"Guache",desc:"Cores opacas",en:"gouache painting with opaque matte colors and visible brushstrokes"},{id:"ink_wash",icon:"🖤",name:"Sumi-e",desc:"Aguada oriental",en:"oriental ink-wash (sumi-e) style with expressive minimal brushstrokes"}],"Especial":[{id:"realistic",icon:"📷",name:"Realista",desc:"Quase foto",en:"photorealistic character portrait with lifelike detail"},{id:"semi_real",icon:"🎭",name:"Semi-realista",desc:"Estilizado realista",en:"semi-realistic stylized illustration blending realism and stylization"},{id:"silhouette",icon:"⬛",name:"Silhueta",desc:"Forma em contraste",en:"strong silhouette design, character shown as bold shape against contrasting background"},{id:"sketch_color",icon:"✍️",name:"Sketch Colorido",desc:"Esboço com cor",en:"loose colored sketch with energetic linework and quick color blocking"},{id:"cyberpunk_style",icon:"🌃",name:"Cyberpunk",desc:"Neon futurista",en:"cyberpunk character style with neon accents and futuristic tech details"},{id:"fantasy_art",icon:"🐉",name:"Fantasia",desc:"Concept épico",en:"epic fantasy concept-art style with detailed costume and atmosphere"}]};
const CHAR_VIEW=[{id:"",icon:"🚫",name:"Sem definir"},{id:"portrait",icon:"🖼️",name:"Retrato",desc:"Rosto/busto"},{id:"fullbody",icon:"🧍",name:"Corpo inteiro",desc:"Personagem completo"},{id:"turnaround",icon:"🔄",name:"Turnaround",desc:"Frente/lado/costas"},{id:"action",icon:"⚡",name:"Pose de Ação",desc:"Dinâmico"},{id:"tpose",icon:"🧎",name:"Pose Neutra",desc:"Referência T/A-pose"},{id:"expression",icon:"😀",name:"Expressões",desc:"Folha de expressões"},{id:"threequarter",icon:"📐",name:"Vista 3/4",desc:"Ângulo clássico"}];
const CHAR_BG_CATS=["Liso","Cena","Estilizado"];
const CHAR_BACKGROUNDS={"Liso":[{id:"white",icon:"⬜",name:"Branco",en:"clean white background"},{id:"neutral",icon:"🌫️",name:"Neutro",en:"neutral grey studio background"},{id:"gradient",icon:"🌅",name:"Degradê",en:"smooth gradient background"},{id:"solid_color",icon:"🎨",name:"Cor Sólida",en:"solid color background matching the character palette"},{id:"transparent",icon:"🪟",name:"Transparente",en:"transparent/isolated background for asset use"}],"Cena":[{id:"nature",icon:"🌲",name:"Natureza",en:"natural outdoor environment background"},{id:"city",icon:"🌆",name:"Cidade",en:"urban city environment background"},{id:"interior",icon:"🏠",name:"Interior",en:"interior room environment background"},{id:"fantasy_env",icon:"🏰",name:"Fantasia",en:"fantasy environment background"},{id:"scifi_env",icon:"🚀",name:"Sci-Fi",en:"futuristic sci-fi environment background"},{id:"battlefield",icon:"⚔️",name:"Campo de Batalha",en:"dramatic battlefield environment background"}],"Estilizado":[{id:"abstract",icon:"🌀",name:"Abstrato",en:"abstract shapes background complementing the character"},{id:"spotlight_bg",icon:"🔦",name:"Holofote",en:"dramatic spotlight with dark vignette background"},{id:"pattern",icon:"🔳",name:"Padrão",en:"decorative patterned background"},{id:"sky",icon:"☁️",name:"Céu",en:"dramatic sky background"},{id:"emblem",icon:"🛡️",name:"Emblema",en:"heraldic emblem/badge background framing the character"}]};
const CHAR_LIGHTING=[{id:"soft",icon:"💡",name:"Suave",desc:"Difusa",en:"soft even diffused lighting"},{id:"dramatic",icon:"🎬",name:"Dramática",desc:"Contraste",en:"dramatic high-contrast lighting with deep shadows"},{id:"rim",icon:"🌗",name:"Contraluz",desc:"Borda",en:"rim backlighting separating character from background"},{id:"cinematic",icon:"🎥",name:"Cinematográfica",desc:"Volumétrica",en:"cinematic volumetric lighting"},{id:"natural",icon:"☀️",name:"Natural",desc:"Luz do dia",en:"natural daylight"},{id:"heroic",icon:"🦸",name:"Heroica",desc:"De baixo, épica",en:"heroic low-angle lighting with epic god rays"},{id:"neon",icon:"🟣",name:"Neon",desc:"Colorida",en:"colorful neon lighting"},{id:"dual",icon:"🔵",name:"Dupla Cor",desc:"Azul + magenta",en:"dual-color rim lighting (blue and magenta)"},{id:"flat_light",icon:"⚪",name:"Flat",desc:"Sem sombra (vetor)",en:"flat even lighting ideal for vector/cartoon style"},{id:"moody",icon:"🌑",name:"Sombrio",desc:"Escuro",en:"dark moody low-key lighting"}];

const CHAR_PALETTE=[{id:"auto",icon:"✨",name:"Pelo arquétipo",desc:"Cores do arquétipo"},{id:"warm",icon:"🔥",name:"Quentes",desc:"Vermelho, laranja"},{id:"cool",icon:"❄️",name:"Frias",desc:"Azul, verde, roxo"},{id:"vibrant",icon:"🌈",name:"Vibrante",desc:"Cores saturadas"},{id:"pastel",icon:"🩰",name:"Pastel",desc:"Suaves e claras"},{id:"earthy",icon:"🍂",name:"Terrosas",desc:"Marrom, ocre"},{id:"monochrome",icon:"⚫",name:"Monocromático",desc:"Tons de uma cor"},{id:"neon_pal",icon:"💠",name:"Neon",desc:"Fluorescente"},{id:"dark",icon:"🖤",name:"Escura",desc:"Sombria, dramática"},{id:"jewel",icon:"💎",name:"Joia",desc:"Ricas e profundas"}];
const CHAR_TEXTURES=[{id:"none",icon:"🚫",name:"Padrão",en:""},{id:"furry",icon:"🦊",name:"Pelo",en:"detailed fur texture"},{id:"scales",icon:"🐉",name:"Escamas",en:"reptilian scale texture"},{id:"feathers",icon:"🪶",name:"Penas",en:"soft feather texture"},{id:"metallic",icon:"⚙️",name:"Metálico",en:"metallic mechanical surfaces"},{id:"slime_tex",icon:"🟢",name:"Gosma",en:"glossy slimy translucent texture"},{id:"rocky",icon:"🪨",name:"Rochoso",en:"rough rocky stone texture"},{id:"fabric_tex",icon:"🧵",name:"Tecido",en:"fabric and cloth texture"},{id:"plush_tex",icon:"🧸",name:"Pelúcia",en:"soft plush toy texture"},{id:"glowing",icon:"💡",name:"Brilhante",en:"glowing luminous energy texture"},{id:"crystalline",icon:"💎",name:"Cristalino",en:"crystalline gem-like texture"},{id:"wooden",icon:"🪵",name:"Madeira",en:"carved wooden texture"}];
const CHAR_ASPECT=[{id:"",icon:"🚫",name:"Sem definir"},{id:"1:1",icon:"⬛",name:"1:1 Quadrado"},{id:"4:5",icon:"📱",name:"4:5 Feed"},{id:"2:3",icon:"🖼️",name:"2:3 Retrato"},{id:"3:4",icon:"🃏",name:"3:4 Vertical"},{id:"9:16",icon:"📲",name:"9:16 Stories"},{id:"16:9",icon:"🖥️",name:"16:9 Wide"},{id:"3:2",icon:"📷",name:"3:2 Foto"}];

// ---------- PERSONAGEM: regras de combinação ----------
// Folhas de referência (turnaround, T-pose, expressões) pedem luz uniforme, fundo liso e formato que caiba as vistas.
const CHAR_SHEET_VIEWS=['turnaround','tpose','expression'];
const CHAR_SHEET_BAD_LIGHT=['dramatic','rim','cinematic','heroic','neon','dual','moody'];
const CHAR_TALL_ASPECTS=['9:16','2:3','3:4','4:5'];
function charName(list,id){return (list.find(x=>x.id===id)||{}).name||id;}
function charWarnHTML(txt){return `<div class="gen-hint" style="margin-top:.5rem;padding:.45rem .6rem;border-radius:8px;border:1px solid rgba(217,119,6,.45);background:rgba(245,158,11,.12);color:var(--text);">⚠️ ${txt}</div>`;}
function charInfoHTML(txt){return `<div class="gen-hint" style="margin-top:.5rem;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--accent);background:rgba(0,122,255,.08);color:var(--text);">✨ ${txt}</div>`;}
function charIssues(){
 const s=GS.char,w={};
 if(!CHAR_SHEET_VIEWS.includes(s.view)) return w;
 const vn=charName(CHAR_VIEW,s.view);
 if(CHAR_SHEET_BAD_LIGHT.includes(s.light)) w.light=`A luz <b>${charName(CHAR_LIGHTING,s.light)}</b> não combina com <b>${vn}</b>: numa folha de referência a luz precisa ser igual em todas as vistas, senão a IA cria sombras diferentes em cada uma. Recomendado: <b>Suave</b> ou <b>Flat</b>.`;
 if(s.bgCat!=='Liso') w.bg=`Fundo com cenário não combina com <b>${vn}</b>: a folha de referência fica limpa e fácil de usar com fundo liso.`;
 if(s.view==='turnaround'&&CHAR_TALL_ASPECTS.includes(s.aspect)) w.aspect=`<b>${s.aspect}</b> é estreito demais para 3 vistas lado a lado (frente, lado e costas). Recomendado: <b>16:9</b>.`;
 return w;
}

// ---------- PERSONAGEM: render + build ----------
function renderCharControls(){
 const s=GS.char;let h='';
 h+=sectionHTML('1 · Tipo de personagem',`<div class="gopt-grid">${optGrid(CHAR_TYPES,s.type,false,'charPickType','name')}</div>`);
 h+=sectionHTML('2 · Arquétipo (define forma, cor e traços)',`<div class="gopt-grid">${optGrid(CHAR_ARCHETYPES,s.arch,false,'charPickArch','name')}</div><div id="charArchNote" class="gen-hint" style="margin-top:.5rem;"></div>`);
 h+=sectionHTML('3 · Conceito / descrição',`<textarea id="charConcept" class="gen-in" placeholder="Descreva o personagem: ex: uma raposa guerreira com armadura de folhas, um velho relojoeiro gentil, um robô carteiro amigável..." oninput="buildGen()" style="min-height:60px;resize:vertical;line-height:1.5;"></textarea>${(s.type==='animal'||s.type==='anthro')?'<div class="gen-hint">🐾 Diga qual animal (ex: raposa, lobo, gato). Sem isso a IA escolhe um bicho qualquer.</div>':''}`);
 if(s.type==='human'||s.type==='anthro'){
  h+=sectionHTML('4 · Idade & físico',`<div style="margin-bottom:.5rem;"><div class="gen-fld"><span>Idade</span></div><div class="gopt-grid">${optGrid(CHAR_AGE,s.age,false,'charPickAge','name')}</div></div><div class="gen-fld"><span>Físico</span></div><div class="gopt-grid">${optGrid(CHAR_BUILD,s.build,false,'charPickBuild','name')}</div>`);
 }
 h+=sectionHTML('5 · Forma / silhueta (gestalt)',`<div class="gopt-grid">${optGrid(CHAR_SHAPE_OVERRIDE,s.shape,false,'charPickShape','name')}</div>${s.shape!=='auto'?`<div class="gen-hint">A forma <b>${charName(CHAR_SHAPE_OVERRIDE,s.shape)}</b> vai substituir a do arquétipo. O prompt pede para manter a personalidade e adaptar os traços a essa forma.</div>`:''}`);
 h+=sectionHTML('6 · Paleta de cores',`<div class="gopt-grid">${optGrid(CHAR_PALETTE,s.palette,false,'charPickPalette','name')}</div><input type="text" id="charColorExtra" class="gen-in" placeholder="Cores específicas (opcional): ex: roxo e dourado, verde-musgo..." oninput="buildGen()" style="margin-top:.5rem;">`);
 h+=sectionHTML('7 · Textura (pode escolher várias)',`<div class="gopt-grid">${optGrid(CHAR_TEXTURES,s.textures,true,'charToggleTexture','name')}</div>`);
 h+=sectionHTML('8 · Roupa / acessórios / equipamento',`<input type="text" id="charOutfit" class="gen-in" placeholder="ex: armadura medieval, jaqueta de couro, óculos redondos, capa esvoaçante...">`);
 h+=sectionHTML('9 · Estilo de arte',`<div class="gcat-row">${catTabs(CHAR_STYLE_CATS,s.styleCat,'charPickStyleCat')}</div><div class="gopt-grid">${optGrid(CHAR_STYLES[s.styleCat],s.style,false,'charPickStyle','name')}</div>`);
 const iss=charIssues();
 const adjNote=(s.adj&&s.adj.view===s.view)?charInfoHTML(`Ajustei sozinho para combinar com <b>${charName(CHAR_VIEW,s.view)}</b>: ${s.adj.list.join(', ')}. Pode mudar se quiser.`):'';
 h+=sectionHTML('10 · Enquadramento / pose',`<div class="gopt-grid">${optGrid(CHAR_VIEW,s.view,false,'charPickView','name')}</div>${adjNote}`);
 h+=sectionHTML('11 · Iluminação',`<div class="gopt-grid">${optGrid(CHAR_LIGHTING,s.light,false,'charPickLight','name')}</div>${iss.light?charWarnHTML(iss.light):''}`);
 h+=sectionHTML('12 · Fundo',`<div class="gcat-row">${catTabs(CHAR_BG_CATS,s.bgCat,'charPickBgCat')}</div><div class="gopt-grid">${optGrid(CHAR_BACKGROUNDS[s.bgCat],s.bg,false,'charPickBg','name')}</div>${iss.bg?charWarnHTML(iss.bg):''}`);
 h+=sectionHTML('13 · Proporção',`<div class="gopt-grid">${optGrid(CHAR_ASPECT,s.aspect,false,'charPickAspect','name')}</div>${iss.aspect?charWarnHTML(iss.aspect):''}`);
 h+=sectionHTML('14 · Detalhes extras',`<textarea id="charExtra" class="gen-in" placeholder="ex: cicatriz no olho, expressão alegre, segurando um cajado mágico..." oninput="buildGen()" style="min-height:50px;resize:vertical;line-height:1.5;"></textarea>`);
 const onInputs=()=>{const o=document.getElementById('charOutfit');if(o)o.oninput=buildGen;};
 setTimeout(()=>{charUpdateArchNote();onInputs();},0);
 return h;
}
function charPickType(id){GS.char.type=id;renderGenControls();buildGen();}
function charPickArch(id){GS.char.arch=id;renderGenControls();buildGen();}
function charUpdateArchNote(){const el=document.getElementById('charArchNote');if(!el)return;const a=CHAR_ARCHETYPES.find(x=>x.id===GS.char.arch);if(!a){el.textContent='';return;}el.innerHTML=`<b style="color:var(--accent)">${a.name}:</b> ${a.desc}. Forma e cores aplicadas automaticamente (você pode sobrescrever abaixo).`;}
function charPickAge(id){GS.char.age=id;renderGenControls();buildGen();}
function charPickBuild(id){GS.char.build=id;renderGenControls();buildGen();}
function charPickShape(id){GS.char.shape=id;renderGenControls();buildGen();}
function charPickPalette(id){GS.char.palette=id;renderGenControls();buildGen();}
function charToggleTexture(id){const t=GS.char.textures;if(id==='none'){GS.char.textures=new Set(['none']);}else{t.delete('none');t.has(id)?t.delete(id):t.add(id);if(t.size===0)t.add('none');}renderGenControls();buildGen();}
function charPickStyleCat(c){GS.char.styleCat=c;const items=CHAR_STYLES[c];if(!items.find(x=>x.id===GS.char.style))GS.char.style=items[0].id;renderGenControls();buildGen();}
function charPickStyle(id){GS.char.style=id;renderGenControls();buildGen();}
function charPickView(id){
 const s=GS.char;s.view=id;const adj=[];
 if(CHAR_SHEET_VIEWS.includes(id)){
  if(CHAR_SHEET_BAD_LIGHT.includes(s.light)){s.light='soft';adj.push('iluminação → <b>Suave</b>');}
  if(s.bgCat!=='Liso'){s.bgCat='Liso';s.bg='white';adj.push('fundo → <b>Branco</b>');}
  const want=id==='turnaround'?'16:9':'1:1';
  if(CHAR_TALL_ASPECTS.includes(s.aspect)||(id==='turnaround'&&!s.aspect)){s.aspect=want;adj.push('proporção → <b>'+want+'</b>');}
 }
 s.adj=adj.length?{view:id,list:adj}:null;
 renderGenControls();buildGen();
}
function charPickLight(id){GS.char.light=id;GS.char.adj=null;renderGenControls();buildGen();}
function charPickBgCat(c){GS.char.bgCat=c;GS.char.adj=null;const items=CHAR_BACKGROUNDS[c];if(!items.find(x=>x.id===GS.char.bg))GS.char.bg=items[0].id;renderGenControls();buildGen();}
function charPickBg(id){GS.char.bg=id;GS.char.adj=null;renderGenControls();buildGen();}
function charPickAspect(id){GS.char.aspect=id;GS.char.adj=null;renderGenControls();buildGen();}

function buildChar(){
 const L=genLang,s=GS.char;
 const type=CHAR_TYPES.find(x=>x.id===s.type);
 const arch=CHAR_ARCHETYPES.find(x=>x.id===s.arch);
 const style=CHAR_STYLES[s.styleCat]?.find(x=>x.id===s.style)||Object.values(CHAR_STYLES).flat().find(x=>x.id===s.style);
 const view=CHAR_VIEW.find(x=>x.id===s.view);
 const light=CHAR_LIGHTING.find(x=>x.id===s.light);
 const bg=CHAR_BACKGROUNDS[s.bgCat]?.find(x=>x.id===s.bg)||Object.values(CHAR_BACKGROUNDS).flat().find(x=>x.id===s.bg);
 const texs=[...s.textures].filter(id=>id!=='none').map(id=>CHAR_TEXTURES.find(t=>t.id===id)?.en).filter(Boolean);
 const concept=gv('charConcept'),outfit=gv('charOutfit'),colorExtra=gv('charColorExtra'),extra=gv('charExtra');
 // forma: arquétipo ou override
 let shapeTxt=arch.shape;
 if(s.shape!=='auto'){const sh={round:"round soft circular silhouette (friendly, approachable)",square:"square sturdy silhouette (strong, stable, dependable)",triangle:"sharp triangular silhouette (dynamic, edgy, dangerous)",tall:"tall elongated elegant silhouette",mixed:"mixed shape language combining contrasting forms for a layered personality"};shapeTxt=(sh[s.shape]||shapeTxt)+(L==='en'?" — use these shapes instead of the archetype's typical build; keep the personality, but adapt the facial features to this shape":" — use estas formas no lugar do físico típico do arquétipo; mantenha a personalidade, mas adapte os traços do rosto a esta forma");}
 // cor: arquétipo ou override
 let colorTxt=arch.color;
 if(s.palette!=='auto'){const pal={warm:"warm color palette (reds, oranges, yellows)",cool:"cool color palette (blues, greens, purples)",vibrant:"vibrant saturated color palette",pastel:"soft pastel color palette",earthy:"earthy natural color palette",monochrome:"monochromatic color palette",neon_pal:"glowing neon color palette",dark:"dark moody color palette",jewel:"rich jewel-tone color palette"};colorTxt=pal[s.palette]||colorTxt;}
 if(colorExtra) colorTxt+=", specifically "+colorExtra;
 const semBicho=!concept&&(s.type==='animal'||s.type==='anthro');
 const typeWord=semBicho?{animal:"[WHICH ANIMAL? e.g. fox] character",anthro:"anthropomorphic [WHICH ANIMAL? e.g. fox] character"}[s.type]:{human:"character",animal:"animal character",anthro:"anthropomorphic animal character",creature:"fantasy creature",robot:"robot/mecha character",mascot:"mascot character"}[s.type];
 const artigo=/^[aeiou]/i.test(typeWord)?"an":"a";
 const lines=[];
 if(L==='en'){
  lines.push(`Character design of ${artigo} ${typeWord}${concept?": "+concept:""}.`);
  const archEn={hero:"hero",villain:"villain",mentor:"wise mentor",trickster:"trickster",innocent:"innocent",caregiver:"caregiver",explorer:"explorer",rebel:"rebel",lover:"lover",ruler:"ruler",creator:"creator",sage:"sage/scholar",jester:"jester",warrior:"warrior",antihero:"anti-hero"}[s.arch]||arch.id;
  lines.push(`ARCHETYPE: ${archEn} — ${arch.traits}.`);
  lines.push(`SHAPE LANGUAGE: ${shapeTxt}.`);
  if(s.type==='human'||s.type==='anthro'){const ageEn={baby:"baby",child:"child",teen:"teenager",young:"young adult",adult:"adult",elder:"elderly"}[s.age];const buildEn={slim:"slim",athletic:"athletic",average:"average",muscular:"muscular",chubby:"chubby rounded",tall_thin:"tall and thin",short:"short"}[s.build];const ab=[ageEn,buildEn].filter(Boolean);if(ab.length)lines.push(`BUILD: ${ab.join(", ")}.`);}
  lines.push(`COLOR PALETTE: ${colorTxt}.`);
  if(texs.length) lines.push(`TEXTURE: ${texs.join(", ")}.`);
  if(outfit) lines.push(`OUTFIT/GEAR: ${outfit}.`);
  if(view&&view.id) lines.push(`PRESENTATION: ${ {portrait:"portrait/bust shot",fullbody:"full body shot",turnaround:"character turnaround sheet (front, side, back views)",action:"dynamic action pose",tpose:"neutral reference T-pose",expression:"expression sheet with multiple facial expressions",threequarter:"three-quarter view"}[view.id] }.`);
  lines.push(`LIGHTING: ${light.en}.`);
  lines.push(`BACKGROUND: ${bg.en}.`);
  if(extra) lines.push(`DETAILS: ${extra}.`);
  lines.push(`ART STYLE: ${style.en}.`);
  if(s.aspect) lines.push(`ASPECT RATIO: ${s.aspect}.`);
 } else {
  const an={hero:"herói",villain:"vilão",mentor:"mentor sábio",trickster:"trapaceiro",innocent:"inocente",caregiver:"cuidador",explorer:"explorador",rebel:"rebelde",lover:"amante",ruler:"soberano",creator:"criador",sage:"erudito",jester:"bobo da corte",warrior:"guerreiro",antihero:"anti-herói"}[s.arch];
  const tw=semBicho?{animal:"personagem animal [QUAL ANIMAL? ex: raposa]",anthro:"personagem antropomórfico [QUAL ANIMAL? ex: raposa]"}[s.type]:{human:"personagem",animal:"personagem animal",anthro:"personagem animal antropomórfico",creature:"criatura fantástica",robot:"personagem robô/mecha",mascot:"personagem mascote"}[s.type];
  lines.push(`Design de personagem de um ${tw}${concept?": "+concept:""}.`);
  lines.push(`ARQUÉTIPO: ${an} — ${arch.traits}.`);
  lines.push(`LINGUAGEM DE FORMAS: ${shapeTxt}.`);
  if(s.type==='human'||s.type==='anthro'){const ageP={baby:"bebê",child:"criança",teen:"adolescente",young:"jovem adulto",adult:"adulto",elder:"idoso"}[s.age];const buildP={slim:"magro",athletic:"atlético",average:"médio",muscular:"musculoso",chubby:"fofinho arredondado",tall_thin:"alto e magro",short:"baixinho"}[s.build];const ab=[ageP,buildP].filter(Boolean);if(ab.length)lines.push(`FÍSICO: ${ab.join(", ")}.`);}
  lines.push(`PALETA DE CORES: ${colorTxt}.`);
  if(texs.length) lines.push(`TEXTURA: ${texs.join(", ")}.`);
  if(outfit) lines.push(`ROUPA/EQUIPAMENTO: ${outfit}.`);
  if(view&&view.id) lines.push(`APRESENTAÇÃO: ${ {portrait:"retrato/busto",fullbody:"corpo inteiro",turnaround:"folha de turnaround (frente, lado, costas)",action:"pose de ação dinâmica",tpose:"T-pose neutra de referência",expression:"folha de expressões faciais",threequarter:"vista três-quartos"}[view.id] }.`);
  const lightPt={soft:"luz suave e difusa",dramatic:"luz dramática de alto contraste",rim:"contraluz separando o personagem do fundo",cinematic:"iluminação cinematográfica volumétrica",natural:"luz natural do dia",heroic:"iluminação heroica de baixo com raios épicos",neon:"iluminação neon colorida",dual:"contraluz dupla (azul e magenta)",flat_light:"luz chapada uniforme (ideal p/ vetor/cartoon)",moody:"iluminação escura e sombria (low-key)"}[s.light]||light.en;
  const bgPt={white:"fundo branco limpo",neutral:"fundo de estúdio cinza neutro",gradient:"fundo em degradê suave",solid_color:"fundo de cor sólida combinando com a paleta",transparent:"fundo transparente/isolado para uso como asset",nature:"ambiente externo natural",city:"ambiente urbano de cidade",interior:"ambiente de interior",fantasy_env:"ambiente de fantasia",scifi_env:"ambiente futurista sci-fi",battlefield:"campo de batalha dramático",abstract:"formas abstratas complementando o personagem",spotlight_bg:"holofote dramático com vinheta escura",pattern:"fundo com padrão decorativo",sky:"fundo de céu dramático",emblem:"emblema/brasão heráldico emoldurando o personagem"}[s.bg]||bg.en;
  lines.push(`ILUMINAÇÃO: ${lightPt}.`);
  lines.push(`FUNDO: ${bgPt}.`);
  if(extra) lines.push(`DETALHES: ${extra}.`);
  lines.push(`ESTILO DE ARTE: ${style.en}.`);
  if(s.aspect) lines.push(`PROPORÇÃO: ${s.aspect}.`);
 }
 // x = dicas que brigam com esta (ligar uma desliga a outra); hide = poses em que a dica não aparece
 const allTips=[
  {id:"turn",x:["action","colors"],hide:["turnaround","action"],label:L==='en'?"🔄 Turnaround sheet":"🔄 Folha turnaround",add:L==='en'?"Present as a full character turnaround sheet with front, side, and back views in the same neutral pose, consistent proportions.":"Apresente como folha de turnaround completa com vistas de frente, lado e costas na mesma pose neutra, proporções consistentes."},
  {id:"expr",x:["action","colors"],hide:["expression","action"],label:L==='en'?"😀 Expression sheet":"😀 Folha de expressões",add:L==='en'?"Also include a row of facial expression close-ups (happy, angry, sad, surprised) of this same character.":"Inclua também uma fileira de closes do rosto com expressões (feliz, bravo, triste, surpreso) deste mesmo personagem."},
  {id:"colors",x:["turn","expr","action"],hide:["turnaround","tpose","expression","action"],label:L==='en'?"🎨 Color variations":"🎨 Variações de cor",add:L==='en'?"Show 3 alternate color palette variations of the same character side by side.":"Mostre 3 variações de paleta de cores do mesmo personagem lado a lado."},
  {id:"action",x:["turn","expr","colors"],hide:["action","turnaround","tpose","expression"],label:L==='en'?"⚡ Dynamic action":"⚡ Ação dinâmica",add:L==='en'?"Render the character in a dynamic dramatic action pose with motion and energy.":"Renderize o personagem em uma pose de ação dramática e dinâmica, com movimento e energia."},
  {id:"sil",label:L==='en'?"📐 Strong silhouette":"📐 Silhueta forte",add:L==='en'?"Emphasize an instantly readable silhouette — the character should be recognizable as a black shape alone.":"Enfatize uma silhueta instantaneamente legível — o personagem deve ser reconhecível só como forma preta."}
 ];
 const tips=allTips.filter(t=>!(t.hide||[]).includes(s.view));
 return {text:lines.join("\n\n"),tips};
}

// ═══ DADOS: CONSTRUÇÃO ═══
const CON_REMOVE_OPTS=[{id:"mato",icon:"🌿",name:"Mato/Vegetação",pt:"toda a vegetação rasteira, mato alto e ervas daninhas",en:"all undergrowth, tall weeds and wild grass"},{id:"arvores",icon:"🌳",name:"Árvores",pt:"as árvores e arbustos",en:"the trees and bushes"},{id:"entulho",icon:"🧱",name:"Entulho",pt:"entulho, lixo e materiais espalhados",en:"debris, trash and scattered materials"},{id:"construcao",icon:"🏚️",name:"Construção velha",pt:"qualquer construção antiga ou em ruínas",en:"any old or ruined construction"},{id:"pedras",icon:"🪨",name:"Pedras",pt:"pedras e rochas soltas",en:"loose rocks and stones"},{id:"cerca",icon:"🚧",name:"Cercas/Muros",pt:"cercas e muros existentes",en:"existing fences and walls"},{id:"fiacao",icon:"🔌",name:"Fiação",pt:"fios e cabos elétricos aéreos",en:"overhead electrical wires and cables"},{id:"postes",icon:"🪧",name:"Postes",pt:"postes de energia e iluminação",en:"power and lighting poles"},{id:"veiculos",icon:"🚗",name:"Veículos",pt:"carros e veículos estacionados",en:"parked cars and vehicles"},{id:"placas",icon:"📋",name:"Placas",pt:"placas e cartazes",en:"signs and billboards"},{id:"agua",icon:"💧",name:"Água parada",pt:"poças, água parada e lama",en:"puddles, standing water and mud"},{id:"barracos",icon:"⛺",name:"Barracos",pt:"barracos e construções improvisadas",en:"shacks and makeshift structures"}];
const CON_GROUND_OPTS=[{id:"",icon:"🚫",name:"Manter relevo"},{id:"nivelar",icon:"📏",name:"Nivelar",pt:"nivelar e terraplanar o solo deixando-o plano e compactado",en:"level and grade the soil flat and compacted"},{id:"terra",icon:"🟫",name:"Terra batida",pt:"deixar o solo de terra batida limpa, pronto para construção",en:"leave clean bare packed earth, ready for construction"},{id:"gramado",icon:"🌱",name:"Gramado",pt:"cobrir com gramado verde aparado",en:"cover with trimmed green lawn"},{id:"brita",icon:"⚪",name:"Brita/Cascalho",pt:"cobrir a área com brita/cascalho",en:"cover the area with gravel"},{id:"concreto_piso",icon:"⬜",name:"Concreto",pt:"cobrir com laje/piso de concreto",en:"cover with a concrete slab"},{id:"areia",icon:"🏖️",name:"Areia",pt:"deixar o solo de areia compactada",en:"leave compacted sand ground"},{id:"escavado",icon:"🕳️",name:"Escavado",pt:"escavar a área para a fundação",en:"excavate the area for the foundation"}];

const CON_BUILD_TYPES=[{id:"casa_terrea",icon:"🏠",name:"Casa Térrea",pt:"uma casa térrea residencial",en:"a single-story residential house"},{id:"sobrado",icon:"🏡",name:"Sobrado",pt:"um sobrado residencial de dois pavimentos",en:"a two-story residential house"},{id:"predio_res",icon:"🏢",name:"Prédio Residencial",pt:"um edifício residencial de apartamentos",en:"a residential apartment building"},{id:"comercial",icon:"🏬",name:"Comercial",pt:"um edifício comercial",en:"a commercial building"},{id:"condominio",icon:"🏘️",name:"Condomínio",pt:"um condomínio de casas",en:"a gated community of houses"},{id:"galpao",icon:"🏭",name:"Galpão",pt:"um galpão industrial",en:"an industrial warehouse"},{id:"chacara",icon:"🌳",name:"Chácara",pt:"uma chácara com casa de campo",en:"a countryside house with grounds"},{id:"sobreloja",icon:"🏪",name:"Loja + Moradia",pt:"um edifício misto com loja no térreo e moradia em cima",en:"a mixed-use building with shop below and housing above"}];
const CON_ARCH_STYLES=[{id:"contemporaneo",icon:"🟦",name:"Contemporâneo",pt:"arquitetura contemporânea com linhas limpas",en:"contemporary architecture with clean lines"},{id:"moderno",icon:"⬜",name:"Moderno",pt:"arquitetura moderna minimalista",en:"modern minimalist architecture"},{id:"colonial",icon:"🏛️",name:"Colonial",pt:"arquitetura colonial clássica",en:"classic colonial architecture"},{id:"rustico",icon:"🪵",name:"Rústico",pt:"estilo rústico com madeira e pedra",en:"rustic style with wood and stone"},{id:"industrial",icon:"⚙️",name:"Industrial",pt:"estilo industrial com concreto aparente e metal",en:"industrial style with exposed concrete and metal"},{id:"mediterraneo",icon:"🌅",name:"Mediterrâneo",pt:"estilo mediterrâneo com telhas e arcos",en:"mediterranean style with tiles and arches"},{id:"luxo",icon:"💎",name:"Alto Padrão",pt:"residência de altíssimo padrão e luxo",en:"high-end luxury residence"},{id:"sustentavel",icon:"🌿",name:"Sustentável",pt:"arquitetura sustentável com telhado verde e madeira",en:"sustainable architecture with green roof and wood"}];
const CON_MATERIALS=[{id:"none",icon:"🚫",name:"Padrão",pt:"",en:""},{id:"vidro",icon:"🪟",name:"Vidro",pt:"amplas superfícies de vidro",en:"large glass surfaces"},{id:"concreto",icon:"🧱",name:"Concreto",pt:"concreto aparente",en:"exposed concrete"},{id:"madeira",icon:"🪵",name:"Madeira",pt:"detalhes em madeira",en:"wood detailing"},{id:"tijolo",icon:"🟧",name:"Tijolo",pt:"tijolo aparente",en:"exposed brick"},{id:"pedra",icon:"🪨",name:"Pedra",pt:"revestimento em pedra",en:"stone cladding"},{id:"branco",icon:"⬜",name:"Branco",pt:"fachada branca",en:"white facade"},{id:"metal",icon:"⚙️",name:"Metal",pt:"detalhes metálicos",en:"metallic details"}];
const CON_FEATURES=[{id:"piscina",icon:"🏊",name:"Piscina",pt:"piscina",en:"swimming pool"},{id:"jardim",icon:"🌷",name:"Jardim",pt:"jardim paisagístico",en:"landscaped garden"},{id:"garagem",icon:"🚗",name:"Garagem",pt:"garagem",en:"garage"},{id:"varanda",icon:"🪴",name:"Varanda",pt:"varanda/terraço",en:"balcony/terrace"},{id:"muro",icon:"🧱",name:"Muro",pt:"muro e portão",en:"wall and gate"},{id:"calcada",icon:"🚶",name:"Calçada",pt:"calçada e entrada",en:"sidewalk and driveway"},{id:"arvores_p",icon:"🌳",name:"Árvores",pt:"árvores ornamentais",en:"ornamental trees"},{id:"iluminacao",icon:"💡",name:"Iluminação",pt:"iluminação externa",en:"exterior lighting"},{id:"parquinho",icon:"🛝",name:"Parquinho",pt:"playground infantil",en:"children playground"},{id:"quadra",icon:"⚽",name:"Quadra",pt:"quadra poliesportiva",en:"sports court"},{id:"churrasqueira",icon:"🔥",name:"Churrasqueira",pt:"área de churrasqueira/gourmet",en:"barbecue/gourmet area"},{id:"horta",icon:"🥬",name:"Horta",pt:"horta",en:"vegetable garden"},{id:"deck",icon:"🪵",name:"Deck",pt:"deck de madeira",en:"wooden deck"},{id:"lago",icon:"🦆",name:"Lago",pt:"lago ornamental",en:"ornamental pond"},{id:"estacionamento",icon:"🅿️",name:"Estacionamento",pt:"estacionamento",en:"parking lot"},{id:"painel_solar",icon:"☀️",name:"Painéis Solares",pt:"painéis solares no telhado",en:"solar panels on the roof"},{id:"academia",icon:"🏋️",name:"Academia",pt:"academia ao ar livre",en:"outdoor gym"},{id:"portaria",icon:"🛂",name:"Portaria",pt:"portaria/guarita",en:"gatehouse/entrance booth"}];
const CON_BUILD_VIEW=[{id:"manter",icon:"📷",name:"Manter ângulo",pt:"mantendo o mesmo ângulo e perspectiva da foto original",en:"keeping the exact same angle and perspective as the original photo"},{id:"frontal",icon:"🏠",name:"Frontal",pt:"em vista frontal da fachada",en:"in a front facade view"},{id:"aerea",icon:"🚁",name:"Aérea",pt:"em vista aérea de drone (de cima em ângulo)",en:"in an aerial drone view"},{id:"aerea_alta",icon:"🛰️",name:"Aérea Alta",pt:"em vista aérea alta, quase ortogonal",en:"in a high near-top-down aerial view"},{id:"3_4",icon:"📐",name:"Vista 3/4",pt:"em vista de três-quartos",en:"in a three-quarter view"},{id:"rua",icon:"🛣️",name:"Da rua",pt:"vista do nível da rua",en:"from street level"},{id:"baixo",icon:"⬆️",name:"Contra-plongée",pt:"em ângulo baixo, valorizando a altura",en:"from a low angle emphasizing height"},{id:"esquina",icon:"📍",name:"Esquina",pt:"vista de esquina mostrando duas fachadas",en:"corner view showing two facades"},{id:"fundos",icon:"🌳",name:"Fundos/Quintal",pt:"vista dos fundos mostrando a área de lazer",en:"backyard view showing the leisure area"},{id:"entrada",icon:"🚪",name:"Entrada",pt:"vista aproximada da entrada principal",en:"close view of the main entrance"}];
const CON_TIMEOFDAY=[{id:"",icon:"🚫",name:"Sem definir"},{id:"amanhecer",icon:"🌄",name:"Amanhecer",pt:"ao amanhecer com luz suave",en:"at dawn with soft light"},{id:"manha",icon:"🌤️",name:"Manhã",pt:"de manhã com luz clara",en:"in the morning with bright light"},{id:"dia",icon:"☀️",name:"Meio-dia",pt:"à luz forte do meio-dia",en:"in strong midday daylight"},{id:"golden",icon:"🌅",name:"Golden Hour",pt:"no fim de tarde dourado",en:"at golden hour"},{id:"entardecer",icon:"🌇",name:"Entardecer",pt:"ao entardecer com céu alaranjado",en:"at dusk with orange sky"},{id:"blue",icon:"🌆",name:"Blue Hour",pt:"na hora azul do crepúsculo",en:"at blue-hour twilight"},{id:"noite",icon:"🌙",name:"Noite",pt:"à noite com iluminação acesa",en:"at night with lights on"},{id:"nublado",icon:"☁️",name:"Nublado",pt:"em dia nublado suave",en:"on a soft overcast day"},{id:"chuva",icon:"🌧️",name:"Chuvoso",pt:"em dia chuvoso com reflexos no chão molhado",en:"on a rainy day with wet ground reflections"}];

const CON_TL_CAM=[{id:"original",icon:"📷",name:"Ângulo da Foto",pt:"câmera fixa mantendo exatamente o mesmo ângulo, enquadramento e perspectiva da foto de referência",en:"static camera keeping the exact same angle, framing and perspective as the reference photo"},{id:"aerea",icon:"🚁",name:"Drone Aéreo",pt:"filmagem aérea de drone, vista de cima em ângulo",en:"aerial drone shot, angled top-down view"},{id:"aerea_orbita",icon:"🛸",name:"Drone Orbitando",pt:"drone orbitando o terreno de cima",en:"drone orbiting the lot from above"},{id:"tiltshift",icon:"🔍",name:"Tilt-Shift",pt:"efeito tilt-shift de miniatura, foco seletivo",en:"tilt-shift miniature effect with selective focus"},{id:"fixa",icon:"📌",name:"Fixa",pt:"câmera fixa e estática enquadrando o terreno",en:"static locked camera framing the lot"},{id:"orbita",icon:"🔄",name:"Órbita",pt:"câmera orbitando lentamente o terreno ao nível do solo",en:"camera slowly orbiting the lot at ground level"},{id:"frontal_tl",icon:"🎥",name:"Frontal",pt:"câmera frontal fixa de frente para a obra",en:"fixed frontal camera facing the construction"},{id:"push",icon:"➡️",name:"Aproximação",pt:"câmera se aproximando lentamente da obra (push-in)",en:"camera slowly pushing in toward the construction"},{id:"pullback",icon:"⬅️",name:"Afastamento",pt:"câmera afastando para revelar o entorno (pull-back)",en:"camera pulling back to reveal the surroundings"},{id:"crane_tl",icon:"🏗️",name:"Grua/Crane",pt:"movimento de grua subindo enquanto a obra cresce",en:"crane movement rising as the build grows"},{id:"fpv",icon:"🚀",name:"FPV",pt:"drone FPV atravessando dinamicamente a obra",en:"FPV drone flying dynamically through the site"}];
const CON_TL_PHASES=[{id:"limpeza",icon:"🧹",name:"Limpeza",pt:"limpeza e preparação do terreno",en:"site clearing and preparation"},{id:"terraplanagem",icon:"🚜",name:"Terraplanagem",pt:"terraplanagem e movimentação de terra",en:"earthworks and earth moving"},{id:"fundacao",icon:"🕳️",name:"Fundação",pt:"escavação e fundação/baldrame",en:"excavation and foundation/footings"},{id:"estrutura",icon:"🏗️",name:"Estrutura",pt:"estrutura de pilares e lajes subindo",en:"columns and slabs rising"},{id:"alvenaria",icon:"🧱",name:"Alvenaria",pt:"levantamento das paredes de alvenaria",en:"masonry walls going up"},{id:"cobertura",icon:"🏠",name:"Cobertura",pt:"montagem do telhado/cobertura",en:"roof installation"},{id:"instalacoes",icon:"🔧",name:"Instalações",pt:"instalações elétricas e hidráulicas",en:"electrical and plumbing installations"},{id:"reboco",icon:"🪣",name:"Reboco",pt:"reboco e chapisco das paredes",en:"plastering and rendering of walls"},{id:"esquadrias",icon:"🪟",name:"Esquadrias",pt:"instalação de janelas e portas",en:"installation of windows and doors"},{id:"pintura",icon:"🎨",name:"Pintura",pt:"pintura das fachadas",en:"painting of the facades"},{id:"acabamento",icon:"✨",name:"Acabamento",pt:"acabamento e revestimentos finais",en:"finishing and final cladding"},{id:"paisagismo",icon:"🌷",name:"Paisagismo",pt:"paisagismo e área externa finalizada",en:"landscaping and finished surroundings"}];
const CON_TL_WORKERS=[{id:"none",icon:"🚫",name:"Sem pessoas",pt:"",en:""},{id:"operarios",icon:"👷",name:"Operários",pt:"operários trabalhando ativamente",en:"construction workers actively working"},{id:"escavadeira",icon:"🚜",name:"Escavadeira",pt:"escavadeiras e tratores em movimento",en:"excavators and tractors moving"},{id:"grua",icon:"🏗️",name:"Guindaste",pt:"guindastes e gruas operando",en:"cranes operating"},{id:"caminhoes",icon:"🚛",name:"Caminhões",pt:"caminhões de obra entrando e saindo",en:"construction trucks coming and going"},{id:"betoneira",icon:"🛻",name:"Betoneira",pt:"caminhões betoneira despejando concreto",en:"concrete mixer trucks pouring concrete"},{id:"andaimes",icon:"🪜",name:"Andaimes",pt:"andaimes sendo montados ao redor da obra",en:"scaffolding being assembled around the build"},{id:"retroescavadeira",icon:"🚧",name:"Retroescavadeira",pt:"retroescavadeira cavando",en:"backhoe digging"},{id:"rolo",icon:"🛞",name:"Rolo Compactador",pt:"rolo compactador nivelando o solo",en:"road roller compacting the ground"},{id:"guincho",icon:"🪝",name:"Munck",pt:"caminhão munck içando materiais",en:"crane truck hoisting materials"},{id:"engenheiros",icon:"📋",name:"Engenheiros",pt:"engenheiros com pranchetas inspecionando",en:"engineers with clipboards inspecting"}];
const CON_TL_DURATION=[{id:"",icon:"🚫",name:"Sem definir"},{id:"3s",icon:"⏱️",name:"3 segundos",pt:"3 segundos",en:"3 seconds"},{id:"5s",icon:"⏱️",name:"5 segundos",pt:"5 segundos",en:"5 seconds"},{id:"8s",icon:"⏱️",name:"8 segundos",pt:"8 segundos",en:"8 seconds"},{id:"10s",icon:"⏱️",name:"10 segundos",pt:"10 segundos",en:"10 seconds"},{id:"15s",icon:"⏱️",name:"15 segundos",pt:"15 segundos",en:"15 seconds"},{id:"20s",icon:"⏰",name:"20 segundos",pt:"20 segundos",en:"20 seconds"}];

const CON_PLOT_VIEW=[{id:"aerea_orto",icon:"🛰️",name:"Ortofoto",pt:"vista aérea ortogonal (de cima, 90°) do terreno",en:"orthogonal aerial top-down view (90°) of the land"},{id:"aerea_45",icon:"🚁",name:"Aérea 45°",pt:"vista aérea em ângulo de 45° do terreno",en:"45-degree aerial view of the land"},{id:"aerea_baixa",icon:"🛸",name:"Aérea Baixa",pt:"vista aérea baixa e oblíqua, mais próxima",en:"low oblique aerial view, closer to the ground"},{id:"perspectiva",icon:"📐",name:"Perspectiva 3D",pt:"perspectiva 3D do loteamento",en:"3D perspective of the development"},{id:"isometrica",icon:"🧊",name:"Isométrica",pt:"vista isométrica 3D do loteamento",en:"isometric 3D view of the development"},{id:"passaro",icon:"🦅",name:"Olho de Pássaro",pt:"vista panorâmica de olho de pássaro",en:"panoramic birds-eye view"},{id:"manter_orig",icon:"📷",name:"Manter Foto",pt:"mantendo o mesmo ângulo da foto aérea original",en:"keeping the same angle as the original aerial photo"}];
const CON_PLOT_ELEMENTS=[{id:"lotes",icon:"🔲",name:"Divisão de Lotes",pt:"dividir o terreno em lotes demarcados com linhas claras",en:"divide the land into clearly outlined plots"},{id:"numeros",icon:"🔢",name:"Números nos Lotes",pt:"adicionar números em cada lote",en:"add numbers on each plot"},{id:"nomes",icon:"🏷️",name:"Nomes/Áreas",pt:"adicionar rótulos de nome/área em cada lote",en:"add name/area labels on each plot"},{id:"ruas",icon:"🛣️",name:"Ruas/Vias",pt:"traçar as ruas e vias de acesso",en:"draw the streets and access roads"},{id:"areas_verdes",icon:"🌳",name:"Áreas Verdes",pt:"marcar áreas verdes e praças",en:"mark green areas and squares"},{id:"quadras",icon:"🔳",name:"Quadras",pt:"organizar em quadras",en:"organize into blocks"},{id:"infra",icon:"💧",name:"Infraestrutura",pt:"indicar infraestrutura (água, esgoto, energia)",en:"indicate infrastructure (water, sewage, power)"}];
const CON_PLOT_STYLE=[{id:"realista",icon:"📷",name:"Realista",pt:"estilo fotorrealista de ortofoto",en:"photorealistic orthophoto style"},{id:"render3d",icon:"🧊",name:"Render 3D",pt:"render 3D de masterplan urbano",en:"3D urban masterplan render"},{id:"tecnico",icon:"📐",name:"Técnico/Mapa",pt:"estilo de planta técnica/mapa de loteamento com cotas",en:"technical site-plan/map style with measurements"},{id:"marketing",icon:"✨",name:"Marketing",pt:"estilo de material de vendas imobiliário premium",en:"premium real-estate sales material style"},{id:"maquete",icon:"🏘️",name:"Maquete",pt:"estilo de maquete física de loteamento",en:"physical scale-model style of the development"},{id:"blueprint_p",icon:"📘",name:"Blueprint",pt:"estilo blueprint técnico (linhas brancas em azul)",en:"technical blueprint style (white lines on blue)"},{id:"ilustrado",icon:"🎨",name:"Ilustrado",pt:"estilo ilustrado/cartoon amigável",en:"friendly illustrated/cartoon style"},{id:"satelite",icon:"🛰️",name:"Satélite",pt:"estilo de imagem de satélite com sobreposição de dados",en:"satellite-image style with data overlay"}];

// ---------- CONSTRUÇÃO: render + build ----------
function conMarkToggle(stateKey,label,sub){
 const on=GS.con[conMode][stateKey];
 return `<div class="gen-ref ${on?'on':''}" onclick="conToggleMark('${stateKey}')"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>${label}</b><span>${sub}</span></div></div>`;
}
function conToggleMark(k){GS.con[conMode][k]=!GS.con[conMode][k];renderGenControls();buildGen();}

function renderConControls(){
 // sub-abas dos 4 modos de construção
 let h=`<div class="gen-sec"><div class="gcat-row" style="gap:.4rem;">
   <button type="button" class="gcat ${conMode==='clean'?'active':''}" onclick="conSetMode('clean')">🧹 Limpar</button>
   <button type="button" class="gcat ${conMode==='build'?'active':''}" onclick="conSetMode('build')">🏠 Construir</button>
   <button type="button" class="gcat ${conMode==='timelapse'?'active':''}" onclick="conSetMode('timelapse')">🎬 Timelapse</button>
   <button type="button" class="gcat ${conMode==='plot'?'active':''}" onclick="conSetMode('plot')">📐 Loteamento</button>
  </div></div>`;
 if(conMode==='clean')h+=renderConClean();
 else if(conMode==='build')h+=renderConBuild();
 else if(conMode==='timelapse')h+=renderConTimelapse();
 else h+=renderConPlot();
 return h;
}
function conSetMode(m){conMode=m;appliedTips=new Set();renderGenControls();buildGen();}

function renderConClean(){
 const s=GS.con.clean;let h='';
 h+=sectionHTML('Imagem de referência',`<div class="gen-hint">Anexe a foto do terreno atual — será referenciada como <span class="gen-ph">[IMAGE 1]</span>. Se você marcou a área a limpar na foto, ative abaixo.</div>${conMarkToggle('marked','A foto tem a área marcada','Limpa só a região destacada')}`);
 h+=sectionHTML('1 · O que remover',`<div class="gopt-grid">${optGrid(CON_REMOVE_OPTS,s.remove,true,'conCleanRemove','name')}</div>`);
 h+=sectionHTML('2 · Tratamento do solo',`<div class="gopt-grid">${optGrid(CON_GROUND_OPTS,s.ground,false,'conCleanGround','name')}</div>`);
 h+=sectionHTML('3 · Manter algo?',`<input type="text" id="conCleanKeep" class="gen-in" placeholder="ex: manter a árvore grande do canto..." oninput="buildGen()">`);
 h+=sectionHTML('4 · Detalhes extras',`<textarea id="conCleanExtra" class="gen-in" placeholder="ex: manter a mesma perspectiva..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 return h;
}
function conCleanRemove(id){const r=GS.con.clean.remove;r.has(id)?r.delete(id):r.add(id);renderGenControls();buildGen();}
function conCleanGround(id){GS.con.clean.ground=id;renderGenControls();buildGen();}

function renderConBuild(){
 const s=GS.con.build;let h='';
 h+=sectionHTML('Imagem de referência',`<div class="gen-hint">Anexe a foto do terreno — <span class="gen-ph">[IMAGE 1]</span>. Se marcou onde a construção vai ficar, ative abaixo.</div>${conMarkToggle('marked','A foto tem a área da construção marcada','Posiciona a construção na região destacada')}`);
 h+=sectionHTML('1 · Fonte da construção',`<div class="gopt-grid">${optGrid([{id:"describe",icon:"✏️",name:"Descrever nova",desc:"Pelas opções abaixo"},{id:"refhouse",icon:"🏠",name:"Usar casa da foto",desc:"Aplicar [IMAGE 2]"},{id:"floorplan",icon:"📐",name:"Seguir Planta",desc:"Casa segue [IMAGE 2]"}],s.source,false,'conBuildSource','name')}</div>${s.source==='refhouse'?`<div class="gen-hint" style="margin-top:.5rem;">Anexe a casa/projeto pronto como <span class="gen-ph">[IMAGE 2]</span>. A IA insere no terreno no ângulo correto.</div>`:''}${s.source==='floorplan'?`<div class="gen-hint" style="margin-top:.5rem;">Anexe a planta baixa como <span class="gen-ph">[IMAGE 2]</span>. A IA constrói seguindo as paredes do projeto.</div>`:''}`);
 if(s.source!=='refhouse'){
  h+=sectionHTML('Tipo de empreendimento',`<div class="gopt-grid">${optGrid(CON_BUILD_TYPES,s.type,false,'conBuildType','name')}</div>`);
  h+=sectionHTML('Estilo arquitetônico',`<div class="gopt-grid">${optGrid(CON_ARCH_STYLES,s.arch,false,'conBuildArch','name')}</div>`);
  h+=sectionHTML('Materiais (vários)',`<div class="gopt-grid">${optGrid(CON_MATERIALS,s.mats,true,'conBuildMat','name')}</div>`);
 }
 h+=sectionHTML('Itens externos (vários)',`<div class="gopt-grid">${optGrid(CON_FEATURES,s.features,true,'conBuildFeat','name')}</div>`);
 h+=sectionHTML('Detalhes do imóvel',`<input type="text" id="conBuildDetails" class="gen-in" placeholder="ex: 3 quartos, fachada branca e madeira..." oninput="buildGen()">`);
 h+=sectionHTML('Ângulo / vista',`<div class="gopt-grid">${optGrid(CON_BUILD_VIEW,s.view,false,'conBuildView','name')}</div>`);
 h+=sectionHTML('Hora do dia',`<div class="gopt-grid">${optGrid(CON_TIMEOFDAY,s.time,false,'conBuildTime','name')}</div>`);
 h+=sectionHTML('Detalhes extras',`<textarea id="conBuildExtra" class="gen-in" placeholder="ex: manter o entorno e casas vizinhas..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 return h;
}
function conBuildSource(id){GS.con.build.source=id;renderGenControls();buildGen();}
function conBuildType(id){GS.con.build.type=id;renderGenControls();buildGen();}
function conBuildArch(id){GS.con.build.arch=id;renderGenControls();buildGen();}
function conBuildMat(id){const m=GS.con.build.mats;if(id==='none'){GS.con.build.mats=new Set();}else{m.has(id)?m.delete(id):m.add(id);}renderGenControls();buildGen();}
function conBuildFeat(id){const f=GS.con.build.features;f.has(id)?f.delete(id):f.add(id);renderGenControls();buildGen();}
function conBuildView(id){GS.con.build.view=id;renderGenControls();buildGen();}
function conBuildTime(id){GS.con.build.time=id;renderGenControls();buildGen();}

function renderConTimelapse(){
 const s=GS.con.timelapse;let h='';
 h+=sectionHTML('Modo de frames',`<div class="gen-hint">${s.twoFrames?'<b>Duas imagens:</b> <span class="gen-ph">[IMAGE 1]</span> = terreno vazio e <span class="gen-ph">[IMAGE 2]</span> = imóvel pronto.':'<b>Uma imagem:</b> <span class="gen-ph">[IMAGE 1]</span> = imóvel pronto. Gera em reverso — inverta o vídeo no editor.'}</div><div class="gen-ref ${s.twoFrames?'on':''}" onclick="conTlFrames()"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>Usar duas imagens (início e fim)</b><span>Desligue para imagem única com reversão</span></div></div>`);
 h+=sectionHTML('Guia da construção',`<div class="gopt-grid">${optGrid([{id:"free",icon:"🏗️",name:"Livre",desc:"Sobe pelas fases"},{id:"floorplan",icon:"📐",name:"Seguir Planta",desc:"Paredes do projeto"}],s.guide,false,'conTlGuide','name')}</div>${s.guide==='floorplan'?`<div class="gen-hint" style="margin-top:.5rem;">Anexe a planta baixa como <span class="gen-ph">${s.twoFrames?'[IMAGE 3]':'[IMAGE 2]'}</span>. As paredes sobem seguindo o projeto.</div>`:''}`);
 h+=sectionHTML('1 · Câmera',`<div class="gopt-grid">${optGrid(CON_TL_CAM,s.cam,false,'conTlCam','name')}</div>`);
 h+=sectionHTML('2 · Fases visíveis (várias)',`<div class="gopt-grid">${optGrid(CON_TL_PHASES,s.phases,true,'conTlPhase','name')}</div>`);
 h+=sectionHTML('3 · Pessoas & máquinas (vários)',`<div class="gopt-grid">${optGrid(CON_TL_WORKERS,s.workers,true,'conTlWorker','name')}</div>`);
 h+=sectionHTML('4 · Duração',`<div class="gopt-grid">${optGrid(CON_TL_DURATION,s.duration,false,'conTlDuration','name')}</div>`);
 h+=sectionHTML('5 · Detalhes extras',`<textarea id="conTlExtra" class="gen-in" placeholder="ex: céu com nuvens correndo, sol nascendo e se pondo..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 return h;
}
function conTlFrames(){GS.con.timelapse.twoFrames=!GS.con.timelapse.twoFrames;renderGenControls();buildGen();}
function conTlGuide(id){GS.con.timelapse.guide=id;renderGenControls();buildGen();}
function conTlCam(id){GS.con.timelapse.cam=id;renderGenControls();buildGen();}
function conTlPhase(id){const p=GS.con.timelapse.phases;p.has(id)?p.delete(id):p.add(id);renderGenControls();buildGen();}
function conTlWorker(id){const w=GS.con.timelapse.workers;if(id==='none'){GS.con.timelapse.workers=new Set();}else{w.has(id)?w.delete(id):w.add(id);}renderGenControls();buildGen();}
function conTlDuration(id){GS.con.timelapse.duration=id;renderGenControls();buildGen();}

function renderConPlot(){
 const s=GS.con.plot;let h='';
 h+=sectionHTML('Imagem de referência',`<div class="gen-hint">Anexe a foto aérea do terreno — <span class="gen-ph">[IMAGE 1]</span>. Se já marcou os lotes, ative abaixo.</div>${conMarkToggle('marked','A foto já tem os lotes marcados','Segue as marcações existentes')}`);
 h+=sectionHTML('1 · Tipo de vista',`<div class="gopt-grid">${optGrid(CON_PLOT_VIEW,s.view,false,'conPlotView','name')}</div>`);
 h+=sectionHTML('2 · Elementos a adicionar (vários)',`<div class="gopt-grid">${optGrid(CON_PLOT_ELEMENTS,s.elements,true,'conPlotEl','name')}</div>`);
 h+=sectionHTML('3 · Estilo',`<div class="gopt-grid">${optGrid(CON_PLOT_STYLE,s.style,false,'conPlotStyle','name')}</div>`);
 h+=sectionHTML('4 · Texto / numeração',`<input type="text" id="conPlotLabels" class="gen-in" placeholder="ex: lotes de 1 a 24, Quadra A..." oninput="buildGen()">`);
 h+=sectionHTML('5 · Detalhes extras',`<textarea id="conPlotExtra" class="gen-in" placeholder="ex: cores para lotes vendidos e disponíveis..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 return h;
}
function conPlotView(id){GS.con.plot.view=id;renderGenControls();buildGen();}
function conPlotEl(id){const e=GS.con.plot.elements;e.has(id)?e.delete(id):e.add(id);renderGenControls();buildGen();}
function conPlotStyle(id){GS.con.plot.style=id;renderGenControls();buildGen();}

// build dispatcher para construção
function conL(o){return genLang==='pt'?o.pt:o.en;}
function buildCon(){
 if(conMode==='clean')return buildConClean();
 if(conMode==='build')return buildConBuild();
 if(conMode==='timelapse')return buildConTimelapse();
 return buildConPlot();
}

function buildConClean(){
 const s=GS.con.clean;const rem=[...s.remove].map(id=>conL(CON_REMOVE_OPTS.find(x=>x.id===id))).filter(Boolean);
 const ground=CON_GROUND_OPTS.find(x=>x.id===s.ground);
 const keep=gv('conCleanKeep'),extra=gv('conCleanExtra');const lines=[];
 if(genLang==='pt'){
  lines.push(`Edite a imagem do terreno mostrado em [IMAGE 1].`);
  lines.push(`TAREFA: limpar o terreno removendo ${rem.join(", ")}.`);
  if(s.marked)lines.push(`Limpe apenas a área destacada/marcada na imagem; mantenha o restante intacto.`);
  if(ground&&ground.pt)lines.push(`SOLO: ${ground.pt}.`);
  if(keep)lines.push(`PRESERVAR: ${keep}.`);
  lines.push(`Mantenha exatamente o mesmo ângulo, perspectiva, enquadramento e iluminação da foto original. Resultado fotorrealista.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }else{
  lines.push(`Edit the image of the lot shown in [IMAGE 1].`);
  lines.push(`TASK: clear the land by removing ${rem.join(", ")}.`);
  if(s.marked)lines.push(`Only clear the highlighted/marked area; keep the rest intact.`);
  if(ground&&ground.en)lines.push(`GROUND: ${ground.en}.`);
  if(keep)lines.push(`PRESERVE: ${keep}.`);
  lines.push(`Keep the exact same angle, perspective, framing and lighting as the original photo. Photorealistic result.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }
 const tips=genLang==='pt'?[{label:"📷 Travar perspectiva",add:"Não altere nada além da limpeza solicitada; preserve câmera, lente e proporções idênticas à original."},{label:"🌤️ Mesma luz e clima",add:"Mantenha a mesma hora do dia, sombras e condições climáticas da foto original."},{label:"🧹 Limpeza total",add:"Deixe o terreno completamente limpo, plano e pronto para o início da obra."}]:[{label:"📷 Lock perspective",add:"Change nothing beyond the requested cleanup; preserve identical camera, lens and proportions."},{label:"🌤️ Same light & weather",add:"Keep the same time of day, shadows and weather as the original photo."},{label:"🧹 Full cleanup",add:"Leave the land completely clear, flat and ready for construction."}];
 return {text:lines.join("\n\n"),tips};
}

function buildConBuild(){
 const s=GS.con.build;const type=CON_BUILD_TYPES.find(x=>x.id===s.type);const arch=CON_ARCH_STYLES.find(x=>x.id===s.arch);
 const mats=[...s.mats].map(id=>conL(CON_MATERIALS.find(x=>x.id===id))).filter(Boolean);
 const feats=[...s.features].map(id=>conL(CON_FEATURES.find(x=>x.id===id))).filter(Boolean);
 const view=CON_BUILD_VIEW.find(x=>x.id===s.view);const time=CON_TIMEOFDAY.find(x=>x.id===s.time);
 const details=gv('conBuildDetails'),extra=gv('conBuildExtra');
 const useRef=s.source==='refhouse',useFp=s.source==='floorplan';const lines=[];
 if(genLang==='pt'){
  if(useRef){lines.push(`Edite a imagem do terreno em [IMAGE 1], inserindo nele a casa/projeto mostrado em [IMAGE 2].`);lines.push(`Posicione a construção de [IMAGE 2] sobre o terreno respeitando o ângulo, a perspectiva e a escala corretos da foto. A construção deve parecer naturalmente assentada no local.`);if(s.marked)lines.push(`Posicione-a exatamente sobre a área marcada no terreno.`);}
  else if(useFp){lines.push(`Edite a imagem do terreno em [IMAGE 1], construindo uma casa que segue exatamente a planta baixa mostrada em [IMAGE 2].`);lines.push(`A construção deve respeitar fielmente as paredes, divisões de cômodos, dimensões e proporções da planta. Erga a edificação tridimensional a partir desse layout.`);lines.push(`CONSTRUÇÃO: ${type.pt}, com ${arch.pt}.`);if(mats.length)lines.push(`MATERIAIS: ${mats.join(", ")}.`);if(s.marked)lines.push(`Posicione-a exatamente sobre a área marcada.`);}
  else{lines.push(`Edite a imagem do terreno em [IMAGE 1], adicionando uma construção no local.`);lines.push(`CONSTRUÇÃO: ${type.pt}, com ${arch.pt}.`);if(s.marked)lines.push(`Posicione a construção exatamente sobre a área marcada na imagem.`);if(mats.length)lines.push(`MATERIAIS: ${mats.join(", ")}.`);}
  if(details)lines.push(`${useRef?'AJUSTES':'CARACTERÍSTICAS'}: ${details}.`);
  if(feats.length)lines.push(`ÁREA EXTERNA: ${feats.join(", ")}.`);
  lines.push(`VISTA: ${view.pt}.`);
  if(time&&time.pt)lines.push(`ILUMINAÇÃO: ${time.pt}.`);
  lines.push(`Integre a construção de forma realista ao terreno e ao entorno existente, com sombras e perspectiva corretas. Resultado fotorrealista de alta qualidade.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }else{
  if(useRef){lines.push(`Edit the image of the lot in [IMAGE 1], inserting the house/project shown in [IMAGE 2].`);lines.push(`Place the building from [IMAGE 2] onto the lot respecting the correct angle, perspective and scale. It must look naturally seated on the site.`);if(s.marked)lines.push(`Place it exactly over the marked area.`);}
  else if(useFp){lines.push(`Edit the image of the lot in [IMAGE 1], building a house that exactly follows the floor plan shown in [IMAGE 2].`);lines.push(`The construction must faithfully respect the walls, room divisions, dimensions and proportions of the floor plan. Raise the 3D building from that layout.`);lines.push(`BUILDING: ${type.en}, with ${arch.en}.`);if(mats.length)lines.push(`MATERIALS: ${mats.join(", ")}.`);if(s.marked)lines.push(`Place it exactly over the marked area.`);}
  else{lines.push(`Edit the image of the lot in [IMAGE 1], adding a building on the site.`);lines.push(`BUILDING: ${type.en}, with ${arch.en}.`);if(s.marked)lines.push(`Place the building exactly over the marked area.`);if(mats.length)lines.push(`MATERIALS: ${mats.join(", ")}.`);}
  if(details)lines.push(`${useRef?'ADJUSTMENTS':'FEATURES'}: ${details}.`);
  if(feats.length)lines.push(`EXTERIOR: ${feats.join(", ")}.`);
  lines.push(`VIEW: ${view.en}.`);
  if(time&&time.en)lines.push(`LIGHTING: ${time.en}.`);
  lines.push(`Integrate the building realistically into the lot and existing surroundings, with correct shadows and perspective. High-quality photorealistic result.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }
 const tips=genLang==='pt'?[{label:"🌳 Manter o entorno",add:"Preserve as construções vizinhas, ruas e vegetação ao redor exatamente como na foto original."},{label:"🏠 Mostrar interior",add:"Inclua um leve vislumbre do interior iluminado através das janelas de vidro."},{label:"✨ Render premium",add:"Qualidade de render arquitetônico premium, 8K, materiais físicos realistas, ideal para material de venda."},{label:"👨‍👩‍👧 Vida no local",add:"Adicione pessoas, carros e elementos de vida cotidiana para dar escala e realismo."}]:[{label:"🌳 Keep surroundings",add:"Preserve neighboring buildings, streets and vegetation exactly as in the original photo."},{label:"🏠 Show interior",add:"Include a subtle glimpse of the lit interior through the glass windows."},{label:"✨ Premium render",add:"Premium architectural render quality, 8K, realistic PBR materials, ideal for sales material."},{label:"👨‍👩‍👧 Life on site",add:"Add people, cars and everyday-life elements for scale and realism."}];
 return {text:lines.join("\n\n"),tips};
}

function buildConTimelapse(){
 const s=GS.con.timelapse;const cam=CON_TL_CAM.find(x=>x.id===s.cam);
 const phases=[...s.phases].map(id=>conL(CON_TL_PHASES.find(x=>x.id===id))).filter(Boolean);
 const workers=[...s.workers].map(id=>conL(CON_TL_WORKERS.find(x=>x.id===id))).filter(Boolean);
 const dur=CON_TL_DURATION.find(x=>x.id===s.duration);const extra=gv('conTlExtra');
 const planImg=s.twoFrames?'[IMAGE 3]':'[IMAGE 2]';const usefp=s.guide==='floorplan';const lines=[];
 if(genLang==='pt'){
  if(s.twoFrames)lines.push(`Gere um vídeo timelapse de construção partindo de [IMAGE 1] (terreno vazio) e terminando em [IMAGE 2] (imóvel pronto).`);
  else lines.push(`Gere um vídeo timelapse de construção em REVERSO a partir de [IMAGE 1] (imóvel pronto): a construção se desfaz progressivamente até restar o terreno vazio. (Inverta o vídeo no editor para a obra avançar.)`);
  if(usefp)lines.push(`PLANTA BAIXA: use a planta baixa em ${planImg} como guia exato — erga as paredes, divisórias e cômodos seguindo precisamente as posições e dimensões do projeto.`);
  lines.push(`PASSAGEM DE TEMPO: mostre a obra evoluindo rapidamente pelas fases — ${phases.join(", ")}.`);
  if(workers.length)lines.push(`ATIVIDADE: ${workers.join(", ")}, em movimento acelerado.`);
  lines.push(`CÂMERA: ${cam.pt}.`);
  if(dur&&dur.pt)lines.push(`DURAÇÃO: ${dur.pt}.`);
  lines.push(`Estilo timelapse fotorrealista, com nuvens e sombras se movendo rápido, transição fluida entre as fases.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }else{
  if(s.twoFrames)lines.push(`Generate a construction timelapse video starting from [IMAGE 1] (empty lot) and ending at [IMAGE 2] (finished building).`);
  else lines.push(`Generate a REVERSE construction timelapse from [IMAGE 1] (finished building): the building progressively deconstructs until only the empty lot remains. (Reverse the clip in your editor.)`);
  if(usefp)lines.push(`FLOOR PLAN: use the floor plan in ${planImg} as an exact guide — raise the walls, partitions and rooms precisely following the plan.`);
  lines.push(`TIME PROGRESSION: show the build evolving rapidly through phases — ${phases.join(", ")}.`);
  if(workers.length)lines.push(`ACTIVITY: ${workers.join(", ")}, in fast motion.`);
  lines.push(`CAMERA: ${cam.en}.`);
  if(dur&&dur.en)lines.push(`DURATION: ${dur.en}.`);
  lines.push(`Photorealistic timelapse style, with clouds and shadows moving fast, smooth transitions.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }
 const tips=genLang==='pt'?[{label:"☁️ Céu dinâmico",add:"Adicione nuvens correndo pelo céu e o sol cruzando o horizonte para reforçar a passagem do tempo."},{label:"🔍 Miniatura (tilt-shift)",add:"Aplique forte efeito tilt-shift de miniatura para um visual charmoso de maquete."},{label:"🌙 Dia e noite",add:"Inclua ciclos de dia e noite com as luzes da obra acendendo ao anoitecer."},{label:"🎬 Final cinematográfico",add:"Termine com uma revelação aérea cinematográfica do imóvel pronto ao golden hour."}]:[{label:"☁️ Dynamic sky",add:"Add clouds racing across the sky and the sun crossing the horizon to reinforce time passing."},{label:"🔍 Miniature (tilt-shift)",add:"Apply a strong tilt-shift miniature effect for a charming scale-model look."},{label:"🌙 Day and night",add:"Include day-night cycles with site lights turning on at dusk."},{label:"🎬 Cinematic ending",add:"End with a cinematic aerial reveal of the finished building at golden hour."}];
 return {text:lines.join("\n\n"),tips};
}

function buildConPlot(){
 const s=GS.con.plot;const view=CON_PLOT_VIEW.find(x=>x.id===s.view);const style=CON_PLOT_STYLE.find(x=>x.id===s.style);
 const els=[...s.elements].map(id=>conL(CON_PLOT_ELEMENTS.find(x=>x.id===id))).filter(Boolean);
 const labels=gv('conPlotLabels'),extra=gv('conPlotExtra');const lines=[];
 if(genLang==='pt'){
  lines.push(`Edite a imagem aérea do terreno em [IMAGE 1] para criar um projeto de loteamento.`);
  lines.push(`VISTA: ${view.pt}.`);
  if(s.marked)lines.push(`Siga as divisões/marcações já presentes na imagem.`);
  if(els.length)lines.push(`ELEMENTOS: ${els.join("; ")}.`);
  if(labels)lines.push(`TEXTOS/NUMERAÇÃO: ${labels}.`);
  lines.push(`ESTILO: ${style.pt}. Linhas de demarcação nítidas e legíveis, texto claro.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }else{
  lines.push(`Edit the aerial image of the land in [IMAGE 1] to create a land subdivision plan.`);
  lines.push(`VIEW: ${view.en}.`);
  if(s.marked)lines.push(`Follow the divisions/markings already present in the image.`);
  if(els.length)lines.push(`ELEMENTS: ${els.join("; ")}.`);
  if(labels)lines.push(`LABELS/NUMBERING: ${labels}.`);
  lines.push(`STYLE: ${style.en}. Crisp readable demarcation lines, clear text.`);
  if(extra)lines.push(`EXTRA: ${extra}.`);
 }
 const tips=genLang==='pt'?[{label:"🎨 Cores por status",add:"Use cores diferentes para lotes vendidos (vermelho), reservados (amarelo) e disponíveis (verde)."},{label:"📍 Legenda",add:"Adicione uma legenda explicando as cores e a numeração dos lotes."},{label:"🏞️ Contexto",add:"Mostre o entorno (ruas principais, comércio próximo) para valorizar a localização."}]:[{label:"🎨 Color by status",add:"Use different colors for sold (red), reserved (yellow) and available (green) plots."},{label:"📍 Legend",add:"Add a legend explaining the colors and plot numbering."},{label:"🏞️ Context",add:"Show the surroundings (main roads, nearby commerce) to highlight the location."}];
 return {text:lines.join("\n\n"),tips};
}

// ---------- ESTADO ----------
const GS={
 img:{subject:"man",fieldMem:{person:{},animal:{},product:{}},locCat:"Externo",loc:"street",light:"natural",mood:"none",style:"photoreal",aspect:"",refs:{subject:false,product:false,location:false},extra:{},cons:false,consKeep:genConsKeepDefault(),emotion:"none",textures:new Set()},
 txt:{font:"balloon",matCat:"Cremosos",mats:new Set(),textures:new Set(["none"]),particles:new Set(["none"]),bgCat:"Cores",bg:"solid_white",light:"studio_soft",realism:"cartoon3d",dim:"3d",hard:0,dens:0,gloss:0,matColor:""},
 emo:{emoji:"🐺",matCat:"macios",mat:"plush",styleCat:"3d",style:"pixar3d"},
 vid:{submode:"text",subject:"woman",fieldMem:{person:{},animal:{},product:{},scene:{}},locCat:"Externo",loc:"street",camCat:"Dolly/Zoom",camMoves:new Set(),light:"cinematic",style:"cinematic",audio:new Set(["ambience"]),audioMem:{},cons:false,consKeep:genConsKeepDefault(),emotion:"none",textures:new Set()},
 logo:{objCat:"Vestível",objs:new Set(["enamel_pin"]),matCat:"Metais",mats:new Set(),surfCat:"Estúdio",surface:"white_studio",light:"studio",style:"photoreal",aspect:""},
 char:{type:"human",arch:"hero",age:"young",build:"athletic",shape:"auto",palette:"auto",textures:new Set(["none"]),styleCat:"2D/Desenho",style:"anime",view:"fullbody",light:"soft",bgCat:"Liso",bg:"white",aspect:""},
 con:{clean:{remove:new Set(["mato"]),ground:"nivelar",marked:true},build:{source:"describe",type:"casa_terrea",arch:"contemporaneo",mats:new Set(),features:new Set(["jardim"]),view:"manter",time:"dia",marked:true},timelapse:{twoFrames:true,guide:"free",cam:"aerea",phases:new Set(["estrutura","alvenaria","acabamento"]),workers:new Set(["operarios"]),duration:"5s"},plot:{view:"aerea_orto",elements:new Set(["lotes","numeros","ruas"]),style:"realista",marked:true}}
};
let conMode='clean';

// ---------- NAV ----------
function openGenerator(){
  setTimeout(()=>setPage('generator'),0);
  registrarNoHistorico('generator');
 // Gate de plano: gerador é isca do trial + exclusivo do Premium
 if(!PROMPTART.user.has_generator){
  showUpsell(t('upsell_generator'));
  return;
 }
 hideAllPages();   // idem: a Comunidade ficava visível abaixo do gerador
 document.getElementById('generatorPage').classList.add('active');
 document.getElementById('headerSearchWrap').style.display='none';
 document.getElementById('headerNewBtn')?.style.setProperty('display','none');
 setGenMode('image');
}
function setGenMode(m){
 genMode=m;
 document.getElementById('tabImg').classList.toggle('active',m==='image');
 document.getElementById('tabTxt').classList.toggle('active',m==='text');
 document.getElementById('tabEmo').classList.toggle('active',m==='emoji');
 document.getElementById('tabVid').classList.toggle('active',m==='video');
 document.getElementById('tabLogo').classList.toggle('active',m==='logo');
 document.getElementById('tabChar').classList.toggle('active',m==='char');
 document.getElementById('tabCon').classList.toggle('active',m==='con');
 document.getElementById('tabRet').classList.toggle('active',m==='retouch');
 document.getElementById('tabPoster').classList.toggle('active',m==='poster');
 renderGenControls();
 buildGen();
}
function resetGen(){
 if(genMode==='image'){
  GS.img={subject:"man",fieldMem:{person:{},animal:{},product:{}},locCat:"Externo",loc:"street",light:"natural",mood:"none",style:"photoreal",aspect:"",refs:{subject:false,product:false,location:false},extra:{},cons:false,consKeep:genConsKeepDefault(),emotion:"none",textures:new Set()};
 } else if(genMode==='text'){
  GS.txt={font:"balloon",matCat:"Cremosos",mats:new Set(),textures:new Set(["none"]),particles:new Set(["none"]),bgCat:"Cores",bg:"solid_white",light:"studio_soft",realism:"cartoon3d",dim:"3d",hard:0,dens:0,gloss:0,matColor:""};
 } else if(genMode==='emoji'){
  GS.emo={emoji:"🐺",matCat:"macios",mat:"plush",styleCat:"3d",style:"pixar3d"};
 } else if(genMode==='video'){
  GS.vid={submode:"text",subject:"woman",fieldMem:{person:{},animal:{},product:{},scene:{}},locCat:"Externo",loc:"street",camCat:"Dolly/Zoom",camMoves:new Set(),light:"cinematic",style:"cinematic",audio:new Set(["ambience"]),audioMem:{},cons:false,consKeep:genConsKeepDefault(),emotion:"none",textures:new Set()};
 } else if(genMode==='logo'){
  GS.logo={objCat:"Vestível",objs:new Set(["enamel_pin"]),matCat:"Metais",mats:new Set(),surfCat:"Estúdio",surface:"white_studio",light:"studio",style:"photoreal",aspect:""};
 } else if(genMode==='char'){
  GS.char={type:"human",arch:"hero",age:"young",build:"athletic",shape:"auto",palette:"auto",textures:new Set(["none"]),styleCat:"2D/Desenho",style:"anime",view:"fullbody",light:"soft",bgCat:"Liso",bg:"white",aspect:""};
 } else if(genMode==='retouch'){
  GS.ret={op:"bg_remove",style:"photoreal",bgColor:"",extras:new Set()};
 } else if(genMode==='poster'){
  GS.poster={type:"cinematico",aspect:"16:9",style:"photoreal",layout:"vertical",light:"dramatic",mood:"moody",extras:new Set()};
 } else {
  GS.con={clean:{remove:new Set(["mato"]),ground:"nivelar",marked:true},build:{source:"describe",type:"casa_terrea",arch:"contemporaneo",mats:new Set(),features:new Set(["jardim"]),view:"manter",time:"dia",marked:true},timelapse:{twoFrames:true,guide:"free",cam:"aerea",phases:new Set(["estrutura","alvenaria","acabamento"]),workers:new Set(["operarios"]),duration:"5s"},plot:{view:"aerea_orto",elements:new Set(["lotes","numeros","ruas"]),style:"realista",marked:true}};
 }
 const pfx={image:'img',text:'txt',emoji:'emo',video:'vid',logo:'logo',char:'char',con:'con',retouch:'ret',poster:'poster'}[genMode];
 if(pfx){for(const id in GTXT){if(id.toLowerCase().startsWith(pfx))delete GTXT[id];}}
 appliedTips=new Set();
 renderGenControls();
 buildGen();
 showToast(t('gen_reset'));
}
function setGenLang(l){genLang=l;document.querySelectorAll('.gen-lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));buildGen();}

// ═══ GERADOR: RETOQUE ═══
const RET_OPS=[
 {id:"bg_remove",icon:"✂️",name:"Remover Fundo",desc:"Fundo transparente/novo"},
 {id:"bg_replace",icon:"🖼️",name:"Trocar Fundo",desc:"Manter sujeito, mudar cenário"},
 {id:"skin",icon:"✨",name:"Retoque de Pele",desc:"Correção, suavização"},
 {id:"obj_remove",icon:"🗑️",name:"Remover Objeto",desc:"Apagar elemento indesejado"},
 {id:"light_fix",icon:"💡",name:"Corrigir Iluminação",desc:"Ajustar luz/sombra"},
 {id:"color_grade",icon:"🎨",name:"Gradear Cor",desc:"Cor cinematográfica"},
 {id:"upscale",icon:"🔍",name:"Aumentar Qualidade",desc:"Resolução e nitidez"},
 {id:"face_swap",icon:"🎭",name:"Troca de Identidade",desc:"Substituir rosto/identidade"},
 {id:"clothing",icon:"👗",name:"Trocar Roupa",desc:"Mudar vestimenta"},
 {id:"age",icon:"👴",name:"Mudar Idade",desc:"Envelhecer ou rejuvenescer"},
 {id:"hair",icon:"💈",name:"Mudar Cabelo",desc:"Cor, comprimento, estilo"},
 {id:"expression",icon:"😊",name:"Mudar Expressão",desc:"Alterar emoção do rosto"},
 {id:"composite",icon:"🌀",name:"Compositing",desc:"Inserir elemento em cena"},
 {id:"product_clean",icon:"📦",name:"Limpar Produto",desc:"Remover imperfeições"},
];
const RET_STYLES=[
 {id:"photoreal",icon:"📷",name:"Fotorrealista",desc:"Parece foto real"},
 {id:"cinematic",icon:"🎥",name:"Cinemático",desc:"Cor de filme"},
 {id:"editorial",icon:"📰",name:"Editorial",desc:"Revista, moda"},
 {id:"commercial",icon:"🛍️",name:"Comercial",desc:"E-commerce, limpo"},
 {id:"natural",icon:"🌿",name:"Natural",desc:"Sem exageros"},
 {id:"artistic",icon:"🎨",name:"Artístico",desc:"Estilizado, criativo"},
];
const RET_BG_OPTS=[
 {id:"white",icon:"⬜",name:"Branco",en:"clean white seamless background"},
 {id:"black",icon:"⬛",name:"Preto",en:"deep black background"},
 {id:"studio_gray",icon:"🌫️",name:"Cinza Estúdio",en:"professional gray studio backdrop"},
 {id:"gradient",icon:"🌅",name:"Degradê",en:"smooth gradient background"},
 {id:"outdoor",icon:"🌿",name:"Externo/Natureza",en:"natural outdoor environment"},
 {id:"urban",icon:"🌆",name:"Urbano",en:"urban city background with bokeh"},
 {id:"interior",icon:"🏠",name:"Interior",en:"interior room background"},
 {id:"custom",icon:"✏️",name:"Descrever",en:""},
];

const RET_EXTRAS=[
 {id:"sharp",icon:"🔬",name:"Nitidez máxima",en:"ultra-sharp focus, maximum detail"},
 {id:"shadow",icon:"🌑",name:"Sombra natural",en:"natural cast shadow on surface"},
 {id:"reflection",icon:"🪞",name:"Reflexo",en:"subtle reflection on surface"},
 {id:"color_match",icon:"🎨",name:"Igualar cor",en:"match color temperature and exposure to background"},
 {id:"edge_clean",icon:"✂️",name:"Borda limpa",en:"perfect clean edges, no halo artifacts"},
 {id:"grain",icon:"📸",name:"Grão de filme",en:"natural film grain overlay for cohesion"},
];

let GS_ret={op:"bg_remove",style:"photoreal",bgOpt:"white",extras:new Set()};

function renderRetouchControls(){
 let h='';
 h+=sectionHTML('1 · Operação',`<div class="gopt-grid">${optGrid(RET_OPS,GS_ret.op,false,'retPickOp','name')}</div>`);
 const needsBg=['bg_remove','bg_replace','composite'].includes(GS_ret.op);
 if(needsBg){
  h+=sectionHTML('2 · Fundo / Destino',`<div class="gopt-grid">${optGrid(RET_BG_OPTS,GS_ret.bgOpt,false,'retPickBg','name')}</div>
   ${GS_ret.bgOpt==='custom'?`<input type="text" id="retBgCustom" class="gen-in" placeholder="Descreva o fundo que quer..." oninput="buildGen()" style="margin-top:.4rem;">`:''}`);
 }
 if(GS_ret.op==='face_swap'){
  h+=sectionHTML('2 · Referência de identidade',`<div class="gen-hint">O prompt aponta para <span class="gen-ph">[IMAGEM 1]</span> = foto original e <span class="gen-ph">[IMAGEM 2]</span> = rosto/identidade de destino.</div>
   <input type="text" id="retFaceDesc" class="gen-in" placeholder="Descreva a nova identidade (opcional: nome, etnia, traços)..." oninput="buildGen()">`);
 }
 if(GS_ret.op==='composite'){
  h+=sectionHTML('Elemento a inserir',`<input type="text" id="retCompositeEl" class="gen-in" placeholder="ex: um copo de café, uma borboleta, fumaça..." oninput="buildGen()">`);
 }
 if(GS_ret.op==='obj_remove'){
  h+=sectionHTML('O que remover',`<input type="text" id="retObjDesc" class="gen-in" placeholder="ex: o poste ao fundo, a marca d'água, a pessoa à direita..." oninput="buildGen()">`);
 }
 if(GS_ret.op==='skin'){
  h+=sectionHTML('Nível de retoque',`<div class="gopt-grid">${optGrid([{id:"subtle",icon:"🌿",name:"Sutil",desc:"Natural"},{id:"moderate",icon:"✨",name:"Moderado",desc:"Editorial"},{id:"heavy",icon:"💎",name:"Intenso",desc:"Fashion/Beauty"}],GS_ret.skinLevel||'moderate',false,'retPickSkin','name')}</div>`);
 }
 if(['hair','clothing','age','expression'].includes(GS_ret.op)){
  const labels={hair:'Nova cor/estilo do cabelo',clothing:'Nova roupa (descreva)',age:'Descreva a idade alvo',expression:'Expressão desejada'};
  const phs={hair:'ex: loiro ondulado longo, corte curto preto...',clothing:'ex: terno azul escuro, vestido floral...',age:'ex: 60 anos, 20 anos...',expression:'ex: sorriso genuíno, olhar sério, surpresa...'};
  h+=sectionHTML(labels[GS_ret.op],`<input type="text" id="retDescField" class="gen-in" placeholder="${phs[GS_ret.op]||''}" oninput="buildGen()">`);
 }
 if(GS_ret.op==='color_grade'){
  h+=sectionHTML('Tom / preset',`<input type="text" id="retGradeDesc" class="gen-in" placeholder="ex: teal and orange, bleach bypass, vintage warm..." oninput="buildGen()">`);
 }
 h+=sectionHTML((needsBg?'3':'2')+' · Estilo de saída',`<div class="gopt-grid">${optGrid(RET_STYLES,GS_ret.style,false,'retPickStyle','name')}</div>`);
 h+=sectionHTML('Detalhes extras',`<textarea id="retExtra" class="gen-in" placeholder="ex: manter a roupa original, não alterar o fundo..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 h+=sectionHTML('Refinamentos opcionais',`<div class="gopt-grid">${optGrid(RET_EXTRAS,GS_ret.extras,true,'retToggleExtra','name')}</div>`);
 return h;
}
function retPickOp(id){GS_ret.op=id;renderGenControls();buildGen();}
function retPickBg(id){GS_ret.bgOpt=id;renderGenControls();buildGen();}
function retPickStyle(id){GS_ret.style=id;renderGenControls();buildGen();}
function retPickSkin(id){GS_ret.skinLevel=id;renderGenControls();buildGen();}
function retToggleExtra(id){const e=GS_ret.extras;e.has(id)?e.delete(id):e.add(id);renderGenControls();buildGen();}

function buildRetouch(){
 const L=genLang; const s=GS_ret;
 const op=RET_OPS.find(x=>x.id===s.op);
 const style=RET_STYLES.find(x=>x.id===s.style);
 if(!op)return{text:'',tips:[]};
 const bgItem=RET_BG_OPTS.find(x=>x.id===s.bgOpt);
 const bgCustom=(document.getElementById('retBgCustom')?.value||GTXT['retBgCustom']||'').trim();
 const bgDesc=s.bgOpt==='custom'?bgCustom:(bgItem?.en||'');
 const faceDesc=(document.getElementById('retFaceDesc')?.value||GTXT['retFaceDesc']||'').trim();
 const compositeEl=(document.getElementById('retCompositeEl')?.value||GTXT['retCompositeEl']||'').trim();
 const objDesc=(document.getElementById('retObjDesc')?.value||GTXT['retObjDesc']||'').trim();
 const descField=(document.getElementById('retDescField')?.value||GTXT['retDescField']||'').trim();
 const gradeDesc=(document.getElementById('retGradeDesc')?.value||GTXT['retGradeDesc']||'').trim();
 const extra=(document.getElementById('retExtra')?.value||GTXT['retExtra']||'').trim();
 const extras=[...s.extras].map(id=>RET_EXTRAS.find(x=>x.id===id)?.en).filter(Boolean);

 let lines=[];
 const pref=L==='pt'?'[IMAGEM 1] como base.':'Using [IMAGE 1] as the base image.';

 if(s.op==='bg_remove'){
  lines=[L==='en'
   ?`Remove the background from [IMAGE 1] completely. Isolate the subject with perfect edge masking — no halo, no fringe artifacts. Output: subject on ${bgDesc||'white background'}.`
   :`Remova o fundo de [IMAGEM 1] completamente. Isole o sujeito com mascaramento de borda perfeito — sem halo, sem artefatos de franja. Saída: sujeito em ${bgDesc||'fundo branco'}.`];
 } else if(s.op==='bg_replace'){
  lines=[L==='en'
   ?`Replace the background in [IMAGE 1], keeping the subject exactly as-is. New background: ${bgDesc||'[DESCRIBE BACKGROUND]'}. Match the lighting direction and color temperature of the original for a believable composite.`
   :`Troque o fundo em [IMAGEM 1], mantendo o sujeito exatamente como está. Novo fundo: ${bgDesc||'[DESCREVA O FUNDO]'}. Combine a direção e temperatura de cor da iluminação original para um composto convincente.`];
 } else if(s.op==='skin'){
  const lvl={subtle:'natural skin retouching — smooth minor blemishes only, keep pores and texture',moderate:'moderate editorial retouching — smooth skin, remove blemishes and under-eye circles, enhance color evenness',heavy:'beauty retouching — flawless skin texture, porcelain-smooth surface, enhanced luminosity, beauty editorial quality'};
  const lvlPt={subtle:'retoque natural de pele — suavize imperfeições menores apenas, mantenha poros e textura',moderate:'retoque editorial moderado — suavize a pele, remova manchas e olheiras, melhore a uniformidade da cor',heavy:'retoque de beleza — textura de pele impecável, superfície suave como porcelana, luminosidade aprimorada'};
  const level=s.skinLevel||'moderate';
  lines=[pref,L==='en'?`Apply ${lvl[level]} to the subject in [IMAGE 1].`:`Aplique ${lvlPt[level]} ao sujeito em [IMAGEM 1].`];
 } else if(s.op==='obj_remove'){
  lines=[L==='en'
   ?`In [IMAGE 1], remove: ${objDesc||'[DESCRIBE ELEMENT TO REMOVE]'}. Fill the area naturally using content-aware reconstruction — the background should look like the removed element was never there. Maintain original perspective and texture.`
   :`Em [IMAGEM 1], remova: ${objDesc||'[DESCREVA O ELEMENTO A REMOVER]'}. Preencha a área naturalmente usando reconstrução com IA — o fundo deve parecer que o elemento removido nunca esteve lá. Mantenha a perspectiva e textura originais.`];
 } else if(s.op==='light_fix'){
  lines=[pref,L==='en'
   ?`Correct the lighting in [IMAGE 1]: balance exposure, recover highlights and shadows, add professional three-point lighting setup. Make the subject pop from the background with improved depth.`
   :`Corrija a iluminação em [IMAGEM 1]: balanceie a exposição, recupere luzes e sombras, adicione configuração profissional de iluminação 3 pontos. Faça o sujeito se destacar do fundo com profundidade melhorada.`];
 } else if(s.op==='color_grade'){
  lines=[pref,L==='en'
   ?`Apply a cinematic color grade to [IMAGE 1]${gradeDesc?`: ${gradeDesc}`:''}. Adjust tone curves, color balance, saturation and contrast for a professional${style?.en?' '+style.en:''} look. Ensure skin tones remain natural.`
   :`Aplique uma gradação de cor cinemática a [IMAGEM 1]${gradeDesc?`: ${gradeDesc}`:''}. Ajuste curvas de tom, balanço de cor, saturação e contraste para um visual profissional${style?.en?' '+style.en:''}. Garanta que os tons de pele permaneçam naturais.`];
 } else if(s.op==='upscale'){
  lines=[L==='en'
   ?`Upscale and enhance [IMAGE 1] to maximum quality. Sharpen details, reconstruct fine textures (skin pores, hair strands, fabric weave), remove compression artifacts, and increase apparent resolution. Output: ultra-high detail, ${style?.en||'photorealistic'}.`
   :`Aumente a resolução e melhore [IMAGEM 1] para máxima qualidade. Afie detalhes, reconstrua texturas finas (poros, fios de cabelo, tecido), remova artefatos de compressão e aumente a resolução aparente. Saída: detalhe ultra-alto, ${style?.en||'fotorrealista'}.`];
 } else if(s.op==='face_swap'){
  lines=[L==='en'
   ?`Perform a photorealistic identity/face transplant: use [IMAGE 1] as the base photo and apply the facial identity from [IMAGE 2]${faceDesc?` (${faceDesc})`:''}. Preserve the original pose, lighting, expression and body from [IMAGE 1]. The result must look like a single natural photograph — no blending seams, matched skin tone and lighting.`
   :`Realize uma troca de identidade/rosto fotorrealista: use [IMAGEM 1] como foto base e aplique a identidade facial de [IMAGEM 2]${faceDesc?` (${faceDesc})`:''}. Preserve a pose original, iluminação, expressão e corpo de [IMAGEM 1]. O resultado deve parecer uma única fotografia natural — sem costuras de mistura, tom de pele e iluminação correspondentes.`];
 } else if(s.op==='clothing'){
  lines=[pref,L==='en'
   ?`Change the clothing in [IMAGE 1]. New outfit: ${descField||'[DESCRIBE CLOTHING]'}. Keep the person's face, pose, lighting and surroundings identical. The new clothing should be rendered with photorealistic fabric texture matching the original lighting direction.`
   :`Troque a roupa em [IMAGEM 1]. Nova roupa: ${descField||'[DESCREVA A ROUPA]'}. Mantenha o rosto, pose, iluminação e ambiente da pessoa idênticos. A nova roupa deve ser renderizada com textura de tecido fotorrealista correspondente à direção de iluminação original.`];
 } else if(s.op==='age'){
  lines=[pref,L==='en'
   ?`Age-transform the person in [IMAGE 1] to look ${descField||'[TARGET AGE]'}. Adjust skin texture, wrinkles/smoothness, hair color, and facial structure accordingly. Maintain identity, expression, pose, clothing and background.`
   :`Transforme a idade da pessoa em [IMAGEM 1] para parecer ${descField||'[IDADE ALVO]'}. Ajuste textura da pele, rugas/suavidade, cor do cabelo e estrutura facial. Mantenha identidade, expressão, pose, roupa e fundo.`];
 } else if(s.op==='hair'){
  lines=[pref,L==='en'
   ?`Change the hair in [IMAGE 1]: ${descField||'[DESCRIBE NEW HAIR]'}. Keep the person's face, expression, pose and background unchanged. Match the hair color and style realistically to the original lighting.`
   :`Troque o cabelo em [IMAGEM 1]: ${descField||'[DESCREVA O NOVO CABELO]'}. Mantenha o rosto, expressão, pose e fundo inalterados. Corresponda a cor e estilo do cabelo realisticamente à iluminação original.`];
 } else if(s.op==='expression'){
  lines=[pref,L==='en'
   ?`Change the facial expression of the person in [IMAGE 1] to: ${descField||'[DESCRIBE EXPRESSION]'}. Keep everything else — lighting, pose, clothing, background — exactly as in the original. The expression change must look believable and natural.`
   :`Troque a expressão facial da pessoa em [IMAGEM 1] para: ${descField||'[DESCREVA A EXPRESSÃO]'}. Mantenha tudo mais — iluminação, pose, roupa, fundo — exatamente como no original. A mudança de expressão deve parecer crível e natural.`];
 } else if(s.op==='composite'){
  lines=[L==='en'
   ?`Insert into [IMAGE 1]: ${compositeEl||'[DESCRIBE ELEMENT]'}. New background if needed: ${bgDesc||'keep original'}. The added element must blend seamlessly — match perspective, lighting direction, shadows, color temperature and scale. Output: a single believable photograph.`
   :`Insira em [IMAGEM 1]: ${compositeEl||'[DESCREVA O ELEMENTO]'}. Novo fundo se necessário: ${bgDesc||'manter original'}. O elemento adicionado deve se misturar perfeitamente — combine perspectiva, direção de iluminação, sombras, temperatura de cor e escala. Saída: uma única fotografia crível.`];
 } else if(s.op==='product_clean'){
  lines=[L==='en'
   ?`Retouch the product in [IMAGE 1] for commercial use: remove scratches, fingerprints, dust and imperfections; clean up the background; enhance reflections and material detail. Output: ${style?.en||'photorealistic'} e-commerce quality hero shot.`
   :`Retoque o produto em [IMAGEM 1] para uso comercial: remova arranhões, impressões digitais, poeira e imperfeições; limpe o fundo; aprimore reflexos e detalhes do material. Saída: foto hero de qualidade e-commerce ${style?.en||'fotorrealista'}.`];
 }

 if(style&&!['color_grade','upscale'].includes(s.op)){
  lines.push(L==='en'?`Overall style: ${style.en}.`:`Estilo geral: ${style.en}.`);
 }
 if(extra) lines.push(L==='en'?`Additional notes: ${extra}.`:`Notas adicionais: ${extra}.`);
 if(extras.length) lines.push(L==='en'?`Technical requirements: ${extras.join(', ')}.`:`Requisitos técnicos: ${extras.join(', ')}.`);

 const tips=L==='en'?[
  {label:"🔄 Apply to second image",add:"Apply the exact same retouching style and parameters to [IMAGE 2], maintaining complete visual consistency."},
  {label:"📐 Output format",add:"Output as isolated subject on transparent background (PNG), and also a version on white studio background."},
  {label:"🎨 Color variations",add:"Generate 3 color/lighting variations of the result — warm, cool, and neutral tones."},
  {label:"💎 Ultra quality",add:"Output at maximum possible quality: 8K resolution, zero compression artifacts, flawless edge masking."},
  {label:"📸 Comparison",add:"Create a before/after comparison showing the original [IMAGE 1] side-by-side with the retouched result."},
 ]:[
  {label:"🔄 Aplicar na 2ª imagem",add:"Aplique exatamente o mesmo estilo e parâmetros de retoque à [IMAGEM 2], mantendo consistência visual completa."},
  {label:"📐 Formato de saída",add:"Entregue o sujeito isolado em fundo transparente (PNG), e também uma versão em fundo branco de estúdio."},
  {label:"🎨 Variações de cor",add:"Gere 3 variações de cor/iluminação do resultado — tons quentes, frios e neutros."},
  {label:"💎 Ultra qualidade",add:"Saída na máxima qualidade possível: resolução 8K, zero artefatos de compressão, mascaramento de borda impecável."},
  {label:"📸 Comparação",add:"Crie uma comparação antes/depois mostrando a [IMAGEM 1] original lado a lado com o resultado retocado."},
 ];
 return {text:lines.join('\n\n'),tips};
}

// ═══ GERADOR: POSTER / ARTE GRÁFICA ═══
const POSTER_TYPES=[
 {id:"cinematico",icon:"🎬",name:"Pôster Cinemático",desc:"Key art, capa de filme"},
 {id:"broadcast",icon:"📺",name:"Vinheta / Broadcast",desc:"Arte para TV, abertura"},
 {id:"thumbnail",icon:"▶️",name:"Thumbnail/Capa",desc:"YouTube, streaming"},
 {id:"editorial",icon:"📰",name:"Editorial",desc:"Revista, artigo"},
 {id:"social",icon:"📱",name:"Social Media",desc:"Feed, Stories, Reels"},
 {id:"evento",icon:"🎪",name:"Flyer / Evento",desc:"Convite, divulgação"},
 {id:"arte",icon:"🎨",name:"Arte Gráfica",desc:"Expressão artística"},
 {id:"background",icon:"🌅",name:"Background Cênico",desc:"Cenário para composição"},
];
const POSTER_STYLES=[
 {id:"photoreal",icon:"📷",name:"Fotorrealista",desc:"Hiper-realista"},
 {id:"cinematic",icon:"🎥",name:"Cinemático",desc:"Color grade, anamórfico"},
 {id:"illustration",icon:"🖌️",name:"Ilustração",desc:"Pintado digital"},
 {id:"minimal",icon:"⚪",name:"Minimalista",desc:"Limpo, tipográfico"},
 {id:"retro",icon:"📻",name:"Retrô",desc:"Vintage, analógico"},
 {id:"3d_render",icon:"🧊",name:"3D/CGI",desc:"Render premium"},
 {id:"painterly",icon:"🎨",name:"Pintura",desc:"Óleo, textura"},
 {id:"neon_art",icon:"💡",name:"Neon/Synthwave",desc:"Luzes, grid"},
 {id:"comic",icon:"💥",name:"Comic/HQ",desc:"Quadrinhos"},
 {id:"anime",icon:"🌸",name:"Anime",desc:"Japonês, flat"},
];
const POSTER_MOODS=[
 {id:"epic",icon:"⚡",name:"Épico",desc:"Grandioso, emocionante",en:"epic, grand, emotionally powerful"},
 {id:"moody",icon:"🌑",name:"Sombrio",desc:"Dramático, tenso",en:"dark moody dramatic tension"},
 {id:"warm",icon:"🔥",name:"Quente",desc:"Acolhedor, otimista",en:"warm inviting optimistic"},
 {id:"cold",icon:"❄️",name:"Gelado",desc:"Tenso, suspenso",en:"cold tension suspense"},
 {id:"vibrant",icon:"🌈",name:"Vibrante",desc:"Energético, colorido",en:"vibrant energetic colorful"},
 {id:"minimalist",icon:"🤍",name:"Clean",desc:"Elegante, moderno",en:"clean elegant modern minimal"},
 {id:"nostalgic",icon:"📷",name:"Nostálgico",desc:"Retrô, saudade",en:"nostalgic vintage sentimental"},
 {id:"futuristic",icon:"🚀",name:"Futurista",desc:"Sci-fi, tech",en:"futuristic sci-fi technological"},
 {id:"festive",icon:"🎉",name:"Festivo",desc:"Alegre, comemorativo",en:"festive celebratory joyful"},
 {id:"mysterious",icon:"🌀",name:"Misterioso",desc:"Enigmático",en:"mysterious enigmatic intriguing"},
];
const POSTER_ASPECTS=[
 {id:"16:9",icon:"🖥️",name:"16:9 Wide"},{id:"9:16",icon:"📲",name:"9:16 Vertical"},
 {id:"1:1",icon:"⬛",name:"1:1 Quadrado"},{id:"4:5",icon:"📱",name:"4:5 Feed"},
 {id:"21:9",icon:"🎬",name:"21:9 Cinema"},{id:"4:3",icon:"📺",name:"4:3 Broadcast"},
 {id:"A4",icon:"📄",name:"A4 Retrato"},{id:"2:3",icon:"🖼️",name:"2:3 Pôster"},
];
const POSTER_LIGHTS=[
 {id:"dramatic",icon:"🎬",name:"Dramática",en:"dramatic high-contrast cinematic lighting"},
 {id:"golden",icon:"🌅",name:"Golden Hour",en:"warm golden-hour lighting"},
 {id:"neon",icon:"🟣",name:"Neon",en:"colorful neon lighting with color spill"},
 {id:"soft",icon:"💡",name:"Suave",en:"soft diffused editorial lighting"},
 {id:"rim",icon:"🌗",name:"Contraluz",en:"strong rim backlight creating silhouette separation"},
 {id:"god_rays",icon:"⛅",name:"God Rays",en:"dramatic volumetric god rays"},
 {id:"dark",icon:"🌑",name:"Low Key",en:"moody low-key lighting with deep blacks"},
 {id:"studio",icon:"📸",name:"Estúdio",en:"professional studio lighting"},
];
const POSTER_EXTRAS=[
 {id:"text_space",icon:"📝",name:"Espaço p/ texto",en:"leave clear space at top and bottom for title and credits text overlay"},
 {id:"logo_space",icon:"🏷️",name:"Espaço p/ logo",en:"leave designated space in top-left corner for logo placement"},
 {id:"safe_zone",icon:"📐",name:"Safe zone TV",en:"maintain broadcast-safe zone with 10% margin on all sides"},
 {id:"depth",icon:"🌊",name:"Profundidade",en:"strong depth of field creating foreground/midground/background separation"},
 {id:"particles",icon:"✨",name:"Partículas",en:"add atmospheric particles — dust, sparks, embers, or light particles"},
 {id:"lens_flare",icon:"☀️",name:"Lens Flare",en:"subtle cinematic lens flare"},
 {id:"vignette",icon:"⭕",name:"Vinheta",en:"subtle dark vignette around edges"},
 {id:"filmic",icon:"🎞️",name:"Look de filme",en:"35mm film look with natural grain and organic color"},
];

let GS_poster={type:"cinematico",style:"cinematic",aspect:"16:9",mood:"epic",light:"dramatic",extras:new Set()};

function renderPosterControls(){
 let h='';
 h+=sectionHTML('1 · Tipo de arte',`<div class="gopt-grid">${optGrid(POSTER_TYPES,GS_poster.type,false,'posterPickType','name')}</div>`);
 h+=sectionHTML('2 · Sujeito / conceito',`<textarea id="posterSubject" class="gen-in" placeholder="ex: astronauta olhando para a Terra, paisagem de uma cidade futurista inundada, logotipo Baianão com escudos..." oninput="buildGen()" style="min-height:70px;resize:vertical;line-height:1.5;"></textarea>
  <div class="gen-hint">Seja específico: quem/o quê está no centro visual, qual a cena ou ideia.</div>`);
 h+=sectionHTML('3 · Estilo visual',`<div class="gopt-grid">${optGrid(POSTER_STYLES,GS_poster.style,false,'posterPickStyle','name')}</div>`);
 h+=sectionHTML('4 · Clima / mood',`<div class="gopt-grid">${optGrid(POSTER_MOODS,GS_poster.mood,false,'posterPickMood','name')}</div>`);
 h+=sectionHTML('5 · Iluminação',`<div class="gopt-grid">${optGrid(POSTER_LIGHTS,GS_poster.light,false,'posterPickLight','name')}</div>`);
 h+=sectionHTML('6 · Proporção',`<div class="gopt-grid">${optGrid(POSTER_ASPECTS,GS_poster.aspect,false,'posterPickAspect','name')}</div>`);
 h+=sectionHTML('7 · Paleta de cor',`<input type="text" id="posterPalette" class="gen-in" placeholder="ex: azul e dourado, vermelho sangue e preto, vermelho e branco e verde..." oninput="buildGen()">`);
 h+=sectionHTML('Referências visuais',`<input type="text" id="posterRefs" class="gen-in" placeholder="ex: estilo Blade Runner 2049, paleta de Oppenheimer, look de Dune..." oninput="buildGen()">`);
 h+=sectionHTML('Detalhes extras',`<textarea id="posterExtra" class="gen-in" placeholder="ex: incluir favela ao fundo, reflexo na água, tempestade se aproximando..." oninput="buildGen()" style="min-height:50px;resize:vertical;"></textarea>`);
 h+=sectionHTML('Refinamentos opcionais',`<div class="gopt-grid">${optGrid(POSTER_EXTRAS,GS_poster.extras,true,'posterToggleExtra','name')}</div>`);
 return h;
}
function posterPickType(id){GS_poster.type=id;renderGenControls();buildGen();}
function posterPickStyle(id){GS_poster.style=id;renderGenControls();buildGen();}
function posterPickMood(id){GS_poster.mood=id;renderGenControls();buildGen();}
function posterPickLight(id){GS_poster.light=id;renderGenControls();buildGen();}
function posterPickAspect(id){GS_poster.aspect=id;renderGenControls();buildGen();}
function posterToggleExtra(id){const e=GS_poster.extras;e.has(id)?e.delete(id):e.add(id);renderGenControls();buildGen();}

function buildPoster(){
 const L=genLang; const s=GS_poster;
 const type=POSTER_TYPES.find(x=>x.id===s.type);
 const style=POSTER_STYLES.find(x=>x.id===s.style);
 const mood=POSTER_MOODS.find(x=>x.id===s.mood);
 const light=POSTER_LIGHTS.find(x=>x.id===s.light);
 const subject=(document.getElementById('posterSubject')?.value||GTXT['posterSubject']||'').trim();
 const palette=(document.getElementById('posterPalette')?.value||GTXT['posterPalette']||'').trim();
 const refs=(document.getElementById('posterRefs')?.value||GTXT['posterRefs']||'').trim();
 const extra=(document.getElementById('posterExtra')?.value||GTXT['posterExtra']||'').trim();
 const extras=[...s.extras].map(id=>POSTER_EXTRAS.find(x=>x.id===id)?.en).filter(Boolean);

 let lines=[];
 if(L==='en'){
  lines.push(`Create a ${type?.name||'poster'}: ${subject||'[DESCRIBE THE VISUAL CONCEPT]'}.`);
  lines.push(`VISUAL STYLE: ${style?.name||'cinematic'}${refs?`, inspired by ${refs}`:''}.`);
  lines.push(`MOOD & ATMOSPHERE: ${mood?.en||'epic'}.`);
  lines.push(`LIGHTING: ${light?.en||'dramatic cinematic lighting'}.`);
  if(palette) lines.push(`COLOR PALETTE: ${palette}.`);
  lines.push(`ASPECT RATIO: ${s.aspect||'16:9'}.`);
  if(extras.length) lines.push(`TECHNICAL REQUIREMENTS: ${extras.join(' | ')}.`);
  if(extra) lines.push(`ADDITIONAL DETAILS: ${extra}.`);
  lines.push(`QUALITY: Ultra-high resolution, premium production value, professional commercial grade.`);
 } else {
  lines.push(`Crie um(a) ${type?.name||'pôster'}: ${subject||'[DESCREVA O CONCEITO VISUAL]'}.`);
  lines.push(`ESTILO VISUAL: ${style?.name||'cinemático'}${refs?`, inspirado em ${refs}`:''}.`);
  lines.push(`CLIMA E ATMOSFERA: ${mood?.en||'épico'}.`);
  lines.push(`ILUMINAÇÃO: ${light?.en||'iluminação cinemática dramática'}.`);
  if(palette) lines.push(`PALETA DE COR: ${palette}.`);
  lines.push(`PROPORÇÃO: ${s.aspect||'16:9'}.`);
  if(extras.length) lines.push(`REQUISITOS TÉCNICOS: ${extras.join(' | ')}.`);
  if(extra) lines.push(`DETALHES ADICIONAIS: ${extra}.`);
  lines.push(`QUALIDADE: Ultra-alta resolução, valor de produção premium, nível comercial profissional.`);
 }

 const tips=L==='en'?[
  {label:"🎭 Add subject reference",add:"Place the subject from [IMAGE 1] into this composition. Maintain their likeness while integrating them seamlessly into the scene."},
  {label:"📝 Add title area",add:"Reserve a clean typographic zone at the top 20% for a bold title and bottom 10% for subtitle/credits. The image composition should work around this text placement."},
  {label:"🌑 Dark version",add:"Generate a darker, more dramatic version: deep blacks, stronger contrast, mysterious shadow areas, with the same composition."},
  {label:"🔄 Alternative crop",add:"Generate a secondary version in 9:16 vertical format optimized for Stories and Reels from the same visual concept."},
  {label:"✨ High contrast version",add:"Create a high-contrast punchy version with crushed blacks, boosted highlights, and hyper-saturated colors."},
 ]:[
  {label:"🎭 Inserir referência",add:"Coloque o sujeito de [IMAGEM 1] nesta composição. Mantenha a semelhança dele enquanto o integra perfeitamente na cena."},
  {label:"📝 Área de título",add:"Reserve uma zona tipográfica limpa no topo de 20% para um título em destaque e 10% inferior para subtítulo/créditos. A composição da imagem deve trabalhar em torno desse texto."},
  {label:"🌑 Versão sombria",add:"Gere uma versão mais escura e dramática: pretos profundos, contraste mais forte, áreas de sombra misteriosas, com a mesma composição."},
  {label:"🔄 Corte alternativo",add:"Gere uma versão secundária em formato 9:16 vertical otimizada para Stories e Reels a partir do mesmo conceito visual."},
  {label:"✨ Alto contraste",add:"Crie uma versão de alto contraste com pretos esmagados, altas luzes boosted e cores hiper-saturadas."},
 ];
 return {text:lines.join('\n\n'),tips};
}


// ---------- HELPERS DE UI ----------
function gv(id){const e=document.getElementById(id);if(e){GTXT[id]=e.value;return e.value.trim();}return (GTXT[id]||"").trim();}
function optGrid(items,sel,multi,cb,nameKey){
 return items.map(o=>{
  const active=multi?(sel.has&&sel.has(o.id)):sel===o.id;
  const nm=o[nameKey]||o.name||o.label||'';
  return `<button type="button" class="gopt ${active?'active':''}" onclick="${cb}('${o.id}')">
   ${o.icon?`<span class="gopt-ic">${o.icon}</span>`:''}
   <span class="gopt-nm">${nm}</span>
   ${o.desc?`<span class="gopt-ds">${o.desc}</span>`:''}
  </button>`;
 }).join('');
}
function catTabs(cats,active,cb){
 return cats.map(c=>{const id=Array.isArray(c)?c[0]:c;const lb=Array.isArray(c)?c[1]:c;
  return `<button type="button" class="gcat ${id===active?'active':''}" onclick="${cb}('${id}')">${lb}</button>`;}).join('');
}
function sectionHTML(title,inner){return `<div class="gen-sec"><div class="gen-sec-t">${title}</div>${inner}</div>`;}

// ---------- RENDER CONTROLES ----------
function renderGenControls(){
 const wrap=document.getElementById('genControls');
 if(genMode==='image') wrap.innerHTML=renderImgControls();
 else if(genMode==='text') wrap.innerHTML=renderTxtControls();
 else if(genMode==='emoji') wrap.innerHTML=renderEmoControls();
 else if(genMode==='video') wrap.innerHTML=renderVidControls();
 else if(genMode==='logo') wrap.innerHTML=renderLogoControls();
 else if(genMode==='char') wrap.innerHTML=renderCharControls();
 else if(genMode==='retouch') wrap.innerHTML=renderRetouchControls();
 else if(genMode==='poster') wrap.innerHTML=renderPosterControls();
 else wrap.innerHTML=renderConControls();
 gtxtRestore();
}

// ===== CAMADAS: CONSISTÊNCIA, EMOÇÃO E TEXTURAS =====
// Compartilhadas pelos modos Imagem e Vídeo (texto → vídeo). O estado de cada
// uma fica em GS.img / GS.vid; as funções abaixo olham o modo aberto.
const GEN_EMOTIONS=[{id:"none",icon:"🚫",name:"Sem definir",desc:"Não especificar",en:"",pt:""},{id:"joy",icon:"😄",name:"Alegria",desc:"Leve, contagiante",en:"joy and lightness",pt:"alegria e leveza"},{id:"nostalgia",icon:"📼",name:"Nostalgia",desc:"Saudade, memória",en:"a warm, wistful nostalgia",pt:"uma nostalgia calorosa, de saudade"},{id:"loneliness",icon:"🌧️",name:"Solidão",desc:"Isolamento, silêncio",en:"a quiet loneliness",pt:"uma solidão silenciosa"},{id:"tension",icon:"😬",name:"Tensão",desc:"Algo está para acontecer",en:"tension and suspense, as if something is about to happen",pt:"tensão e suspense, como se algo estivesse para acontecer"},{id:"mystery",icon:"🕵️",name:"Mistério",desc:"Curiosidade, segredo",en:"mystery and intrigue",pt:"mistério e curiosidade"},{id:"hope",icon:"🌱",name:"Esperança",desc:"Recomeço, otimismo",en:"hope and quiet optimism",pt:"esperança e otimismo sereno"},{id:"melancholy",icon:"🍂",name:"Melancolia",desc:"Tristeza suave",en:"a gentle melancholy",pt:"uma melancolia suave"},{id:"calm",icon:"🕊️",name:"Serenidade",desc:"Paz, descanso",en:"calm and serenity",pt:"calma e serenidade"},{id:"power",icon:"🦁",name:"Poder",desc:"Imponência, confiança",en:"power, confidence and grandeur",pt:"poder, confiança e imponência"},{id:"fear",icon:"😨",name:"Medo",desc:"Inquietação, ameaça",en:"unease and fear",pt:"inquietação e medo"},{id:"tenderness",icon:"💞",name:"Ternura",desc:"Afeto, romance",en:"tenderness and affection",pt:"ternura e afeto"},{id:"energy",icon:"⚡",name:"Euforia",desc:"Energia, movimento",en:"euphoric energy and excitement",pt:"energia e euforia"},{id:"awe",icon:"🌌",name:"Admiração",desc:"Grandeza, encanto",en:"awe and wonder",pt:"admiração e encantamento"}];
const GEN_TEXTURES=[{id:"grain",icon:"🎞️",name:"Grão de filme",desc:"Analógico, orgânico",en:"fine 35mm film grain",pt:"grão fino de filme 35mm"},{id:"skin",icon:"🧑",name:"Pele real",desc:"Poros, sardas, marcas",en:"natural skin texture with visible pores, freckles and small imperfections",pt:"pele natural com poros visíveis, sardas e pequenas imperfeições"},{id:"fabric",icon:"🧵",name:"Tecido gasto",desc:"Vincos, fios soltos",en:"worn fabric with creases, loose threads and faded spots",pt:"tecido gasto com vincos, fios soltos e partes desbotadas"},{id:"dust",icon:"🌫️",name:"Poeira no ar",desc:"Partículas na luz",en:"dust particles floating in the light",pt:"partículas de poeira flutuando na luz"},{id:"wear",icon:"🪵",name:"Desgaste",desc:"Arranhões, lascas",en:"scratches, chips and signs of wear on surfaces",pt:"arranhões, lascas e sinais de desgaste nas superfícies"},{id:"wet",icon:"💧",name:"Umidade",desc:"Gotas, superfície molhada",en:"damp surfaces with water droplets and wet reflections",pt:"superfícies úmidas com gotas d'água e reflexos molhados"},{id:"rust",icon:"🟫",name:"Ferrugem",desc:"Metal oxidado",en:"rust and oxidation on metal",pt:"ferrugem e oxidação no metal"},{id:"paper",icon:"📜",name:"Papel envelhecido",desc:"Amarelado, manchado",en:"aged paper with yellowed edges and stains",pt:"papel envelhecido com bordas amareladas e manchas"},{id:"smudges",icon:"🖐️",name:"Marcas de uso",desc:"Digitais, manchas",en:"fingerprints, smudges and marks of everyday use",pt:"digitais, manchas e marcas de uso do dia a dia"},{id:"concrete",icon:"🧱",name:"Parede rachada",desc:"Concreto, reboco",en:"cracked concrete and weathered walls",pt:"concreto rachado e paredes desgastadas pelo tempo"},{id:"lens",icon:"🔍",name:"Lente imperfeita",desc:"Halation, vinheta",en:"subtle lens imperfections: slight halation, soft vignette and chromatic aberration",pt:"imperfeições sutis de lente: leve halation, vinheta suave e aberração cromática"},{id:"lived",icon:"🧺",name:"Bagunça natural",desc:"Cena vivida",en:"small everyday clutter that makes the scene feel lived-in",pt:"pequena bagunça do dia a dia que deixa a cena vivida"}];
// o que precisa ficar igual em toda a série, conforme o tipo de sujeito
const GEN_CONS_KEEP={
 person:[{id:"face",icon:"🙂",name:"Rosto e traços",en:"face and facial features",pt:"rosto e traços"},{id:"hair",icon:"💇",name:"Cabelo",en:"hairstyle and hair color",pt:"corte e cor do cabelo"},{id:"outfit",icon:"👕",name:"Roupa e acessórios",en:"outfit and accessories",pt:"roupa e acessórios"},{id:"body",icon:"🧍",name:"Corpo",en:"body type and proportions",pt:"tipo de corpo e proporções"},{id:"palette",icon:"🎨",name:"Cores",en:"color palette",pt:"paleta de cores"},{id:"style",icon:"🖌️",name:"Estilo visual",en:"visual style",pt:"estilo visual"}],
 animal:[{id:"markings",icon:"🐾",name:"Pelagem e marcas",en:"fur color and markings",pt:"cor da pelagem e marcas"},{id:"face",icon:"🐶",name:"Rosto/focinho",en:"face and features",pt:"rosto e traços"},{id:"body",icon:"📏",name:"Tamanho",en:"size and proportions",pt:"tamanho e proporções"},{id:"accessories",icon:"🦮",name:"Acessórios",en:"accessories",pt:"acessórios"},{id:"style",icon:"🖌️",name:"Estilo visual",en:"visual style",pt:"estilo visual"}],
 product:[{id:"shape",icon:"🔷",name:"Forma",en:"exact shape and silhouette",pt:"forma e silhueta exatas"},{id:"label",icon:"🏷️",name:"Rótulo e logo",en:"label, logo and text",pt:"rótulo, logo e textos"},{id:"palette",icon:"🎨",name:"Cores",en:"colors",pt:"cores"},{id:"material",icon:"🧪",name:"Material",en:"materials and finish",pt:"materiais e acabamento"},{id:"style",icon:"🖌️",name:"Estilo visual",en:"visual style",pt:"estilo visual"}]
};
function genConsKeepDefault(){return{person:new Set(["face","hair","outfit"]),animal:new Set(["markings","face"]),product:new Set(["shape","label","palette"])};}
function layerState(){return genMode==='video'?GS.vid:GS.img;}
function layerGroup(){return genMode==='video'?vidGroup():imgGroup();}
function layerPfx(){return genMode==='video'?'vid':'img';}
function layerPickEmotion(id){layerState().emotion=id;renderGenControls();buildGen();}
function layerToggleTexture(id){const tx=layerState().textures;tx.has(id)?tx.delete(id):tx.add(id);renderGenControls();buildGen();}
function layerToggleCons(){const s=layerState();s.cons=!s.cons;renderGenControls();buildGen();}
function layerToggleKeep(id){const k=layerState().consKeep[layerGroup()];k.has(id)?k.delete(id):k.add(id);renderGenControls();buildGen();}

function layerConsHTML(){
 const s=layerState(),g=layerGroup(),p=layerPfx(),serie=genMode==='video'?'vários vídeos':'várias imagens';
 let h=`<div class="gen-ref ${s.cons?'on':''}" onclick="layerToggleCons()"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>Vai aparecer em ${serie}</b><span>O prompt manda manter tudo igual em toda a série</span></div></div>`;
 if(s.cons){
  h+=`<input type="text" id="${p}ConsName" class="gen-in" placeholder="Nome do personagem (opcional): ex: Lia, Capitão Bento, Tênis Aurora..." oninput="buildGen()" style="margin-top:.6rem;">
   <div class="gen-fld" style="margin-top:.6rem;"><span>Manter igual</span></div>
   <div class="gopt-grid">${optGrid(GEN_CONS_KEEP[g],s.consKeep[g],true,'layerToggleKeep','name')}</div>
   <div class="gen-hint" style="margin-top:.5rem;">Para a série ficar igual, use a mesma descrição do sujeito em todos os prompts. Salve aqui para carregar depois.</div>
   <div class="gcat-row" style="margin-top:.5rem;"><button type="button" class="gcat" onclick="layerSaveChar()">💾 Salvar personagem</button></div>`;
 }
 const salvos=layerChars();
 if(salvos.length){
  h+=`<div class="gen-fld" style="margin-top:.7rem;"><span>Personagens salvos neste aparelho</span></div><div class="gcat-row">${salvos.map((c,i)=>`<button type="button" class="gcat" onclick="layerLoadChar(${i})">${esc(c.name)}</button><button type="button" class="gcat" title="Apagar" onclick="layerDeleteChar(${i})">✕</button>`).join('')}</div>`;
 }
 return h;
}
function layerEmotionHTML(){
 const s=layerState(),p=layerPfx();
 return `<div class="gen-hint" style="margin-bottom:.5rem;">O que ${genMode==='video'?'o vídeo':'a imagem'} deve fazer sentir. Diferente de "cor e clima", que fala da aparência.</div>
  <div class="gopt-grid">${optGrid(GEN_EMOTIONS,s.emotion,false,'layerPickEmotion','name')}</div>
  <input type="text" id="${p}EmoExtra" class="gen-in" placeholder="Com suas palavras (opcional): ex: saudade de um verão que não volta..." oninput="buildGen()" style="margin-top:.5rem;">`;
}
function layerTexturesHTML(){
 const s=layerState(),p=layerPfx();
 return `<div class="gen-hint" style="margin-bottom:.5rem;">Imperfeições que somam: tiram a cara de imagem "perfeita demais" de IA. Pode escolher várias.</div>
  <div class="gopt-grid">${optGrid(GEN_TEXTURES,s.textures,true,'layerToggleTexture','name')}</div>
  <input type="text" id="${p}TexExtra" class="gen-in" placeholder="Outras texturas (opcional): ex: couro rachado, tinta descascando..." oninput="buildGen()" style="margin-top:.5rem;">`;
}

/** Linhas das 3 camadas. refSujeito = o sujeito vem de [IMAGE 1]. */
function layerLines(L,refSujeito){
 const s=layerState(),g=layerGroup(),p=layerPfx(),en=L==='en',video=genMode==='video';
 const out={cons:'',emotion:'',textures:''};
 if(s.cons&&GEN_CONS_KEEP[g]){
  const nome=gv(p+'ConsName');
  const itens=GEN_CONS_KEEP[g].filter(o=>s.consKeep[g].has(o.id)).map(o=>en?o.en:o.pt);
  const quem=g==='product'?(en?'product':'produto'):(en?'character':'personagem');
  const onde=en?(video?'every clip':'every image'):(video?'todos os vídeos':'todas as imagens');
  const base=refSujeito?(en?'exactly as in [IMAGE 1]':'exatamente como em [IMAGE 1]'):(en?'exactly as described above':'exatamente como descrito acima');
  if(en){
   out.cons=`CONSISTENCY: this is a recurring ${quem}${nome?` named "${nome}"`:''} in a series. Keep ${itens.length?'the '+itens.join(', '):'every feature'} identical in ${onde}, ${base}. Do not redesign, restyle or change any feature.`;
  }else{
   out.cons=`CONSISTÊNCIA: este é um ${quem} recorrente${nome?` chamado "${nome}"`:''} em uma série. Mantenha ${itens.length?itens.join(', '):'todas as características'} idênticos em ${onde}, ${base}. Não redesenhe, não mude o estilo nem altere nenhum traço.`;
  }
 }
 const emo=GEN_EMOTIONS.find(e=>e.id===s.emotion),emoTxt=[emo&&(en?emo.en:emo.pt),gv(p+'EmoExtra')].filter(Boolean);
 if(emoTxt.length){
  out.emotion=en?`EMOTION: the ${video?'video':'image'} should make the viewer feel ${emoTxt.join(', ')}.`
                :`EMOÇÃO: ${video?'o vídeo':'a imagem'} deve fazer sentir ${emoTxt.join(', ')}.`;
 }
 const tex=GEN_TEXTURES.filter(o=>s.textures.has(o.id)).map(o=>en?o.en:o.pt),texExtra=gv(p+'TexExtra');
 if(texExtra) tex.push(texExtra);
 if(tex.length){
  out.textures=en?`TEXTURES (imperfections that add realism): ${tex.join('; ')}.`
                 :`TEXTURAS (imperfeições que dão realismo): ${tex.join('; ')}.`;
 }
 return out;
}

// Personagens salvos: ficam só neste navegador (localStorage)
function layerChars(){try{return JSON.parse(localStorage.getItem('genPersonagens')||'[]');}catch(e){return [];}}
function layerStoreChars(lista){try{localStorage.setItem('genPersonagens',JSON.stringify(lista));return true;}catch(e){return false;}}
function layerSaveChar(){
 const s=layerState(),g=layerGroup(),p=layerPfx();
 const nome=gv(p+'ConsName');
 if(!nome){showToast(t('gen_char_need_name'),true);return;}
 if(!GEN_CONS_KEEP[g]){return;}
 const lista=layerChars().filter(c=>c.name.toLowerCase()!==nome.toLowerCase());
 lista.push({name:nome,subject:s.subject,group:g,fields:{...(s.fieldMem[g]||{})},keep:[...s.consKeep[g]]});
 if(!layerStoreChars(lista)){showToast(t('gen_char_not_saved'),true);return;}
 renderGenControls();
 showToast(t('gen_char_saved',{name:nome}));
}
function layerLoadChar(i){
 const c=layerChars()[i];if(!c)return;
 const s=layerState(),p=layerPfx();
 s.subject=c.subject;
 s.fieldMem[c.group]={...c.fields};
 s.consKeep[c.group]=new Set(c.keep);
 s.cons=true;
 GTXT[p+'ConsName']=c.name;
 renderGenControls();buildGen();
}
function layerDeleteChar(i){
 const lista=layerChars(),c=lista[i];if(!c)return;
 if(!confirm(t('gen_char_delete_confirm',{name:c.name})))return;
 lista.splice(i,1);layerStoreChars(lista);renderGenControls();
}

// ===== IMAGEM =====
function renderImgControls(){
 const s=GS.img;
 let h='';
 h+=sectionHTML('1 · Tipo de sujeito',`<div class="gopt-grid">${optGrid(IMG_SUBJECTS,s.subject,false,'imgPickSubject','name')}</div>`);
 h+=sectionHTML('2 · Detalhes do sujeito',`<div id="imgSubjFields"></div>
   <div class="gen-ref" id="imgRefSubject" onclick="imgToggleRef('subject')"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>Usar foto de referência do sujeito</b><span>O prompt aponta para [IMAGEM 1]</span></div></div>`);
 h+=sectionHTML('3 · Consistência (série)',layerConsHTML());
 h+=sectionHTML('4 · Produto / objeto',`<input type="text" id="imgProduct" class="gen-in" placeholder="ex: lata de refrigerante vermelha, relógio dourado..." oninput="buildGen()">
   <div class="gen-ref" id="imgRefProduct" onclick="imgToggleRef('product')"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>Usar foto de referência do produto</b><span>O prompt aponta para [IMAGEM 2]</span></div></div>`);
 h+=sectionHTML('5 · Cenário',`<div class="gcat-row" id="imgLocTabs">${catTabs(IMG_LOC_CATS,s.locCat,'imgPickLocCat')}</div>
   <div class="gopt-grid" id="imgLocGrid">${optGrid(IMG_LOCATIONS[s.locCat],s.loc,false,'imgPickLoc','name')}</div>
   <input type="text" id="imgLocExtra" class="gen-in" placeholder="ex: ao pôr do sol, com neblina..." oninput="buildGen()" style="margin-top:.5rem;">
   <div class="gen-ref" id="imgRefLocation" onclick="imgToggleRef('location')"><div class="gen-ref-sw"></div><div class="gen-ref-tx"><b>Usar foto de referência do local</b><span>O prompt aponta para [IMAGEM 3]</span></div></div>`);
 h+=sectionHTML('6 · Ação / pose',`<input type="text" id="imgAction" class="gen-in" placeholder="ex: olhando para a câmera, segurando o produto..." oninput="buildGen()">`);
 h+=sectionHTML('7 · Câmera',`<div class="gen-row2">
    <label class="gen-fld"><span>Enquadramento</span><select id="imgCamShot" class="gen-in" onchange="buildGen()">${IMG_CAM_SHOT.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
    <label class="gen-fld"><span>Lente</span><select id="imgCamLens" class="gen-in" onchange="buildGen()">${IMG_CAM_LENS.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
   </div>
   <div class="gen-row2"><label class="gen-fld"><span>Abertura</span><select id="imgCamAper" class="gen-in" onchange="buildGen()">${IMG_CAM_APER.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>
   <label class="gen-fld"><span>Câmera/filme</span><input type="text" id="imgCamBody" class="gen-in" placeholder="ex: Sony A7IV, 35mm film..." oninput="buildGen()"></label></div>`);
 h+=sectionHTML('8 · Iluminação',`<div class="gopt-grid">${optGrid(IMG_LIGHTING,s.light,false,'imgPickLight','name')}</div>`);
 h+=sectionHTML('9 · Cor & clima',`<div class="gopt-grid">${optGrid(IMG_MOODS,s.mood,false,'imgPickMood','name')}</div>`);
 h+=sectionHTML('10 · Emoção',layerEmotionHTML());
 h+=sectionHTML('11 · Texturas',layerTexturesHTML());
 h+=sectionHTML('12 · Estilo',`<div class="gopt-grid">${optGrid(IMG_STYLES,s.style,false,'imgPickStyle','name')}</div>`);
 h+=sectionHTML('13 · Proporção',`<div class="gopt-grid">${optGrid(IMG_ASPECTS,s.aspect,false,'imgPickAspect','name')}</div>`);
 setTimeout(()=>{imgRenderFields();imgSyncRefs();},0);
 return h;
}
function imgGroup(){const s=GS.img.subject;if(['man','woman','child','couple'].includes(s))return'person';if(s==='animal')return'animal';return'product';}
function imgRenderFields(){
 const g=imgGroup();const fields=IMG_SUBJECT_FIELDS[g];const mem=GS.img.fieldMem[g]||{};
 const el=document.getElementById('imgSubjFields');if(!el)return;
 el.innerHTML=fields.map(f=>`<label class="gen-fld"><span>${f.label}</span><input type="text" id="imgf_${f.id}" class="gen-in" value="${(mem[f.id]||'').replace(/"/g,'&quot;')}" placeholder="${f.ph}" oninput="GS.img.fieldMem['${g}']['${f.id}']=this.value;buildGen()"></label>`).join('');
}
function imgPickSubject(id){const pg=imgGroup();GS.img.subject=id;const ng=imgGroup();if(pg!==ng)GS.img.fieldMem[ng]=GS.img.fieldMem[ng]||{};renderGenControls();buildGen();}
function imgPickLocCat(c){GS.img.locCat=c;renderGenControls();buildGen();}
function imgPickLoc(id){GS.img.loc=id;renderGenControls();buildGen();}
function imgPickLight(id){GS.img.light=id;renderGenControls();buildGen();}
function imgPickMood(id){GS.img.mood=id;renderGenControls();buildGen();}
function imgPickStyle(id){GS.img.style=id;renderGenControls();buildGen();}
function imgPickAspect(id){GS.img.aspect=id;renderGenControls();buildGen();}
function imgToggleRef(k){GS.img.refs[k]=!GS.img.refs[k];imgSyncRefs();buildGen();}
function imgSyncRefs(){['subject','product','location'].forEach(k=>{const el=document.getElementById('imgRef'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.classList.toggle('on',GS.img.refs[k]);});}

// ===== TEXTO =====
function renderTxtControls(){
 const s=GS.txt;let h='';
 h+=sectionHTML('1 · Fonte / lettering',`<div class="gopt-grid">${optGrid(TXT_FONTS,s.font,false,'txtPickFont','name')}</div>`);
 h+=sectionHTML('2 · Material (pode escolher vários)',`<div class="gcat-row">${catTabs(TXT_MAT_CATS,s.matCat,'txtPickMatCat')}</div>
   <div class="gopt-grid">${optGrid(TXT_MATERIALS[s.matCat],s.mats,true,'txtToggleMat','name')}</div>
   <input type="text" id="txtMatColor" class="gen-in" placeholder="Cor do material (opcional): ex: vermelho metálico..." value="${s.matColor.replace(/"/g,'&quot;')}" oninput="GS.txt.matColor=this.value;buildGen()" style="margin-top:.5rem;">`);
 h+=sectionHTML('3 · Propriedades físicas',`
   <label class="gen-sl"><span>Dureza: <b id="txtHardV">${TXT_HARD_LBL[s.hard]}</b></span><input type="range" min="0" max="5" value="${s.hard}" oninput="GS.txt.hard=+this.value;document.getElementById('txtHardV').textContent=TXT_HARD_LBL[this.value];buildGen()"></label>
   <label class="gen-sl"><span>Fluidez: <b id="txtDensV">${TXT_DENS_LBL[s.dens]}</b> <i id="txtDensN" style="color:var(--muted);font-style:normal;">${TXT_DENS_NOTE[s.dens]}</i></span><input type="range" min="0" max="5" value="${s.dens}" oninput="GS.txt.dens=+this.value;document.getElementById('txtDensV').textContent=TXT_DENS_LBL[this.value];document.getElementById('txtDensN').textContent=TXT_DENS_NOTE[this.value];buildGen()"></label>
   <label class="gen-sl"><span>Brilho: <b id="txtGlossV">${TXT_GLOSS_LBL[s.gloss]}</b></span><input type="range" min="0" max="5" value="${s.gloss}" oninput="GS.txt.gloss=+this.value;document.getElementById('txtGlossV').textContent=TXT_GLOSS_LBL[this.value];buildGen()"></label>`);
 h+=sectionHTML('4 · Textura de superfície',`<div class="gopt-grid">${optGrid(TXT_TEXTURES,s.textures,true,'txtToggleTex','name')}</div>`);
 h+=sectionHTML('5 · Partículas & efeitos',`<div class="gopt-grid">${optGrid(TXT_PARTICLES,s.particles,true,'txtTogglePart','name')}</div>`);
 h+=sectionHTML('6 · Fundo',`<div class="gcat-row">${catTabs(TXT_BG_CATS,s.bgCat,'txtPickBgCat')}</div><div class="gopt-grid">${optGrid(TXT_BACKGROUNDS[s.bgCat],s.bg,false,'txtPickBg','name')}</div>`);
 h+=sectionHTML('7 · Iluminação',`<div class="gopt-grid">${optGrid(TXT_LIGHTING,s.light,false,'txtPickLight','name')}</div>`);
 h+=sectionHTML('8 · Estilo de render',`<div class="gopt-grid">${optGrid(TXT_REALISM,s.realism,false,'txtPickRealism','name')}</div>`);
 return h;
}
function txtPickFont(id){GS.txt.font=id;renderGenControls();buildGen();}
function txtPickMatCat(c){GS.txt.matCat=c;renderGenControls();buildGen();}
function txtToggleMat(id){const m=GS.txt.mats;m.has(id)?m.delete(id):m.add(id);renderGenControls();buildGen();}
function txtToggleTex(id){const t=GS.txt.textures;if(id==='none'){GS.txt.textures=new Set(['none']);}else{t.delete('none');t.has(id)?t.delete(id):t.add(id);}renderGenControls();buildGen();}
function txtTogglePart(id){const p=GS.txt.particles;if(id==='none'){GS.txt.particles=new Set(['none']);}else{p.delete('none');p.has(id)?p.delete(id):p.add(id);if(p.size===0)p.add('none');}renderGenControls();buildGen();}
function txtPickBgCat(c){GS.txt.bgCat=c;renderGenControls();buildGen();}
function txtPickBg(id){GS.txt.bg=id;renderGenControls();buildGen();}
function txtPickLight(id){GS.txt.light=id;renderGenControls();buildGen();}
function txtPickRealism(id){GS.txt.realism=id;const r=TXT_REALISM.find(x=>x.id===id);if(r&&r.dim)GS.txt.dim=r.dim;renderGenControls();buildGen();}

// ===== EMOJI =====
function renderEmoControls(){
 const s=GS.emo;let h='';
 h+=sectionHTML('1 · Emoji base',`<input type="text" id="emoInput" class="gen-in" style="font-size:1.8rem;text-align:center;max-width:120px;" maxlength="8" value="${s.emoji}" oninput="GS.emo.emoji=this.value||'🐾';buildGen()"><div class="gen-hint">Cole qualquer emoji que será a base visual.</div>`);
 h+=sectionHTML('2 · Material',`<div class="gcat-row">${catTabs(EMO_MAT_CATS,s.matCat,'emoPickMatCat')}</div><div class="gopt-grid">${optGrid(EMO_MATERIALS[s.matCat],s.mat,false,'emoPickMat','name')}</div>`);
 h+=sectionHTML('3 · Estilo',`<div class="gcat-row">${catTabs(EMO_STYLE_CATS,s.styleCat,'emoPickStyleCat')}</div><div class="gopt-grid">${optGrid(EMO_STYLES[s.styleCat],s.style,false,'emoPickStyle','label')}</div>`);
 return h;
}
function emoPickMatCat(c){GS.emo.matCat=c;const items=EMO_MATERIALS[c];if(!items.find(m=>m.id===GS.emo.mat))GS.emo.mat=items[0].id;renderGenControls();buildGen();}
function emoPickMat(id){GS.emo.mat=id;renderGenControls();buildGen();}
function emoPickStyleCat(c){GS.emo.styleCat=c;const items=EMO_STYLES[c];if(!items.find(s=>s.id===GS.emo.style))GS.emo.style=items[0].id;renderGenControls();buildGen();}
function emoPickStyle(id){GS.emo.style=id;renderGenControls();buildGen();}

// ---------- BUILD ----------
function buildGen(){
 let out='';let tips=[];
 if(genMode==='image'){const r=buildImg();out=r.text;tips=r.tips;}
 else if(genMode==='text'){const r=buildTxt();out=r.text;tips=r.tips;}
 else if(genMode==='emoji'){const r=buildEmo();out=r.text;tips=r.tips;}
 else if(genMode==='video'){const r=buildVid();out=r.text;tips=r.tips;}
 else if(genMode==='logo'){const r=buildLogo();out=r.text;tips=r.tips;}
 else if(genMode==='char'){const r=buildChar();out=r.text;tips=r.tips;}
 else if(genMode==='retouch'){const r=buildRetouch();out=r.text;tips=r.tips;}
 else if(genMode==='poster'){const r=buildPoster();out=r.text;tips=r.tips;}
 else {const r=buildCon();out=r.text;tips=r.tips;}
 const o=document.getElementById('genOutput');
 o.innerHTML=out.replace(/\[([^\]]+)\]/g,'<span class="gen-ph">[$1]</span>');
 o.dataset.raw=out;
 renderTips(tips);
}

function buildImg(){
 const L=genLang,s=GS.img;
 const loc=Object.values(IMG_LOCATIONS).flat().find(l=>l.id===s.loc);
 const light=IMG_LIGHTING.find(l=>l.id===s.light);
 const mood=IMG_MOODS.find(m=>m.id===s.mood);
 const style=IMG_STYLES.find(x=>x.id===s.style);
 const g=imgGroup();const fields=IMG_SUBJECT_FIELDS[g];const mem=GS.img.fieldMem[g]||{};
 const parts=fields.map(f=>{const v=(mem[f.id]||'').trim();if(!v)return'';return (L==='en'?f.en:f.pt)(v);}).filter(Boolean);
 const baseEN={man:"a man",woman:"a woman",child:"a child",couple:"a couple",animal:"an animal",product:"a product"}[s.subject];
 const basePT={man:"um homem",woman:"uma mulher",child:"uma criança",couple:"um casal",animal:"um animal",product:"um produto"}[s.subject];
 let subj;
 if(s.refs.subject){subj=(L==='en'?"the subject shown in [IMAGE 1]":"o sujeito mostrado em [IMAGE 1]")+(parts.length?", "+parts.join(", "):"");}
 else if(!parts.length){subj=(L==='en'?baseEN:basePT);}
 else {subj=(L==='en'?baseEN+", ":basePT+", ")+parts.join(", ");}
 const locTxt=s.refs.location?(L==='en'?"the location shown in [IMAGE 3]":"o local mostrado em [IMAGE 3]"):(L==='en'?loc.en:loc.pt);
 const locExtra=gv('imgLocExtra'),action=gv('imgAction'),product=gv('imgProduct');
 const cam=[gv('imgCamShot'),gv('imgCamLens'),gv('imgCamAper'),gv('imgCamBody')].filter(Boolean);
 const camadas=layerLines(L,s.refs.subject);
 const lines=[];
 if(L==='en'){
  lines.push(`SUBJECT: ${subj}.`);
  if(camadas.cons) lines.push(camadas.cons);
  if(product||s.refs.product) lines.push(`PRODUCT: ${s.refs.product?"the product shown in [IMAGE 2]":product}${product&&s.refs.product?" ("+product+")":""}, prominently featured.`);
  if(action) lines.push(`ACTION: ${action}.`);
  lines.push(`SETTING: ${locTxt}${locExtra?", "+locExtra:""}.`);
  if(cam.length) lines.push(`CAMERA: ${cam.join(", ")}.`);
  lines.push(`LIGHTING: ${light.en}.`);
  if(mood.en) lines.push(`COLOR & MOOD: ${mood.en}.`);
  if(camadas.emotion) lines.push(camadas.emotion);
  if(camadas.textures) lines.push(camadas.textures);
  lines.push(`STYLE: ${style.en}.`);
  if(s.aspect) lines.push(`ASPECT RATIO: ${s.aspect}.`);
  lines.push(`Sharp focus, professional composition, high detail.`);
 }else{
  lines.push(`SUJEITO: ${subj}.`);
  if(camadas.cons) lines.push(camadas.cons);
  if(product||s.refs.product) lines.push(`PRODUTO: ${s.refs.product?"o produto mostrado em [IMAGE 2]":product}${product&&s.refs.product?" ("+product+")":""}, em destaque.`);
  if(action) lines.push(`AÇÃO: ${action}.`);
  lines.push(`CENÁRIO: ${locTxt}${locExtra?", "+locExtra:""}.`);
  if(cam.length) lines.push(`CÂMERA: ${cam.join(", ")}.`);
  lines.push(`ILUMINAÇÃO: ${light.pt}.`);
  if(mood.pt) lines.push(`COR E CLIMA: ${mood.pt}.`);
  if(camadas.emotion) lines.push(camadas.emotion);
  if(camadas.textures) lines.push(camadas.textures);
  lines.push(`ESTILO: ${style.pt}.`);
  if(s.aspect) lines.push(`PROPORÇÃO: ${s.aspect}.`);
  lines.push(`Foco nítido, composição profissional, alto detalhe.`);
 }
 const legend=[];
 if(s.refs.subject) legend.push("[IMAGE 1] = "+(L==='en'?"subject reference":"referência do sujeito"));
 if(s.refs.product) legend.push("[IMAGE 2] = "+(L==='en'?"product reference":"referência do produto"));
 if(s.refs.location) legend.push("[IMAGE 3] = "+(L==='en'?"location reference":"referência do local"));
 let out=lines.join("\n\n");
 if(legend.length) out+="\n\n— — —\n"+(L==='en'?"REFERENCE IMAGES:":"IMAGENS DE REFERÊNCIA:")+"\n"+legend.join("\n");
 const tips=L==='en'?[
  {label:"📷 Add film grain",add:"Add subtle 35mm film grain and slight halation for an analog cinematic feel."},
  {label:"🎨 Stronger color grade",add:"Apply a richer, more cinematic color grade with deeper contrast."},
  {label:"✨ Add atmosphere",add:"Add atmospheric haze and subtle particles in the air for depth."},
  {label:"🔍 Hyper detail",add:"Emphasize hyper-realistic micro-detail: skin pores, fabric weave, surface texture."},
  {label:"🖼️ Negative space",add:"Leave clean negative space around the subject for text overlay."}
 ]:[
  {label:"📷 Grão de filme",add:"Adicione grão sutil de filme 35mm e leve halation para um visual analógico cinematográfico."},
  {label:"🎨 Cor mais forte",add:"Aplique uma correção de cor mais rica e cinematográfica, com contraste mais profundo."},
  {label:"✨ Mais atmosfera",add:"Adicione névoa atmosférica e partículas sutis no ar para dar profundidade."},
  {label:"🔍 Hiper detalhe",add:"Enfatize micro-detalhes hiper-realistas: poros da pele, trama do tecido, textura da superfície."},
  {label:"🖼️ Espaço negativo",add:"Deixe espaço negativo limpo ao redor do sujeito para sobrepor texto."}
 ];
 return {text:out,tips};
}

function buildTxt(){
 const s=GS.txt;
 const allMat=Object.values(TXT_MATERIALS).flat();
 const matTxts=[...s.mats].map(id=>allMat.find(m=>m.id===id)?.txt).filter(Boolean);
 const fontTxt=TXT_FONTS.find(f=>f.id===s.font)?.txt||"";
 const texTxts=[...s.textures].filter(id=>id!=='none').map(id=>TXT_TEXTURES.find(t=>t.id===id)?.txt).filter(Boolean);
 const partTxts=[...s.particles].filter(id=>id!=='none').map(id=>TXT_PARTICLES.find(p=>p.id===id)?.txt).filter(Boolean);
 const bgTxt=Object.values(TXT_BACKGROUNDS).flat().find(b=>b.id===s.bg)?.txt||"";
 const lightTxt=TXT_LIGHTING.find(l=>l.id===s.light)?.txt||"";
 const realTxt=TXT_REALISM.find(r=>r.id===s.realism)?.txt||"";
 const liquid=[...s.mats].some(id=>TXT_MATERIALS["Líquidos"]?.find(m=>m.id===id)||["liquid_metal","lava","honey","oil","slime","milk"].includes(id));
 const creamy=[...s.mats].some(id=>TXT_MATERIALS["Cremosos"]?.find(m=>m.id===id));
 const flow=liquid||creamy;
 const propParts=[];if(s.hard>0)propParts.push(TXT_HARD[s.hard]);if(s.gloss>0)propParts.push("a "+TXT_GLOSS[s.gloss]);
 const matJoin=genLang==='pt'?(matTxts.length>1?"uma combinação de "+matTxts.join(", mesclado com "):matTxts[0]||"do material escolhido"):(matTxts.length>1?"a combination of "+matTxts.join(", blended with "):matTxts[0]||"the chosen material");
 let p;
 if(genLang==='pt'){
  const propClause=propParts.length?` O material tem ${propParts.join(" e ")}.`:"";
  const colorClause=s.matColor?` A cor do material é ${s.matColor}.`:"";
  p=`Crie ${s.dim==='3d'?"uma tipografia 3D marcante":"uma arte tipográfica 2D plana"} escrevendo a palavra [DIGITE SEU TEXTO AQUI].\n\nESTILO DE FONTE: ${fontTxt}.\n\nMATERIAL: As letras são feitas de ${matJoin}.${colorClause}${propClause}`;
  if(flow&&s.dens>0) p+=`\n\n${liquid?"COMPORTAMENTO LÍQUIDO":"CONSISTÊNCIA"}: ${TXT_DENS[s.dens]}.`;
  if(texTxts.length) p+=`\n\nTEXTURA DA SUPERFÍCIE: ${texTxts.join(", combinada com ")}.`;
  if(partTxts.length) p+=`\n\nPARTÍCULAS E EFEITOS: ${partTxts.join(", e ")} ao redor das letras.`;
  p+=`\n\nFUNDO: ${bgTxt}.\n\nILUMINAÇÃO: ${lightTxt}.\n\nESTILO DE RENDER: ${realTxt}. ${s.dim==='3d'?"Renderizado com profundidade, volume e extrusão dimensional reais.":"Renderizado como uma composição gráfica plana."}\n\nCOMPOSIÇÃO: A palavra [DIGITE SEU TEXTO AQUI] é o herói principal, perfeitamente legível, centralizada, foco nítido. A grafia do texto deve estar exatamente correta. Alto detalhe, qualidade premium.`;
 }else{
  const propClause=propParts.length?` The material has ${propParts.join(" and ")}.`:"";
  const colorClause=s.matColor?` The material color is ${s.matColor}.`:"";
  p=`Create ${s.dim==='3d'?"bold 3D typography":"flat 2D typography artwork"} spelling the word [DIGITE SEU TEXTO AQUI].\n\nFONT STYLE: ${fontTxt}.\n\nMATERIAL: The letters are made of ${matJoin}.${colorClause}${propClause}`;
  if(flow&&s.dens>0) p+=`\n\n${liquid?"LIQUID BEHAVIOR":"CONSISTENCY"}: ${TXT_DENS[s.dens]}.`;
  if(texTxts.length) p+=`\n\nSURFACE TEXTURE: ${texTxts.join(", combined with ")}.`;
  if(partTxts.length) p+=`\n\nPARTICLES & EFFECTS: ${partTxts.join(", and ")} surrounding the letters.`;
  p+=`\n\nBACKGROUND: ${bgTxt}.\n\nLIGHTING: ${lightTxt}.\n\nRENDER STYLE: ${realTxt}. ${s.dim==='3d'?"Rendered with real depth, volume and dimensional extrusion.":"Rendered as a flat graphic composition."}\n\nCOMPOSITION: The word [DIGITE SEU TEXTO AQUI] is the clear hero, perfectly readable, centered, sharp focus. The text spelling must be exactly correct. High detail, premium quality.`;
 }
 const tips=[
  {label:"🎨 Trocar cor",add:"Mesmo texto e material, mas mude a paleta de cores para [DESCREVA A COR]. Mantenha o resto idêntico."},
  {label:"📐 Ângulo / perspectiva",add:"Mostre o mesmo texto de um ângulo dinâmico em perspectiva (vista 3/4 de baixo para cima), mantendo material, textura e iluminação."},
  {label:"🔍 Close de material",add:"Close-up macro extremo da superfície do texto, mostrando o material e a textura em detalhe microscópico."},
  {label:"🔁 Outra palavra",add:"Mesmo estilo, material e cena, mas escrevendo a palavra [NOVA PALAVRA]. Mantenha total consistência visual."},
  {label:"📱 Versão pôster",add:"Transforme em pôster/capa de rede social: respiro nas margens, texto como herói central, proporção vertical 4:5."}
 ];
 return {text:p,tips};
}

function buildEmo(){
 const s=GS.emo;
 const m=Object.values(EMO_MATERIALS).flat().find(x=>x.id===s.mat);
 const st=Object.values(EMO_STYLES).flat().find(x=>x.id===s.style);
 const emoji=s.emoji||'🐾';
 if(!m||!st) return {text:'',tips:[]};
 let out;
 if(genLang==='pt'){
  out=`Gere um(a) ${st.output} do emoji ${emoji} traduzido em um conceito visual.\n\nSUJEITO: O emoji ${emoji}, totalmente realizado como: ${st.shape}.\n\nMATERIAL E SUPERFÍCIE: Feito de / renderizado como ${m.name.toLowerCase()} — ${m.surface}. Detalhes principais: ${m.detail}.\n\nILUMINAÇÃO: ${m.lighting}. A iluminação deve revelar claramente as propriedades do material.\n\nCOMPOSIÇÃO: ${st.bg}. Composição hero limpa, sujeito centralizado e totalmente visível, foco nítido.\n\nCLIMA: ${st.mood}.\n\nTÉCNICO: ${st.output}. Sem estilos misturados — comprometa-se totalmente com a estética.`;
 }else{
  out=`Generate a ${st.output} of the ${emoji} emoji translated into a visual concept.\n\nSUBJECT: The ${emoji} emoji, fully realized as: ${st.shape}.\n\nMATERIAL & SURFACE: Made of / rendered as ${m.name.toLowerCase()} — ${m.surface}. Key details: ${m.detail}.\n\nLIGHTING: ${m.lighting}. The lighting must clearly reveal the material properties.\n\nCOMPOSITION: ${st.bg}. Clean hero composition, subject centered and fully visible, sharp focus.\n\nMOOD & FEEL: ${st.mood}.\n\nTECHNICAL: ${st.output}. No mixed styles — commit fully to the aesthetic.`;
 }
 const tips=genLang==='pt'?[
  {label:"🎨 Variação de cor",add:`Mesmo render anterior, mas mude a paleta de cores para [DESCREVA A COR]. Mantenha todas as propriedades de material e iluminação idênticas.`},
  {label:"📐 Ângulo alternativo",add:`Mostre o mesmo sujeito de um ângulo de três-quartos a 45 graus, levemente elevado. Mantenha o mesmo material ${m.name} e o estilo ${st.label}.`},
  {label:"🔍 Macro de material",add:`Close-up macro extremo focando na textura da superfície de ${m.name}. A textura do material deve preencher 90% do quadro.`},
  {label:"🌍 Em contexto",add:`Coloque o mesmo ${emoji} (estilo ${st.label}, material ${m.name}) em um ambiente natural que combine com o sujeito. Composição cinematográfica.`},
  {label:"📦 Com packaging",add:`Mostre o ${emoji} como um produto premium de varejo dentro da sua caixa/embalagem — design limpo, branding. Fotografia de produto comercial em fundo branco.`}
 ]:[
  {label:"🎨 Variação de cor",add:`Same render as before, but change the color palette to [DESCREVA A COR]. Keep all material properties and lighting identical.`},
  {label:"📐 Ângulo alternativo",add:`Show the same subject from a 45-degree three-quarter angle, slightly elevated. Maintain the same ${m.name} material and ${st.label} style.`},
  {label:"🔍 Macro de material",add:`Extreme close-up macro shot focusing on the ${m.name} surface texture. Material texture should fill 90% of the frame.`},
  {label:"🌍 Em contexto",add:`Place the same ${emoji} (${st.label} style, ${m.name} material) in a natural environment that fits the subject. Cinematic composition.`},
  {label:"📦 Com packaging",add:`Show the ${emoji} as a premium retail product inside its packaging box — clean design, branding. Commercial product photography on white.`}
 ];
 return {text:out,tips};
}

// ---------- TIPS (camadas clicáveis) ----------
let appliedTips=new Set();
let currentTips=[];
function renderTips(tips){
 currentTips=tips;
 const wrap=document.getElementById('genTips');
 if(!tips.length){wrap.innerHTML='';return;}
 wrap.innerHTML=`<div class="gen-tips-t">Clique para adicionar ao prompt</div>`+
  tips.map((t,i)=>`<button type="button" class="gen-tip ${appliedTips.has(t.add)?'on':''}" onclick='toggleTip(${JSON.stringify(t.add)})'><span class="gen-tip-lb">${t.label}</span><span class="gen-tip-tx">${t.add}</span></button>`).join('');
}
function toggleTip(add){
 if(appliedTips.has(add)) appliedTips.delete(add);
 else {
  appliedTips.add(add);
  // desliga as dicas que brigam com a que acabou de ser ligada
  const me=currentTips.find(t=>t.add===add);
  if(me&&me.id) currentTips.forEach(t=>{if(t!==me&&((me.x||[]).includes(t.id)||(t.x||[]).includes(me.id)))appliedTips.delete(t.add);});
 }
 // re-render output with applied tips appended
 const o=document.getElementById('genOutput');
 const base=o.dataset.base||o.dataset.raw;
 o.dataset.base=base;
 let full=base;
 appliedTips.forEach(a=>{full+="\n\n+ "+a;});
 o.innerHTML=full.replace(/\[([^\]]+)\]/g,'<span class="gen-ph">[$1]</span>');
 o.dataset.raw=full;
 // update tip button states
 document.querySelectorAll('.gen-tip').forEach(b=>{});
 buildTipStates();
}
function buildTipStates(){
 document.querySelectorAll('.gen-tip').forEach(btn=>{
  const tx=btn.querySelector('.gen-tip-tx').textContent;
  btn.classList.toggle('on',appliedTips.has(tx));
 });
}

// quando muda qualquer opção, reseta as tips aplicadas e a base
const _origBuildGen=buildGen;
buildGen=function(){appliedTips=new Set();_origBuildGen();const o=document.getElementById('genOutput');o.dataset.base=o.dataset.raw;};

// ---------- COPIAR / SALVAR ----------
function copyGenerated(){
 const txt=document.getElementById('genOutput').dataset.raw||'';
 if(!txt){showToast(t('gen_configure_first'),true);return;}
 navigator.clipboard.writeText(txt).then(()=>{
  const b=document.getElementById('genCopyBtn');const o=b.innerHTML;b.textContent='✓ Copiado!';
  setTimeout(()=>b.innerHTML=o,2000);showToast(t('copied'));
 }).catch(()=>fallbackCopy(txt));
}
function openSaveGenerated(){
 const txt=document.getElementById('genOutput').dataset.raw||'';
 if(!txt){showToast(t('gen_configure_first'),true);return;}
 if(!db.projects.length){showToast(t('gen_need_category'),true);return;}
 const sel=document.getElementById('genSaveProject');
 sel.innerHTML=db.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
 document.getElementById('genSaveTitle').value='';
 document.getElementById('genSaveTag').value=genMode==='image'?'IMAGEM':genMode==='text'?'TEXTO':genMode==='emoji'?'EMOJI':genMode==='video'?'VÍDEO':genMode==='logo'?'LOGO':genMode==='char'?'PERSONAGEM':genMode==='retouch'?'RETOQUE':genMode==='poster'?'POSTER':conMode==='clean'?'LIMPAR TERRENO':conMode==='build'?'CONSTRUÇÃO':conMode==='timelapse'?'TIMELAPSE':'LOTEAMENTO';
 document.getElementById('genSaveModal').classList.add('open');
}
// alias usado pelo atalho Enter no modal de salvar do gerador
function saveGenerated(){saveGeneratedCard();}
async function saveGeneratedCard(){
 const title=document.getElementById('genSaveTitle').value.trim();
 if(!title){document.getElementById('genSaveTitle').focus();return;}
 const projId=document.getElementById('genSaveProject').value;
 const tag=document.getElementById('genSaveTag').value.trim();
 const text=document.getElementById('genOutput').dataset.raw||'';
 if(!text){showToast(t('gen_need_prompt'),true);return;}
 const p=db.projects.find(x=>x.id===projId);if(!p)return;
 if(!p.cards)p.cards=[];
 // camadas extras aplicadas viram a descrição/dica do card
 let desc='';
 if(appliedTips.size){
   desc='Camadas extras aplicadas: '+[...appliedTips].join(' | ');
 }
 try{
  const res=await apiPost('/categories/'+projId+'/prompts',promptPayload({
    title,text,tag,desc,thumb:'',thumb2:'',
    thumbPos:{x:'center',y:'center'},thumbPos2:{x:'center',y:'center'},
    attachment:'',attachmentName:'',favorite:false,subcats:[]
  }));
  p.cards.push(mapPrompt(res.data||res));
  closeModal('genSaveModal');showToast('Card salvo em "'+p.name+'"!');
 }catch(err){showToast(err.message,true);}
}

// ── USER MENU / GATES ────────────────────────────────────
function toggleUserMenu(){
  document.getElementById('userMenu').classList.toggle('open');
}
document.addEventListener('mousedown',e=>{
  if(!e.target.closest('.user-menu-wrap')){
    const m=document.getElementById('userMenu');
    if(m)m.classList.remove('open');
  }
});

function fmtBytes(b){
  if(b>=1073741824)return (b/1073741824).toFixed(1)+' GB';
  if(b>=1048576)return (b/1048576).toFixed(1)+' MB';
  if(b>=1024)return (b/1024).toFixed(0)+' KB';
  return b+' B';
}

function fillUserMenu(){
  const u=PROMPTART.user;
  document.getElementById('umName').textContent=u.name;
  document.getElementById('umEmail').textContent=u.email;
  let planTxt;
  if(u.is_admin){
    planTxt=t(u.is_master?'plan_master':'plan_admin');
  } else if(u.plan_label){
    planTxt=u.access_ends_at
      ? t('plan_renews',{plan:u.plan_label,date:new Date(u.access_ends_at).toLocaleDateString(LOCALE)})
      : t('plan_named',{plan:u.plan_label});
  } else if(u.on_trial){
    const days=Math.max(0,Math.ceil((new Date(u.trial_ends_at)-Date.now())/86400000));
    planTxt=t('plan_trial',{days:tp('plan_days',days),date:new Date(u.trial_ends_at).toLocaleDateString(LOCALE)});
  } else {planTxt=t('plan_none');}
  document.getElementById('umPlan').textContent=planTxt;
  // limite null = ilimitado (ADM master): mostra só o usado, sem barra
  const semLimite=u.storage_limit_bytes==null;
  document.getElementById('umStorageTxt').textContent=semLimite
    ? fmtBytes(u.storage_used_bytes)+' — '+t('storage_unlimited')
    : fmtBytes(u.storage_used_bytes)+' / '+fmtBytes(u.storage_limit_bytes);
  const pct=(!semLimite&&u.storage_limit_bytes)?Math.min(100,Math.round(u.storage_used_bytes/u.storage_limit_bytes*100)):0;
  document.getElementById('umStorageFill').style.width=pct+'%';
}

function applyPlanGates(){
  const u=PROMPTART.user;
  // Biblioteca bônus: botão só aparece para quem tem acesso (premium)
  document.getElementById('bonusBtn').style.display=u.has_bonus_library?'':'none';
  // Gerador: sempre visível (é isca de conversão) — sem acesso, mostra upsell
  document.getElementById('generatorBtn').classList.toggle('premium-lock',!u.has_generator);
  // Exportar/Importar saíram do topo — agora vivem em Minha Conta,
  // onde o próprio Blade só os mostra para o ADM master.
}

// ── INIT ─────────────────────────────────────────────────
loadTheme();
fillUserMenu();
applyPlanGates();
loadDB().then(data=>{
  db=data;
  document.getElementById('loading').style.display='none';
  document.getElementById('headerSearchWrap').style.display='';
  document.getElementById('headerNewBtn')?.style.setProperty('display','');
  renderProjects();
  const chk=document.getElementById('autoSpin'); if(chk) chk.checked=giroAutomatico;
  abrirCategoriaInicial();
  setPage('home');
  carregarAvisos();
  showDailyTip();
  // deep-link /app/bonus → abre a biblioteca bônus direto
  if(window.location.pathname.endsWith('/app/bonus')&&PROMPTART.user.has_bonus_library){
    openBonusLibrary();
  }
}).catch(err=>{
  document.getElementById('loading').innerHTML='<p style="color:var(--danger);">Erro ao carregar: '+err.message+'</p>';
});

// ══════════════════════════════════════════════════════════
// ÁREA COLABORATIVA (COMUNIDADE)
// ══════════════════════════════════════════════════════════
let communitySort='recent';
let communityOnly='all';
let communityItems=[];

function hideAllPages(){
  ['homePage','generatorPage','favoritesPage','communityPage'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.classList.remove('active');
  });
}

async function openCommunity(){
  bonusMode=false;
  setTimeout(()=>setPage('community'),0);
  registrarNoHistorico('community');
  carregarRanking();
  hideAllPages();
  document.getElementById('communityPage').classList.add('active');
  document.getElementById('headerSearchWrap').style.display='none';
  document.getElementById('headerNewBtn')?.style.setProperty('display','none');
  await loadCommunity();
}

function setCommunitySort(sort){
  communitySort=sort;
  document.getElementById('commSortRecent').classList.toggle('active',sort==='recent');
  document.getElementById('commSortTop').classList.toggle('active',sort==='top');
  loadCommunity();
}

/* O botão de setas alterna a ordem; a pílula "Mais curtidos" faz o mesmo por
   outro caminho, e as duas refletem o mesmo estado. */
function toggleCommunitySort(){
  setCommunitySort(communitySort==='top' ? 'recent' : 'top');
}

function setCommunityOnly(only){
  communityOnly=only;
  document.getElementById('commAll').classList.toggle('active',only==='all');
  document.getElementById('commFavs').classList.toggle('active',only==='favorites');
  loadCommunity();
}

async function loadCommunity(){
  const grid=document.getElementById('communityGrid');
  const search=(document.getElementById('communitySearch').value||'').trim();
  try{
    const qs=new URLSearchParams({sort:communitySort});
    if(search)qs.set('search',search);
    if(communityOnly==='favorites')qs.set('only','favorites');
    communityItems=await apiGet('/shared?'+qs.toString());
    renderCommunity();
  }catch(err){
    grid.innerHTML='<div class="empty-state"><p>'+err.message+'</p></div>';
  }
}

function authorBadge(author){
  const cls=author.is_premium?'av-premium':'av-common';
  const crown=author.is_premium?'<span class="av-crown" style="font-size:9px;">👑</span>':'';
  const inner=author.avatar_url
    ?`<img src="${author.avatar_url}" class="av ${cls}" style="width:24px;height:24px;">`
    :`<div class="av av-fallback ${cls}" style="width:24px;height:24px;font-size:9px;">${author.initials||'?'}</div>`;
  return `<span class="av-wrap" style="width:24px;height:24px;">${crown}${inner}</span>`;
}

function renderCommunity(){
  const grid=document.getElementById('communityGrid');
  document.getElementById('communityDesc').textContent=
    tp('shared_count',communityItems.length);
  grid.innerHTML='';
  if(!communityItems.length){
    grid.innerHTML=communityOnly==='favorites'
      ?'<div class="empty-state"><p>'+t('empty_community_favs')+'</p></div>'
      :'<div class="empty-state"><p>'+t('empty_community')+'</p></div>';
    return;
  }
  communityItems.forEach(sp=>{
    const rawText=(sp.body||'').replace(/<[^>]+>/g,'');
    const preview=rawText.length>200?rawText.slice(0,200)+'…':rawText;
    const d=document.createElement('div');
    d.className='prompt-card';
    d.onclick=e=>{ if(e.target.closest('button'))return; viewSharedPrompt(sp.id); };
    const thumbHtml=sp.thumb1_thumb_url
      ?`<div class="pc-thumb"><img src="${sp.thumb1_thumb_url}" loading="lazy" onerror="this.style.display='none'"></div>`
      :`<div class="pc-thumb">👥</div>`;
    d.innerHTML=`
      <div class="pc-media">${thumbHtml}<div class="pc-scrim"></div></div>
      ${sp.tag?`<span class="pc-tag">${sp.tag}</span>`:''}
      <div class="pc-top-actions">
        <button class="pc-round${sp.favorited_by_me?' active':''}" onclick="toggleSharedFavorite(${sp.id},event)" title="${sp.favorited_by_me?t('fav_removed'):t('fav_added')}">
          ${sp.favorited_by_me?ICO_STAR_ON:ICO_STAR_OFF}
        </button>
        <button class="pc-round" onclick="toggleSharedLike(${sp.id},event)" title="${t('most_liked')}">
          <span style="font-size:14px;line-height:1;">${sp.liked_by_me?'❤️':'🤍'}</span>
        </button>
      </div>
      <div class="pc-over">
        <div class="pc-title">${sp.title||''}</div>
        <div class="pc-preview">${preview}</div>
      </div>
      <div class="pc-panel">
        <div style="display:flex;align-items:center;gap:.4rem;">
          ${authorBadge(sp.author)}
          <span style="font-size:.7rem;color:var(--muted);font-weight:700;">${sp.author.name||'—'}</span>
        </div>
        <div class="pc-title">${sp.title||''}</div>
        <div class="pc-preview">${preview}</div>
        <div class="pc-footer">
          <span class="pc-chars">❤️ ${sp.likes_count} · 📋 ${sp.copies_count}</span>
          ${sp.is_mine?`<div class="pc-actions"><button class="ibtn ibtn-sm danger" onclick="unshareePrompt(${sp.id},event)" title="${t('confirm_unshare')}">✕</button></div>`:''}
        </div>
        <button class="pc-copy" id="shcopy_${sp.id}" onclick="copySharedText(${sp.id},event)">
          ${ICO_COPY} ${t('copy_btn')}
        </button>
      </div>`;
    grid.appendChild(d);
  });
}

function viewSharedPrompt(id){
  const sp=communityItems.find(x=>x.id===id);
  if(!sp)return;
  viewingCardId=null;
  viewingText=(sp.body||'').replace(/<[^>]+>/g,'');
  const tagEl=document.getElementById('viewTag');
  tagEl.textContent=sp.tag||''; tagEl.style.display=sp.tag?'':'none';
  document.getElementById('viewTitle').textContent=sp.title||'';
  const descEl=document.getElementById('viewDesc');
  if(sp.description&&sp.description.replace(/<[^>]+>/g,'').trim()){
    descEl.innerHTML=sanitizeColors(sp.description); descEl.style.display='';
  } else { descEl.style.display='none'; }
  document.getElementById('viewText').innerHTML=sanitizeColors(sp.body||'');
  const imgCol=document.getElementById('viewImgCol');
  const imgWrap=document.getElementById('viewImgWrap');
  if(sp.thumb1_thumb_url){
    imgCol.classList.remove('hidden');
    imgWrap.innerHTML=`<img src="${sp.thumb1_thumb_url}" style="cursor:zoom-in;" onclick="openImgLightbox('${(sp.thumb1_url||'').replace(/'/g,"\\'")}')">`;
  } else { imgCol.classList.add('hidden'); imgWrap.innerHTML=''; }
  document.getElementById('viewAtts').innerHTML='';
  document.getElementById('viewEditBtn').style.display='none';
  document.getElementById('viewModal').classList.add('open');
}

async function toggleSharedLike(id,e){
  e&&e.stopPropagation();
  try{
    const res=await apiPost('/shared/'+id+'/like');
    const sp=communityItems.find(x=>x.id===id);
    if(sp){sp.liked_by_me=res.liked;sp.likes_count=res.likes_count;}
    renderCommunity();
  }catch(err){showToast(err.message,true);}
}

async function unshareePrompt(id,e){
  e&&e.stopPropagation();
  if(!confirm(t('confirm_unshare')))return;
  try{
    await apiDelete('/shared/'+id);
    communityItems=communityItems.filter(x=>x.id!==id);
    renderCommunity();
    showToast(t('unshared'));
  }catch(err){showToast(err.message,true);}
}

async function toggleSharedFavorite(id,e){
  e&&e.stopPropagation();
  try{
    const res=await apiPost('/shared/'+id+'/favorite');
    const sp=communityItems.find(x=>x.id===id);
    if(sp)sp.favorited_by_me=res.favorited;
    // na aba "meus favoritos", desfavoritar remove o card da lista
    if(communityOnly==='favorites'&&!res.favorited){
      communityItems=communityItems.filter(x=>x.id!==id);
    }
    renderCommunity();
    showToast(t(res.favorited?'fav_added':'fav_removed'));
  }catch(err){showToast(err.message,true);}
}

/** Copia o texto do prompt (não salva nas categorias do usuário). */
async function copySharedText(id,e){
  e&&e.stopPropagation();
  const sp=communityItems.find(x=>x.id===id);
  if(!sp)return;
  const plain=(sp.body||'').replace(/<b>(.*?)<\/b>/gi,'$1').replace(/<span[^>]*>(.*?)<\/span>/gi,'$1').replace(/<[^>]+>/g,'');
  try{
    await navigator.clipboard.writeText(plain);
  }catch(_){ fallbackCopy(plain); }
  const btn=document.getElementById('shcopy_'+id);
  if(btn){const o=btn.innerHTML;btn.classList.add('copied');btn.textContent='✓ Copiado';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML=o;},2000);}
  showToast(t('copied'));
  try{
    const res=await apiPost('/shared/'+id+'/copy');
    if(sp)sp.copies_count=res.copies_count;
  }catch(_){}
}

/* O ranking é a lista de quem publicou, do que mais publica para o que menos.
   Não há número fixo de posições: quem não compartilhou nada não aparece. */
async function carregarRanking(){
  const box = document.getElementById('rankingBox');
  if(!box) return;

  let ranking = [];
  try{ ranking = await apiGet('/shared/ranking'); }
  catch(e){ /* o ranking é acessório: falhar aqui não pode derrubar a tela */ }

  if(!ranking.length){
    box.innerHTML = `<p class="rank-vazio">${t('ranking_empty')}</p>`;
    return;
  }

  box.innerHTML = ranking.map((u,i)=>{
    const medalha = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return `<div class="rank-item">
      <span class="rank-pos">${medalha || (i+1)}</span>
      <span class="rank-avatar">${authorBadge(u)}</span>
      <span class="rank-info">
        <strong>${esc(u.name)}</strong>
        <em>${u.shared_count} ${u.shared_count===1?t('prompt_one'):t('prompt_many')}</em>
      </span>
      <span class="rank-likes">❤️ ${u.likes_total}</span>
    </div>`;
  }).join('');
}

/** Compartilha um card do usuário na comunidade. */
async function sharePromptToCommunity(cardId,e){
  e&&e.stopPropagation();
  if(!confirm(t('confirm_share')))return;
  try{
    const res=await apiPost('/prompts/'+cardId+'/share');
    showToast(res.message||t('shared_ok'));
  }catch(err){showToast(err.message,true);}
}

// ── DICA DO DIA (pop-up no login) ────────────────────────
async function showDailyTip(){
  try{
    const res=await apiGet('/tips/random');
    if(res.tip){
      document.getElementById('tipTitle').textContent=res.tip.title;
      document.getElementById('tipBody').textContent=res.tip.body;
      setTimeout(()=>document.getElementById('tipModal').classList.add('open'),900);
    }
  }catch(_){}
}

/* ══════════════════════════════════════════════════════════════
   CABEÇALHO DE PÁGINA — título, pílula ativa e contadores
   Um bloco só serve todas as telas; quem muda é o título e a
   pílula marcada. Chamado por setPage() no fim de cada navegação.
   ══════════════════════════════════════════════════════════════ */
function setPage(qual, tituloExtra){
  const titulos = {
    home:      t('welcome_user', {name: (PROMPTART.user.name||'').split(' ')[0]}),
    favorites: t('favorites'),
    community: t('community'),
    bonus:     t('bonus_library'),
    generator: t('gen_title'),
  };
  const el = document.getElementById('pageTitle');
  if(el) el.textContent = tituloExtra || titulos[qual] || '';

  const pills = {home:'navHome', favorites:'navFavorites', community:'navCommunity',
                 bonus:'navBonus', generator:'navGenerator'};
  Object.values(pills).forEach(id=>{
    const b=document.getElementById(id); if(b) b.classList.remove('active');
  });
  const ativo=document.getElementById(pills[qual]);
  if(ativo) ativo.classList.add('active');

  // sair da busca ao trocar de aba — antes o X e o texto ficavam lá
  if(qual !== 'home') clearGlobalSearch();

  atualizarContadores();
  // a aba que acabou de abrir precisa medir a própria altura e ganhar as barras
  requestAnimationFrame(()=>{ ligarTodasAsBarras(); ajustarAlturaDosPaineis(); });
}

/* Categorias e prompts saem do que já está carregado; compartilhados
   vêm do servidor (não estão em db). */
function atualizarContadores(){
  const cats = (db.projects||[]).length;
  const prompts = (db.projects||[]).reduce((n,p)=>n+((p.cards||[]).length),0);
  const setN=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  setN('cntCategories', cats);
  setN('cntPrompts', prompts);
  if(PROMPTART.counts && typeof PROMPTART.counts.shared==='number') setN('cntShared', PROMPTART.counts.shared);
}

/* Escapa HTML — os avisos são texto livre digitado no painel ADM
   e não podem virar marcação dentro do app. */
function esc(txt){
  return String(txt==null?'':txt)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ══ SINO ══ */
async function toggleNotifications(){
  const p=document.getElementById('notifPanel');
  if(!p) return;
  const abrindo=!p.classList.contains('open');
  p.classList.toggle('open', abrindo);
  if(abrindo) await marcarAvisosLidos();
}

/* Abrir o painel zera a bolinha no servidor, não só na tela — senão ela
   voltaria na próxima visita. */
async function marcarAvisosLidos(){
  const c=document.getElementById('bellCount');
  if(c) c.style.display='none';
  try{ await apiPost('/announcements/read'); }catch(e){ /* a bolinha volta na próxima carga */ }
  document.querySelectorAll('.notif-item.unread').forEach(el=>el.classList.remove('unread'));
}

/* Busca os avisos e acende a bolinha com quantos ainda não foram vistos. */
async function carregarAvisos(){
  try{
    const r = await apiGet('/announcements');
    renderNotificacoes(r.items||[]);
    const c=document.getElementById('bellCount');
    if(c){
      c.textContent = r.unread > 9 ? '9+' : String(r.unread||0);
      c.style.display = r.unread ? '' : 'none';
    }
  }catch(e){ renderNotificacoes([]); }
}

function renderNotificacoes(lista){
  const el=document.getElementById('notifList');
  if(!el) return;
  if(!lista || !lista.length){
    el.innerHTML='<div class="notif-empty">'+t('no_notifications')+'</div>';
    return;
  }
  el.innerHTML=lista.map(n=>`
    <div class="notif-item${n.lida?'':' unread'}">
      <strong>${esc(n.title||'')}</strong>${esc(n.body||'')}
      <span class="notif-date">${n.date||''}</span>
    </div>`).join('');
}

// fecha o painel ao clicar fora
document.addEventListener('click', e=>{
  const w=document.querySelector('.bell-wrap');
  if(w && !w.contains(e.target)) document.getElementById('notifPanel')?.classList.remove('open');
});

/* ══════════════════════════════════════════════════════════════
   CARD DE CATEGORIA — duas camadas
   Frente na cor escolhida (nome + contagem + Editar); atrás um
   tom mais escuro que desce no hover revelando a descrição.
   A categoria aberta fica travada no estado de hover, e é assim
   que ela se distingue das outras na coluna.
   ══════════════════════════════════════════════════════════════ */
function cardCategoria(p, {editavel=true, aoAbrir=null} = {}){
  const qtd = p.promptsCount ?? (p.cards||[]).length;
  const el = document.createElement('div');
  el.className = 'cat-card';
  el.dataset.id = p.id;
  el.style.setProperty('--cor', p.color || '#007aff');
  el.style.setProperty('--cor-fundo', p.colorBack || '#0062cc');
  el.style.setProperty('--cor-texto', p.colorText || '#ffffff');
  if(String(currentProjId) === String(p.id)) el.classList.add('aberta');

  el.innerHTML = `
    <div class="cat-atras"><span>${esc(p.desc || t('no_description'))}</span></div>
    <div class="cat-frente">
      <div class="cat-nome">${esc(p.name)}</div>
      <div class="cat-rodape">
        <span class="cat-qtd">${qtd} ${qtd===1?t('prompt_one'):t('prompt_many')}</span>
        ${editavel ? `<button class="cat-editar" title="${t('cat_edit')}">${t('edit')}</button>` : ''}
      </div>
    </div>`;

  el.onclick = e => {
    if(e.target.closest('.cat-editar')){ editProject(p.id, e); return; }
    if(aoAbrir) aoAbrir();
  };
  return el;
}

/* ══ COR NO MODAL DE CATEGORIA ══
   Paleta própria, no lugar do seletor do sistema: 24 tons escolhidos para
   funcionarem como identificação de categoria, mais o campo hexadecimal para
   quem quiser um tom exato. */
const PALETA_CATEGORIAS = [
  '#007AFF','#00A3E0','#00C7BE','#00B050',
  '#D2DAE0','#AAB0B4','#8E99A4','#5B6770',
  '#7FD13B','#FFD60A','#FF9F0A','#FF8A00',
  '#FF6B35','#FF3B30','#EC008C','#D6336C',
  '#B14AED','#8E44AD','#5E5CE6','#3A3A6E',
  '#A0522D','#C69C6D','#6B4F3A','#2B3440',
];

function corAtualDoModal(){
  const v = (document.getElementById('projColorHex').value || '').trim();
  return /^#?[0-9a-fA-F]{6}$/.test(v) ? (v[0]==='#'?v:'#'+v) : '#D2DAE0';
}

function pintarAmostra(hex){
  const dot = document.getElementById('projColorDot');
  if(dot) dot.style.background = hex;
  document.querySelectorAll('#projPaleta .paleta-cor').forEach(b=>{
    b.classList.toggle('escolhida', b.dataset.cor.toLowerCase() === hex.toLowerCase());
  });
}

function onColorHexInput(){ pintarAmostra(corAtualDoModal()); }

function onColorPicked(hex){
  document.getElementById('projColorHex').value = hex.toUpperCase();
  pintarAmostra(hex);
}

function montarPaleta(){
  const cx = document.getElementById('projPaleta');
  if(!cx || cx.dataset.pronta) return;
  cx.dataset.pronta = '1';
  PALETA_CATEGORIAS.forEach(cor=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paleta-cor';
    b.dataset.cor = cor;
    b.style.background = cor;
    b.title = cor;
    b.onclick = () => { onColorPicked(cor); fecharPaleta(); };
    cx.appendChild(b);
  });
}

function togglePaleta(e){
  e && e.stopPropagation();
  montarPaleta();
  document.getElementById('projPaleta')?.classList.toggle('aberta');
}
function fecharPaleta(){ document.getElementById('projPaleta')?.classList.remove('aberta'); }
document.addEventListener('click', e=>{
  if(!e.target.closest('.color-row') && !e.target.closest('.paleta')) fecharPaleta();
});

/* Excluir a categoria de dentro da edição, como pedido: some da grade e
   aparece só quando o modal está editando algo existente. */
async function deleteProjectFromModal(){
  if(!editingProjId) return;
  const p = db.projects.find(x=>x.id===editingProjId);
  if(!p || !confirm(t('confirm_delete_cat',{name:p.name}))) return;
  try{
    await apiDelete('/categories/'+editingProjId);
    db.projects = db.projects.filter(x=>x.id!==editingProjId);
    if(currentProjId===editingProjId) currentProjId=null;
    closeModal('projModal');
    renderProjects();
    abrirCategoriaInicial();
    atualizarContadores();
    showToast(t('cat_deleted'));
  }catch(err){ showToast(err.message,true); }
}


/* ══════════════════════════════════════════════════════════════
   COLUNA DE CATEGORIAS — roda giratória e lista
   A roda é um cilindro em CSS: cada card fica a um ângulo, e a
   barra lateral (ou o scroll do mouse) gira o conjunto.
   ══════════════════════════════════════════════════════════════ */
let modoCategorias = localStorage.getItem('modoCategorias') || 'roda';
let anguloRoda = 0;
let giroAutomatico = localStorage.getItem('giroAutomatico') === '1';
let timerGiro = null;

const PASSO_RODA = 100;  // "unidades" entre um card e o próximo (1 card = 100)

function setModoCategorias(modo){
  modoCategorias = modo;
  localStorage.setItem('modoCategorias', modo);
  aplicarModoCategorias();
  posicionarRoda();
}

/* Na biblioteca bônus o assinante não cria nem edita nada: some o
   "+ Nova categoria" e as ferramentas do painel, e a busca ocupa o espaço. */
function aplicarModoBonus(){
  const novo = document.getElementById('btnNovaCategoria');
  if(novo) novo.style.display = bonusMode ? 'none' : '';
  const painel = document.getElementById('catPanel');
  if(painel) painel.classList.toggle('somente-leitura', bonusMode);
}

function aplicarModoCategorias(){
  const palco = document.getElementById('catStage');
  const roda  = document.getElementById('projectsGrid');
  if(!palco || !roda) return;
  const naRoda = modoCategorias === 'roda';
  palco.classList.toggle('modo-roda', naRoda);
  palco.classList.toggle('modo-lista', !naRoda);
  document.getElementById('viewWheelBtn')?.classList.toggle('active', naRoda);
  document.getElementById('viewListBtn')?.classList.toggle('active', !naRoda);
  const trilho = document.getElementById('wheelRail');
  if(trilho) trilho.style.display = naRoda ? '' : 'none';
  // no modo lista a coluna usa a barra padrão; ela só existe depois da troca
  if(!naRoda) ligarBarra(palco);
  if(!naRoda) pararGiro();
  else if(giroAutomatico) iniciarGiro();
}

/* Pilha vertical: o card do meio fica na frente, inteiro; os de cima e de
   baixo recuam encolhendo, clareando e desfocando. A distância usa tanh, que
   afasta os vizinhos e comprime quem está longe — é o que dá a sensação de
   profundidade sem o card sumir. O cilindro 3D antigo embolava os cards. */
function posicionarRoda(){
  const cards = [...document.querySelectorAll('#projectsGrid .cat-card')];
  if(!cards.length) return;

  if(modoCategorias !== 'roda'){
    cards.forEach(c=>{
      c.style.transform=''; c.style.opacity=''; c.style.zIndex='';
      c.style.pointerEvents=''; c.style.filter='';
    });
    return;
  }

  const palco = document.getElementById('catStage');
  // a pilha ocupa dois terços da altura da coluna, centrada...
  const alcance = Math.max(120, (palco ? palco.clientHeight : 480) / 3);
  // ...mas o vizinho fica sempre a uma altura de card de distância, senão numa
  // coluna alta os cards ficavam longe demais um do outro
  // o primeiro card pode estar aberto (mais alto): mede um fechado
  const alturaCard = cards[cards.length-1].offsetHeight || 86;
  // o vizinho nunca passa de metade do alcance, senão a curva fica tão íngreme
  // que todo o resto da pilha desaba no limite
  const vizinho = Math.min(alcance * .5, alturaCard * 1.06);
  const curva = Math.atanh(vizinho / alcance);
  const centro = anguloRoda / PASSO_RODA;

  cards.forEach((c,i)=>{
    const d = i - centro;                       // distância em cards
    const dist = Math.abs(d);
    const y = Math.tanh(d * curva) * alcance;
    const escala = Math.max(.62, 1 - dist * .085);
    const opacidade = Math.max(0, 1 - dist * .26);

    c.style.transform = `translate(-50%,-50%) translateY(${y}px) scale(${escala})`;
    c.style.opacity = String(opacidade);
    c.style.filter = dist > .6 ? `blur(${Math.min(dist * .7, 2.4)}px)` : '';
    c.style.zIndex = String(Math.round(200 - dist * 10));
    c.style.pointerEvents = opacidade > .15 ? 'auto' : 'none';
    c.classList.toggle('no-foco', dist < .5);
  });
  atualizarTrilho(cards.length);
}

/* Gira até a categoria pedida ficar no centro. É o que evita o vazio em cima:
   as anteriores aparecem acima, as seguintes abaixo. */
function centralizarNaCategoria(id){
  if(modoCategorias!=='roda') return;
  const lista = bonusMode ? bonusProjects : (db.projects||[]);
  const ordenada = sortItems([...lista], getSortProj(), 'name');
  const i = ordenada.findIndex(p=>String(p.id)===String(id));
  if(i<0) return;
  irParaRoda(i*PASSO_RODA);
}

/* O giro andava direto no transform, e cada evento da rodinha reiniciava a
   transição do CSS — daí o tremor. Agora a rodinha só move um ALVO, e um laço
   de animação leva a pilha até ele suavemente. */
let alvoRoda = 0, laçoRoda = null;

function girarRoda(delta){
  const total = document.querySelectorAll('#projectsGrid .cat-card').length;
  if(!total) return;
  const max = (total-1)*PASSO_RODA;
  alvoRoda = Math.min(max, Math.max(0, alvoRoda + delta));
  iniciarLaçoRoda();
}

function irParaRoda(valor){   // salto sem animação (abrir uma categoria)
  if(laçoRoda){ clearInterval(laçoRoda); laçoRoda = null; }
  alvoRoda = anguloRoda = valor;
  posicionarRoda();
}

function iniciarLaçoRoda(){
  if(laçoRoda) return;
  // temporizador em vez de requestAnimationFrame: alguns navegadores seguram
  // o rAF quando a janela não está na frente, e a pilha ficava congelada
  laçoRoda = setInterval(() => {
    const falta = alvoRoda - anguloRoda;
    if(Math.abs(falta) < 0.4){
      anguloRoda = alvoRoda;
      posicionarRoda();
      clearInterval(laçoRoda);
      laçoRoda = null;
      return;
    }
    anguloRoda += falta * 0.22;
    posicionarRoda();
  }, 16);
}

function atualizarTrilho(total){
  const thumb = document.getElementById('wheelThumb');
  const rail  = document.getElementById('wheelRail');
  if(!thumb || !rail || total<2) return;

  // cola o trilho no palco: sem isto a bolinha nascia lá em cima, ao lado
  // do botão "+ Nova Categoria"
  const palco = document.getElementById('catStage');
  if(palco && palco.offsetHeight){
    rail.style.top    = palco.offsetTop + 'px';
    rail.style.height = palco.offsetHeight + 'px';
    rail.style.bottom = 'auto';
  }
  const max = (total-1)*PASSO_RODA;
  const pct = max ? anguloRoda/max : 0;
  thumb.style.top = (pct*(rail.clientHeight - thumb.offsetHeight))+'px';
}

/* ══ giro automático ══ */
function setGiroAutomatico(ligado){
  giroAutomatico = ligado;
  localStorage.setItem('giroAutomatico', ligado ? '1' : '0');
  ligado ? iniciarGiro() : pararGiro();
}

function iniciarGiro(){
  pararGiro();
  if(modoCategorias !== 'roda') return;
  timerGiro = setInterval(()=>{
    const total = document.querySelectorAll('#projectsGrid .cat-card').length;
    const max = (total-1)*PASSO_RODA;
    alvoRoda = alvoRoda >= max ? 0 : alvoRoda + 1.1;
    if(alvoRoda === 0) anguloRoda = 0;
    iniciarLaçoRoda();
  }, 40);
}

function pararGiro(){ if(timerGiro){ clearInterval(timerGiro); timerGiro=null; } }

/* Arrastar o trilho, e a rodinha do mouse sobre a coluna, giram o cilindro. */

/* ══════════════════════════════════════════════════════════════
   BARRA LATERAL PADRÃO
   Uma barra só para o app inteiro: trilho cinza com a bolinha azul
   que o usuário puxa. A barra nativa fica escondida pelo CSS. Vale
   para categorias, cards, favoritos, comunidade, bônus e gerador.
   ══════════════════════════════════════════════════════════════ */
function ligarBarra(elemento){
  if(!elemento || elemento.dataset.temBarra) return;
  elemento.dataset.temBarra = '1';
  elemento.classList.add('rola');

  const pai = elemento.parentElement;
  if(!pai) return;
  pai.classList.add('tem-barra');

  const trilho = document.createElement('div');
  trilho.className = 'barra-lateral';
  const bolinha = document.createElement('div');
  bolinha.className = 'barra-bolinha';
  trilho.appendChild(bolinha);
  pai.appendChild(trilho);

  const sobra = () => elemento.scrollHeight - elemento.clientHeight;

  /* O trilho ficava colado no card inteiro, então a bolinha nascia lá em cima,
     ao lado do título e dos botões. Ele agora acompanha exatamente a área que
     rola: começa onde os cards começam e termina onde eles terminam. */
  function alinhar(){
    const e = getComputedStyle(elemento);
    const topo  = parseFloat(e.borderTopWidth)    || 0;
    const cima  = parseFloat(e.paddingTop)        || 0;
    const baixo = parseFloat(e.paddingBottom)     || 0;
    trilho.style.top    = (elemento.offsetTop + topo + cima) + 'px';
    trilho.style.height = (elemento.offsetHeight - topo - cima - baixo) + 'px';
    /* Onde encostar a barra na horizontal.
       Quando o contêiner abraça a área que rola (coluna de categorias, painéis),
       a referência é a borda DELE — a coluna tem folga interna, e medir pela
       caixa que rola deixava a barra para dentro, quase nos cards.
       Quando o contêiner é um layout de várias colunas (a grade do gerador), a
       referência tem que ser a borda do PRÓPRIO elemento, senão a barra da
       coluna do meio vai parar na extremidade da tela. */
    const pai = trilho.offsetParent || elemento.parentElement;
    const direita = elemento.offsetLeft + elemento.offsetWidth;
    const abraca = pai && (pai.clientWidth - direita) <= 40;

    trilho.style.left   = ((abraca ? pai.clientWidth : direita) - 12) + 'px';
    trilho.style.right  = 'auto';
    trilho.style.bottom = 'auto';
  }

  function desenhar(){
    alinhar();
    const s = sobra();
    trilho.style.display = s > 8 ? '' : 'none';
    if(s <= 8) return;
    const curso = trilho.clientHeight - bolinha.offsetHeight;
    bolinha.style.top = (elemento.scrollTop / s * curso) + 'px';
  }

  let puxando = false;
  const mover = e => {
    if(!puxando) return;
    const r = trilho.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientY - r.top - bolinha.offsetHeight/2) / (r.height - bolinha.offsetHeight)));
    elemento.scrollTop = pct * sobra();
  };
  bolinha.addEventListener('mousedown', e => { puxando = true; trilho.classList.add('ativa'); e.preventDefault(); });
  trilho.addEventListener('mousedown', e => { if(e.target === trilho){ puxando = true; mover(e); } });
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', () => { if(puxando){ puxando = false; trilho.classList.remove('ativa'); } });

  elemento.addEventListener('scroll', desenhar, {passive:true});
  const olho = new ResizeObserver(desenhar);
  olho.observe(elemento);
  if(elemento.firstElementChild) olho.observe(elemento.firstElementChild);
  // os cards entram depois do primeiro desenho
  new MutationObserver(desenhar).observe(elemento, {childList:true, subtree:true});
  desenhar();
  elemento.__redesenharBarra = desenhar;
}

/* Todo contêiner que rola ganha a mesma barra. */
function ligarTodasAsBarras(){
  document.querySelectorAll('.panel-body, .cat-stage.modo-lista, .painel-cheio-corpo, .gen-meio, .gen-bloco-camadas .gen-tips')
    .forEach(ligarBarra);
}

/* ══════════════════════════════════════════════════════════════
   ALTURA DOS PAINÉIS
   Os painéis tinham altura fixa por conta (100vh menos um chute), e
   sobrava um pedaço no pé da página em várias abas. Agora a altura é
   medida: vai daqui até o fim da janela.
   ══════════════════════════════════════════════════════════════ */
function ajustarAlturaDosPaineis(){
  const FOLGA = 22;
  const janela = window.innerHeight || document.documentElement.clientHeight;
  if(!janela) return;   // navegador ainda não sabe o tamanho: tenta de novo depois
  document.querySelectorAll('.cat-column, .panel-body, .painel-cheio, .gen-meio, .gen-rail, .gen-direita')
    .forEach(el => {
      if(!el.offsetParent && el.offsetHeight === 0) return;   // está numa aba escondida
      const topo = el.getBoundingClientRect().top;
      const altura = janela - topo - FOLGA;

      /* Piso por elemento. A coluna do gerador empilha DOIS blocos; abaixo
         disto a conta só serviria para espremer um por cima do outro. Sem
         altura fixa ela volta a fluir e quem rola é a página — feio, mas
         legível, que é o que importa numa tela apertada. */
      const piso = el.classList.contains('gen-direita') ? 620 : 200;

      if(altura > piso){
        el.style.height = altura + 'px';
        el.style.maxHeight = altura + 'px';
      } else {
        // limpa o que tinha sido calculado numa janela maior
        el.style.height = '';
        el.style.maxHeight = '';
      }
      if(el.__redesenharBarra) el.__redesenharBarra();
    });
  document.querySelectorAll('.cat-stage').forEach(e => { if(e.__redesenharBarra) e.__redesenharBarra(); });

  /* Segunda passada. A conta acima mede cada painel isoladamente, mas quem
     define a altura da página é a soma de tudo — e alguma margem ou sombra
     ainda sobrava, deixando aquela faixa fina para rolar no pé. Aqui olhamos
     o resultado final: se a página ainda rola, descontamos a sobra. */
  const sobra = document.documentElement.scrollHeight - janela;
  if(sobra > 2){
    document.querySelectorAll('.cat-column, .panel-body, .painel-cheio, .gen-meio, .gen-rail, .gen-direita')
      .forEach(el => {
        const altura = parseFloat(el.style.height);
        if(altura > 240){
          el.style.height = (altura - sobra) + 'px';
          el.style.maxHeight = el.style.height;
        }
        if(el.__redesenharBarra) el.__redesenharBarra();
      });
  }

  posicionarRoda();
}

window.addEventListener('resize', ajustarAlturaDosPaineis);

/* Versão deitada da barra padrão, para as réguas da busca global. As setas não
   davam conta: quem não tem trackpad só conseguia ir para um lado. */
function ligarBarraHorizontal(elemento, trilho){
  if(!elemento || !trilho) return;
  const bolinha = trilho.querySelector('.barra-bolinha');
  const sobra = () => elemento.scrollWidth - elemento.clientWidth;

  function desenhar(){
    const s = sobra();
    trilho.style.display = s > 8 ? '' : 'none';
    if(s <= 8) return;
    const curso = trilho.clientWidth - bolinha.offsetWidth;
    bolinha.style.left = (elemento.scrollLeft / s * curso) + 'px';
  }

  let puxando = false;
  const mover = e => {
    if(!puxando) return;
    const r = trilho.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left - bolinha.offsetWidth/2) / (r.width - bolinha.offsetWidth)));
    elemento.scrollLeft = pct * sobra();
  };
  bolinha.addEventListener('mousedown', e => { puxando = true; e.preventDefault(); });
  trilho.addEventListener('mousedown', e => { if(e.target === trilho){ puxando = true; mover(e); } });
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', () => { puxando = false; });

  elemento.addEventListener('scroll', desenhar, {passive:true});
  new ResizeObserver(desenhar).observe(elemento);
  // o observador nem sempre roda a tempo (e alguns navegadores o seguram
  // quando a janela não está na frente); recalcular ao chegar com o mouse
  // garante que a barra esteja certa na hora em que ela vai ser usada
  trilho.parentElement?.addEventListener('mouseenter', desenhar);
  setTimeout(desenhar, 0);
  setTimeout(desenhar, 250);
}

/* Da busca global direto para o card dentro da categoria: abre a categoria,
   rola até ele e pisca para o olho encontrar. */
function irAteOCard(projId, cardId){
  // sem isto o painel de resultados continuava por cima e parecia que o
  // clique não fazia nada
  clearGlobalSearch();
  openProject(projId);
  let tentativas = 0;
  const procurar = setInterval(() => {
    const alvo = document.getElementById('copy_' + cardId)?.closest('.prompt-card');
    if(alvo){
      clearInterval(procurar);
      alvo.scrollIntoView({block:'center', behavior:'smooth'});
      alvo.classList.add('card-achado');
      setTimeout(() => alvo.classList.remove('card-achado'), 2200);
    } else if(++tentativas > 80){
      clearInterval(procurar);   // categoria grande que ainda não montou: desiste calado
    }
  }, 60);
}

function ligarControlesDaRoda(){
  const rail = document.getElementById('wheelRail');
  const col  = document.getElementById('catColumn');
  if(!rail || !col || rail.dataset.ligado) return;
  rail.dataset.ligado = '1';

  let arrastando = false;
  const mover = e => {
    if(!arrastando) return;
    const r = rail.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientY - r.top)/r.height));
    const total = document.querySelectorAll('#projectsGrid .cat-card').length;
    alvoRoda = anguloRoda = pct*(total-1)*PASSO_RODA;
    posicionarRoda();
  };
  rail.addEventListener('mousedown', e=>{ arrastando=true; pararGiro(); mover(e); e.preventDefault(); });
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', ()=>{ if(arrastando){ arrastando=false; if(giroAutomatico) iniciarGiro(); }});

  col.addEventListener('wheel', e=>{
    if(modoCategorias!=='roda') return;
    e.preventDefault();
    pararGiro();
    girarRoda(e.deltaY>0 ? PASSO_RODA : -PASSO_RODA);
    if(giroAutomatico) setTimeout(iniciarGiro, 1200);
  }, {passive:false});
}

/* ══════════════════════════════════════════════════════════════
   DROPDOWN DE SUBCATEGORIAS
   Primeira opção cria uma nova; abaixo vêm as existentes.
   ══════════════════════════════════════════════════════════════ */
function renderSubcatDrop(){
  const menu = document.getElementById('subcatDropMenu');
  const label = document.getElementById('subcatDropLabel');
  if(!menu) return;
  const p = getProj(currentProjId);
  const subs = (p && p.subcats) || [];
  const total = ((p && p.cards) || []).length;

  menu.innerHTML = '';

  /* Os itens são criados no DOM em vez de virem como texto com onclick:
     nome de subcategoria com aspas ou apóstrofo quebrava o atributo e
     o filtro deixava de funcionar. */
  const item = (texto, contagem, ativo, aoClicar, extraClasse) => {
    const b = document.createElement('button');
    b.className = 'sd-item' + (ativo ? ' ativo' : '') + (extraClasse ? ' ' + extraClasse : '');
    b.textContent = texto;
    if(contagem !== null){
      const n = document.createElement('span');
      n.textContent = contagem;
      b.appendChild(n);
    }
    b.onclick = () => { aoClicar(); fecharSubcatDrop(); };
    menu.appendChild(b);
  };

  if(!bonusMode){
    item('+ ' + t('subcat_new'), null, false, openManageSubcats, 'sd-new');
  }
  item(t('all'), total, !activeSubcat, () => setSubcat(null));
  subs.forEach(sc => {
    const n = ((p.cards)||[]).filter(c => (c.subcats||[]).includes(sc)).length;
    item(sc, n, activeSubcat === sc, () => setSubcat(sc));
  });

  if(label) label.textContent = activeSubcat || t('subcats');
}

function toggleSubcatDrop(e){
  e && e.stopPropagation();
  document.getElementById('subcatDrop')?.classList.toggle('aberto');
}
function fecharSubcatDrop(){ document.getElementById('subcatDrop')?.classList.remove('aberto'); }
document.addEventListener('click', e=>{
  if(!e.target.closest('#subcatDrop')) fecharSubcatDrop();
});

/* ══════════════════════════════════════════════════════════════
   BOTÃO VOLTAR DO NAVEGADOR
   Antes, voltar saía do app e caía na página de vendas — dava a
   sensação de ter deslogado. Agora cada tela vira um passo no
   histórico e o voltar anda dentro do app.
   ══════════════════════════════════════════════════════════════ */
let ignorarHistorico = false;   // evita empilhar quando é o próprio popstate navegando

function registrarNoHistorico(tela, id){
  if(ignorarHistorico) return;
  const atual = history.state;
  if(atual && atual.tela === tela && String(atual.id||'') === String(id||'')) return;
  try{ history.pushState({promptart:true, tela, id: id||null}, '', location.pathname); }
  catch(e){ /* alguns contextos barram o histórico; a navegação segue normal */ }
}

/* Leva o app ao estado guardado, sem mexer no histórico de novo. */
function irParaEstado(estado){
  ignorarHistorico = true;
  try{
    switch(estado?.tela){
      case 'favorites':  openFavorites(); break;
      case 'community':  openCommunity(); break;
      case 'generator':  openGenerator(); break;
      case 'bonus':      openBonusLibrary(); break;
      case 'categoria':  goHome(); if(estado.id) openProject(estado.id); break;
      default:           goHome();
    }
  } finally {
    setTimeout(()=>{ ignorarHistorico = false; }, 0);
  }
}

window.addEventListener('popstate', e => {
  const estado = e.state;

  // Fora do app (a página de vendas, por exemplo): deixa o navegador seguir.
  if(!estado || !estado.promptart){
    // Sem estado nosso é porque o usuário chegou direto no /app: em vez de
    // sair para a landing, volta para a Home do app e refaz o passo.
    try{ history.pushState({promptart:true, tela:'home', id:null}, '', location.pathname); }catch(e){}
    irParaEstado({tela:'home'});
    return;
  }

  irParaEstado(estado);
});

// primeiro passo: a Home. Sem isto o voltar sairia do app já na primeira vez.
try{ history.replaceState({promptart:true, tela:'home', id:null}, '', location.pathname); }catch(e){}


// Primeira medida: as barras e a altura dos painéis assim que o app abre.
window.addEventListener('load', () => {
  ligarTodasAsBarras();
  ajustarAlturaDosPaineis();
  // segunda medida depois das fontes assentarem: a primeira pode pegar
  // a página ainda se acomodando e sobrar um pedaço no pé
  setTimeout(ajustarAlturaDosPaineis, 350);
});
