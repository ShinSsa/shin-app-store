/* ══ PromptArt pessoal (Umbrel) ══
   Carregado depois do app.js. O app.js é o mesmo do site; aqui só se
   desligam as partes que eram para outras pessoas (comunidade, bônus,
   avisos do ADM, dica do dia) e entra o backup em .zip. */

// avisos do ADM e dica do dia: não existem aqui
carregarAvisos = function(){};
showDailyTip = function(){};
// comunidade e biblioteca bônus: não existem aqui
openCommunity = function(){ goHome(); };
openBonusLibrary = function(){ goHome(); };
sharePromptToCommunity = function(_id, e){ e && e.stopPropagation(); };

// menu do avatar: sem plano e sem limite de espaço
(function(){
  const plano = document.getElementById('umPlan');
  if (plano) plano.textContent = 'Versão pessoal · no seu Umbrel';
})();

/* Importa um backup (.zip) do site ou do próprio Umbrel.
   Substitui tudo o que existe aqui — por isso pergunta antes. */
function importarBackupPessoal(e){
  const arquivo = e.target.files && e.target.files[0];
  if (!arquivo) return;
  if (!/\.zip$/i.test(arquivo.name)) { showToast('Escolha o arquivo .zip do backup.', true); return; }
  if (!confirm('Importar "' + arquivo.name + '"?\n\nIsto SUBSTITUI todas as categorias, prompts e fotos que estão aqui pelos do backup.')) return;

  const aviso = document.getElementById('loading');
  aviso.innerHTML = '<div class="spinner"></div><p id="backupProgresso">Enviando o backup… 0%</p>';
  aviso.style.display = '';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/backup/importar');
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken());
  xhr.upload.onprogress = function(ev){
    if (!ev.lengthComputable) return;
    const pct = Math.round(ev.loaded / ev.total * 100);
    const p = document.getElementById('backupProgresso');
    if (p) p.textContent = pct < 100 ? 'Enviando o backup… ' + pct + '%' : 'Guardando categorias, prompts e fotos…';
  };
  xhr.onload = function(){
    let r = {};
    try { r = JSON.parse(xhr.responseText); } catch (_) {}
    if (xhr.status >= 200 && xhr.status < 300 && r.categorias !== undefined) {
      alert('Backup importado: ' + r.categorias + ' categorias, ' + r.prompts + ' prompts e ' + r.fotos + ' arquivos de foto.');
      location.reload();
    } else {
      aviso.style.display = 'none';
      const msg = (r.errors && Object.values(r.errors).flat()[0]) || r.message || (xhr.status === 413 ? 'o arquivo é grande demais para o servidor.' : 'resposta inesperada (erro ' + xhr.status + ').');
      alert('Não consegui importar: ' + msg);
    }
  };
  xhr.onerror = function(){ aviso.style.display = 'none'; alert('A conexão com o Umbrel caiu durante o envio. Tente de novo.'); };
  const fd = new FormData();
  fd.append('arquivo', arquivo);
  xhr.send(fd);
}
