/* ══════════════════════════════════════════════════════════════════
   O DEGRAU DO PAINEL — só no celular

   O topo do painel dos cards não é um retângulo arredondado: a aba do
   título termina num ombro côncavo que desce e abre o rebaixo onde ficam
   os botões redondos. Isso não se faz com border-radius. Este script
   desenha a forma num <svg class="degrau-svg"> que é o primeiro filho de
   cada .panel-notch.

   A curva é a da camada "fundo-prompts" do Home.svg (ver
   docs/ID NOVA PROMPTART/MOBILE), em escala 0,5. Só os trechos retos
   esticam com a largura; o ombro e os cantos mantêm a forma.

   No computador o .degrau-svg fica escondido pelo app.css e nada daqui
   roda (a primeira linha de desenharDegraus sai cedo).
   ══════════════════════════════════════════════════════════════════ */
(function () {
  const CELULAR = matchMedia('(max-width:700px)');

  // W = largura do painel; x0 = onde o ombro começa (depende de quantos
  // botões existem no rebaixo)
  function degrauPath(W, x0) {
    const s = .5, h = 79.69 * s, r = 42 * s, c = 23.18 * s, T = h + r;
    const f = n => +n.toFixed(2), X = v => f(x0 + v * s);
    return `M0,${f(T)} L0,${f(r)} C0,${f(r - c)} ${f(r - c)},0 ${f(r)},0 L${f(x0)},0 ` +
      `C${X(15.53)},0 ${X(29.82)},${f(8.5 * s)} ${X(37.23)},${f(22.15 * s)} ` +
      `C${X(43.22)},${f(33.19 * s)} ${X(50.45)},${f(46.5 * s)} ${X(56.44)},${f(57.54 * s)} ` +
      `C${X(63.86)},${f(71.19 * s)} ${X(78.14)},${f(h)} ${X(93.68)},${f(h)} ` +
      `L${f(W - r)},${f(h)} C${f(W - r + c)},${f(h)} ${f(W)},${f(h + r - c)} ${f(W)},${f(T)} Z`;
  }

  function desenharDegraus() {
    if (!CELULAR.matches) return;
    document.querySelectorAll('.panel-notch').forEach(n => {
      const svg = n.querySelector('.degrau-svg');
      if (!svg || !n.offsetWidth) return;          // aba escondida: desenha quando aparecer
      const W = n.offsetWidth;
      // só os botões que estão de fato na tela (no Bônus alguns somem)
      const btns = [...n.querySelectorAll('.notch-tools > *')]
        .filter(b => b.offsetParent !== null).length;
      const x0 = Math.max(60, W - 4 - btns * 42 - (btns - 1) * 8 - 6 - 46.84);
      const d = degrauPath(W, x0);

      // só escreve quando mudou: cada escrita dispararia o observador de novo
      if (svg.getAttribute('width') != W) {
        svg.setAttribute('width', W);
        svg.setAttribute('height', 61);
      }
      const path = svg.querySelector('path');
      if (path.getAttribute('d') !== d) path.setAttribute('d', d);
      const aba = (x0 - 10) + 'px';
      if (n.style.getPropertyValue('--aba-max') !== aba) n.style.setProperty('--aba-max', aba);
    });
  }

  // um desenho por quadro, no máximo, por mais eventos que cheguem juntos.
  // O setTimeout é o plano B: com a aba em segundo plano (voltar de outro
  // app, por exemplo) o navegador pausa o requestAnimationFrame, e o painel
  // ficaria sem a forma até a pessoa mexer em alguma coisa.
  let pendente = false;
  function agendar() {
    if (pendente) return;
    pendente = true;
    const fazer = () => { if (!pendente) return; pendente = false; desenharDegraus(); };
    requestAnimationFrame(fazer);
    setTimeout(fazer, 80);
  }

  new ResizeObserver(agendar).observe(document.body);
  CELULAR.addEventListener('change', agendar);

  // Trocar de aba, entrar no Bônus ou abrir a busca muda classes e estilos
  // pela página. As mudanças que o próprio degrau faz (no .panel-notch e
  // no svg) são ignoradas — sem isso o script reagiria a si mesmo em ciclo.
  new MutationObserver(lista => {
    if (lista.some(m => !m.target.closest?.('.panel-notch'))
        || lista.some(m => m.target.classList?.contains('panel-notch') && m.attributeName === 'class')) {
      agendar();
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  agendar();
})();
