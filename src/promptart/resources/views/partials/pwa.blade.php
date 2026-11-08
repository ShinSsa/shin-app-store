{{-- ══ APP INSTALÁVEL (PWA) ══
     A ficha do app (manifest.json), as etiquetas que o iPhone lê ao
     "Adicionar à Tela de Início" e o registro do sw.js, que guarda só a
     casca (CSS/JS/ícones) e mostra a tela de sem conexão.
     Nada da conta fica guardado no aparelho: sem internet não há login. --}}
<link rel="manifest" href="{{ asset('manifest.json') }}?v={{ filemtime(public_path('manifest.json')) }}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PromptArt">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
</script>
