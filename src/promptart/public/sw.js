/* ══════════════════════════════════════════════════════════════════
   PROMPTART — service worker (o "guardião" do app instalado)

   O QUE ELE FAZ
   • Guarda a CASCA do app no aparelho — CSS, JS e ícones — para abrir
     rápido. Só arquivos que têm a versão no endereço (?v=data do arquivo):
     arquivo novo = endereço novo, então nunca serve versão velha.
   • Sem internet, mostra a tela de "sem conexão" (offline.html).

   O QUE ELE NÃO FAZ, DE PROPÓSITO
   • Não guarda páginas, dados da conta, prompts, fotos nem vídeo.
     As páginas do app carregam os dados da pessoa (nome, plano) dentro
     do HTML; guardá-las abriria o app sem passar pelo servidor. Assim, sem
     internet, nada da conta aparece: login e assinatura continuam sendo
     conferidos pelo servidor a cada acesso.
   • Não toca em /api, /media, POST, vídeo nem em outros sites (Analytics):
     esses pedidos passam direto, como se ele não existisse.

   Para obrigar todos os aparelhos a jogarem fora a casca guardada,
   basta mudar VERSAO.
   ══════════════════════════════════════════════════════════════════ */
const VERSAO = 'promptart-casca-v1';
const OFFLINE = '/offline.html';
const GUARDAR_NA_INSTALACAO = [OFFLINE, '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSAO)
      .then(c => c.addAll(GUARDAR_NA_INSTALACAO))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// casca = estático com versão no endereço, ou os ícones do app
function ehCasca(url) {
  if (url.pathname.startsWith('/icons/')) return true;
  return /^\/(css|js)\//.test(url.pathname) && url.searchParams.has('v');
}

// guarda a versão nova e joga fora as anteriores do mesmo arquivo — sem isso
// cada atualização do app.js deixaria uma cópia velha esquecida no celular
async function guardar(pedido, resposta) {
  const cache = await caches.open(VERSAO);
  const caminho = new URL(pedido.url).pathname;
  for (const antigo of await cache.keys()) {
    if (new URL(antigo.url).pathname === caminho && antigo.url !== pedido.url) await cache.delete(antigo);
  }
  await cache.put(pedido, resposta);
}

self.addEventListener('fetch', e => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // páginas: sempre do servidor; sem internet, a tela de "sem conexão"
  if (pedido.mode === 'navigate') {
    e.respondWith(fetch(pedido).catch(() => caches.match(OFFLINE)));
    return;
  }

  // casca: do aparelho se já tiver; senão busca, guarda e entrega
  if (ehCasca(url)) {
    e.respondWith(
      caches.match(pedido).then(guardado => guardado || fetch(pedido).then(resposta => {
        if (resposta.ok) guardar(pedido, resposta.clone());
        return resposta;
      }))
    );
  }
  // todo o resto passa direto, sem o service worker
});
