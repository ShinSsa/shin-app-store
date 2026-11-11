<!DOCTYPE html>
<html lang="{{ config('promptart.locales')[app()->getLocale()]['html'] }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="csrf-token" content="{{ csrf_token() }}">
<link rel="icon" type="image/svg+xml" href="{{ asset('favicon.svg') }}?v={{ filemtime(public_path('favicon.svg')) }}">
<link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}?v={{ filemtime(public_path('apple-touch-icon.png')) }}">
<meta name="theme-color" content="#007aff">
@include('partials.pwa')
<title>PromptArt</title>
<link rel="stylesheet" href="{{ asset('css/app.css') }}?v={{ filemtime(public_path('css/app.css')) }}">
<link rel="stylesheet" href="{{ asset('css/mobile.css') }}?v={{ filemtime(public_path('css/mobile.css')) }}">
<link rel="stylesheet" href="{{ asset('css/pessoal.css') }}?v={{ filemtime(public_path('css/pessoal.css')) }}">
</head>
<body class="pessoal">
<!-- LOADING -->
<div id="loading"><div class="spinner"></div><p>{{ __('app.loading') }}</p></div>

<!-- HEADER -->
<header>
  <div class="logo" onclick="goHome()">
    <svg class="logo-icon" viewBox="0 0 2479 1080" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
@include('partials.logo-paths')
</svg>
  </div>
  <div class="header-center" id="headerSearchWrap" style="display:none;">
    <svg class="search-ico" width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    <input class="header-search" id="globalSearch" type="text" placeholder="{{ __('app.search_all') }}" oninput="onGlobalSearch();toggleClear('globalSearch','globalSearchClear')" autocomplete="off">
    <button class="search-clear" id="globalSearchClear" onclick="clearSearch('globalSearch','onGlobalSearch','globalSearchClear')"><svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  </div>
  <div class="header-actions">
    <input type="file" id="backupInput" accept=".zip,application/zip" style="display:none" onchange="importarBackupPessoal(event)">

    <button class="round-btn help-btn" id="shortcutBtn" onclick="toggleShortcutModal()" title="{{ __('app.help_title') }}">?</button>

    <div class="user-menu-wrap">
      <button class="avatar-btn" id="userMenuBtn" onclick="toggleUserMenu()" title="Minha conta — {{ auth()->user()->name }}">
        @include('partials.avatar', ['user' => auth()->user(), 'size' => 40])
      </button>
      <div class="user-menu" id="userMenu">
        <div class="user-menu-head">
          <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.5rem;">
            @include('partials.avatar', ['user' => auth()->user(), 'size' => 46])
            <div style="min-width:0;">
              <div class="user-menu-name" id="umName"></div>
              <div class="user-menu-email" id="umEmail"></div>
            </div>
          </div>
          <div class="user-menu-plan" id="umPlan"></div>
        </div>
        <div class="user-menu-storage">
          <div class="user-menu-storage-label"><span>{{ __('app.storage') }}</span><span id="umStorageTxt"></span></div>
          <div class="user-menu-storage-bar"><div id="umStorageFill"></div></div>
        </div>
        <button type="button" class="user-menu-item" onclick="location.href='/backup/exportar'">⬇️ Baixar backup (.zip)</button>
        <button type="button" class="user-menu-item" onclick="document.getElementById('backupInput').value='';document.getElementById('backupInput').click()">⬆️ Importar backup (.zip)</button>
        <div class="user-menu-foot">
          <span style="flex:1;font-size:.72rem;color:var(--muted);">PromptArt pessoal</span>
          <button class="round-btn theme-btn" onclick="toggleTheme()" id="themeBtn" title="{{ __('app.theme_title') }}">
            <svg id="themeIcon" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</header>

<!-- CABEÇALHO DE PÁGINA: título + navegação + contadores (um só para todas as telas) -->
<div class="page-head">
  <div class="page-head-left">
    <h1 class="page-title" id="pageTitle"></h1>
    <nav class="nav-pills">
      <button class="npill" id="navHome" onclick="goHome()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 10.5 12 3l9 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 9.5V20h13V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ __('app.nav_home') }}
      </button>
      <button class="npill" id="navFavorites" onclick="openFavorites()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        {{ __('app.favorites') }}
      </button>
      <button class="npill npill-gen" id="navGenerator" onclick="openGenerator()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M18.5 15l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        {{ __('app.generator') }}
      </button>
    </nav>
  </div>


  <div class="page-counters">
    <div class="counter">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <div><strong id="cntCategories">0</strong><span>{{ __('app.categories') }}</span></div>
    </div>
    <div class="counter">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7 10l2.5 2L7 14M12.5 14H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><strong id="cntPrompts">0</strong><span>{{ __('app.prompts_label') }}</span></div>
    </div>
  </div>
</div>

<!-- HOME: coluna de categorias + categoria aberta -->
<div id="homePage" class="page active">
  <main class="home-layout">

    <!-- COLUNA DAS CATEGORIAS -->
    <aside class="cat-column" id="catColumn">
      <div class="cat-toolbar">
        <button class="tbtn" id="viewWheelBtn" onclick="setModoCategorias('roda')" title="{{ __('app.view_wheel') }}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="3" width="6" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M11 5.5h6M11 10h6M11 14.5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
        <button class="tbtn" id="viewListBtn" onclick="setModoCategorias('lista')" title="{{ __('app.view_list') }}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
        <label class="auto-switch" title="{{ __('app.auto_spin_title') }}">
          <input type="checkbox" id="autoSpin" onchange="setGiroAutomatico(this.checked)">
          <span class="auto-track"></span>
          <em>{{ __('app.auto') }}</em>
        </label>
        <div style="flex:1;"></div>
        <button class="tbtn" id="sortProjBtn" onclick="toggleSortProj()" title="{{ __('app.sort_title') }}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 3v14M6 3L3.5 5.5M6 3l2.5 2.5M14 17V3M14 17l-2.5-2.5M14 17l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <button class="hbtn hbtn-primary cat-new" id="btnNovaCategoria" onclick="openNewProject()">{{ __('app.new_category') }}</button>

      <div class="cat-stage" id="catStage">
        <div class="cat-wheel" id="projectsGrid"></div>
      </div>
      <div class="wheel-rail" id="wheelRail" title="{{ __('app.wheel_hint') }}">
        <div class="wheel-thumb" id="wheelThumb"></div>
      </div>
    </aside>

    <!-- CATEGORIA ABERTA -->
    <section class="cat-panel" id="catPanel">
      <div id="catPanelEmpty" class="cat-panel-empty" style="display:none;">
        <p>{{ __('app.pick_category') }}</p>
      </div>
      <div id="catPanelContent">
    {{-- Degrau: o nome da categoria fica acima, e o rebaixo à direita
         acomoda o botão, a busca, as subcategorias e a ordenação. --}}
    <div class="panel-notch">
      {{-- celular: a forma do degrau, desenhada pelo degrau.js --}}
      <svg class="degrau-svg" aria-hidden="true"><path/></svg>
      <div class="notch-title">
        <div class="proj-page-title" id="projPageTitle"></div>
        <div class="proj-page-desc" id="projPageDesc"></div>
      </div>
      <div class="notch-tools" id="projActionsBar">
        <button class="hbtn hbtn-primary notch-new" onclick="openNewCard()">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          {{ __('app.new_card_short') }}
        </button>

        <div class="search-wrap notch-search">
            {{-- celular: a busca fica recolhida num círculo; a lupa abre, o X fecha e limpa --}}
            <button type="button" class="notch-search-toggle" onclick="abrirBuscaPainel(this)" aria-label="{{ __('app.search') }}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            <button type="button" class="notch-search-fechar" onclick="fecharBuscaPainel(this)" aria-label="{{ __('app.close') }}"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
          <svg class="sw-ico" width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input type="text" id="cardSearch" placeholder="{{ __('app.search_in_category') }}" oninput="filterCards();toggleClear('cardSearch','cardSearchClear')">
          <button class="search-clear" id="cardSearchClear" onclick="clearSearch('cardSearch','filterCards','cardSearchClear')"><svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        </div>

        {{-- Criar nova subcategoria é a primeira opção de dentro do próprio menu --}}
        <div class="subcat-drop" id="subcatDrop">
          <button class="subcat-drop-btn" onclick="toggleSubcatDrop(event)">
            <svg class="ico-subcat" width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 8l4-4 4 4M6 12l4 4 4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span id="subcatDropLabel">{{ __('app.subcats') }}</span>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="subcat-drop-menu" id="subcatDropMenu"></div>
        </div>

        <button class="tbtn tbtn-solid" id="sortCardBtn" onclick="toggleSortCard()" title="{{ __('app.sort_title') }}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 3v14M6 3L3.5 5.5M6 3l2.5 2.5M14 17V3M14 17l-2.5-2.5M14 17l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    {{-- pills antigas: o dropdown assumiu o filtro, mas o JS ainda as alimenta --}}
    <div class="subcat-bar" id="subcatBar" style="display:none;"></div>

    {{-- corpo do painel: encaixa sob a aba do título e rola quando há muitos cards --}}
    <div class="panel-body">
      <div class="cards-grid" id="cardsGrid"></div>
    </div>
  </div>
    </section>

    <!-- resultados da busca global ocupam o painel inteiro -->
    <div id="globalResultsSection">
      <div class="gr-label" id="grLabel"></div>
      <div class="gr-grid" id="grGrid"></div>
    </div>

    {{-- botões antigos que o JS ainda consulta; a navegação virou pílula --}}
    <button class="hbtn" id="bonusBtn" onclick="openBonusLibrary()" style="display:none;"></button>
    <button class="hbtn" id="generatorBtn" onclick="openGenerator()" style="display:none;"></button>
    <button id="bonusBackBtn" onclick="goHome()" style="display:none;"></button>
    <span id="projCount" style="display:none;">0</span>
  </main>
</div>

<!-- GENERATOR PAGE -->
<div id="generatorPage" class="page">
  <main class="gen-layout-3">
    <aside class="gen-rail">
      <button class="gen-mode" id="tabImg" onclick="setGenMode('image')"><span>🖼</span>{{ __('app.mode_image') }}</button>
      <button class="gen-mode" id="tabTxt" onclick="setGenMode('text')"><span>📝</span>{{ __('app.mode_text') }}</button>
      <button class="gen-mode" id="tabEmo" onclick="setGenMode('emoji')"><span>😀</span>{{ __('app.mode_emoji') }}</button>
      <button class="gen-mode" id="tabVid" onclick="setGenMode('video')"><span>🎬</span>{{ __('app.mode_video') }}</button>
      <button class="gen-mode" id="tabLogo" onclick="setGenMode('logo')"><span>🏷️</span>{{ __('app.mode_logo') }}</button>
      <button class="gen-mode" id="tabChar" onclick="setGenMode('char')"><span>🎭</span>{{ __('app.mode_char') }}</button>
      <button class="gen-mode" id="tabCon" onclick="setGenMode('con')"><span>🏗️</span>{{ __('app.mode_con') }}</button>
      <button class="gen-mode" id="tabRet" onclick="setGenMode('retouch')"><span>✨</span>{{ __('app.mode_retouch') }}</button>
      <button class="gen-mode" id="tabPoster" onclick="setGenMode('poster')"><span>🎨</span>{{ __('app.mode_poster') }}</button>
      <div style="flex:1;"></div>
      <button class="hbtn hbtn-primary gen-clear" onclick="resetGen()" title="{{ __('app.gen_reset_title') }}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 1 1 1.8 4.3M2 8V4M2 8h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ __('app.gen_clear') }}
      </button>
    </aside>

    <section class="gen-meio">
      <div id="genControls"></div>
      <button class="scroll-top" onclick="document.querySelector('.gen-meio').scrollTo({top:0,behavior:'smooth'})" title="{{ __('app.back_to_top') }}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </section>

    <aside class="gen-direita">
      {{-- Dois quadrados, como o Ramon pediu: o prompt em cima, as camadas
           extras embaixo. Sem rebaixo aqui — ele so vale nas telas de cards. --}}
      <div class="gen-bloco">
        <div class="gen-bloco-topo">
          <div class="gen-bloco-tit">{{ __('app.gen_output') }}</div>
          <div class="gen-lang-toggle">
            <button class="gen-lang-btn active" data-lang="en" onclick="setGenLang('en')">EN</button>
            <button class="gen-lang-btn" data-lang="pt" onclick="setGenLang('pt')">PT</button>
          </div>
        </div>
        <div class="gen-output" id="genOutput"></div>
        <div class="gen-actions">
          <button class="hbtn hbtn-primary" id="genCopyBtn" onclick="copyGenerated()">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 13V4a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            {{ __('app.copy_btn') }}
          </button>
          <button class="hbtn" onclick="openSaveGenerated()">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4"/><path d="M5 3v3h5V3M5 13v-4h6v4" stroke="currentColor" stroke-width="1.4"/></svg>
            {{ __('app.gen_save_as_card') }}
          </button>
        </div>
      </div>

      <div class="gen-bloco gen-bloco-camadas">
        <div class="gen-bloco-topo">
          <div class="gen-bloco-tit">{{ __('app.gen_layers') }}</div>
        </div>
        <div class="gen-tips" id="genTips"></div>
      </div>

    </aside>
  </main>
</div>

<!-- FAVORITOS: painel inteiriço, busca e ordenação dentro -->
<div id="favoritesPage" class="page">
  <main class="tela-simples">
    <div class="painel-cheio">
      <div class="painel-tools">
        <div class="painel-desc" id="favPageDesc"></div>
        <div style="flex:1;"></div>
        <div class="search-wrap notch-search">
            {{-- celular: a busca fica recolhida num círculo; a lupa abre, o X fecha e limpa --}}
            <button type="button" class="notch-search-toggle" onclick="abrirBuscaPainel(this)" aria-label="{{ __('app.search') }}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            <button type="button" class="notch-search-fechar" onclick="fecharBuscaPainel(this)" aria-label="{{ __('app.close') }}"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
          <svg class="sw-ico" width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input type="text" id="favSearch" placeholder="{{ __('app.search_favorites') }}" oninput="renderFavoritesPage();toggleClear('favSearch','favSearchClear')">
          <button class="search-clear" id="favSearchClear" onclick="clearSearch('favSearch','renderFavoritesPage','favSearchClear')"><svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        </div>
        <button class="tbtn tbtn-solid" onclick="toggleSortFav()" id="sortFavBtn" title="{{ __('app.sort_title') }}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 3v14M6 3L3.5 5.5M6 3l2.5 2.5M14 17V3M14 17l-2.5-2.5M14 17l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="painel-cheio-corpo">
        <div class="cards-grid" id="favoritesGrid"></div>
      </div>
    </div>
  </main>
</div>

<!-- COMUNIDADE: ranking à esquerda, compartilhados à direita -->
<div id="communityPage" class="page">
  <main class="home-layout">

    <aside class="rank-column">
      <div class="rank-head">
        <h2>🏆 {{ __('app.ranking') }}</h2>
        <p>{{ __('app.ranking_sub') }}</p>
      </div>
      <div id="rankingBox" class="rank-list"></div>
    </aside>

    <section class="cat-panel">
      <div class="panel-notch">
      {{-- celular: a forma do degrau, desenhada pelo degrau.js --}}
      <svg class="degrau-svg" aria-hidden="true"><path/></svg>
        <div class="notch-title">
          <div class="proj-page-title">{{ __('app.shared') }}</div>
          <div class="proj-page-desc" id="communityDesc">{{ __('app.community_sub') }}</div>
        </div>
        <div class="notch-tools">
          <div class="search-wrap notch-search">
            {{-- celular: a busca fica recolhida num círculo; a lupa abre, o X fecha e limpa --}}
            <button type="button" class="notch-search-toggle" onclick="abrirBuscaPainel(this)" aria-label="{{ __('app.search') }}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            <button type="button" class="notch-search-fechar" onclick="fecharBuscaPainel(this)" aria-label="{{ __('app.close') }}"><svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
            <svg class="sw-ico" width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <input type="text" id="communitySearch" placeholder="{{ __('app.search_community') }}" oninput="loadCommunity()">
          </div>
          {{-- No computador este invólucro é display:contents — não existe para o
               layout e as pílulas continuam soltas na linha. No celular vira um
               botão de filtro que abre as mesmas pílulas num cartão. Os ids ficam
               nos mesmos botões. --}}
          <div class="comm-filtro">
          <button type="button" class="comm-filtro-btn" onclick="alternarFiltroComunidade(event)" aria-label="{{ __('app.filters') }}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button>
          <div class="comm-filtro-menu">
          <button class="fpill" id="commSortTop" onclick="setCommunitySort('top')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
            {{ __('app.most_liked') }}
          </button>
          <button class="fpill" id="commFavs" onclick="setCommunityOnly('favorites')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            {{ __('app.my_favorites') }}
          </button>
          <button class="fpill active" id="commAll" onclick="setCommunityOnly('all')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            {{ __('app.all') }}
          </button>
          </div>
          </div>
          <button class="tbtn tbtn-solid" id="commSortRecent" onclick="toggleCommunitySort()" title="{{ __('app.sort_title') }}">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 3v14M6 3L3.5 5.5M6 3l2.5 2.5M14 17V3M14 17l-2.5-2.5M14 17l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="panel-body">
        <div class="cards-grid" id="communityGrid"></div>
      </div>
    </section>
  </main>
</div>

<!-- MODAL: DICA DO DIA -->
<div class="overlay" id="tipModal">
  <div class="modal" style="max-width:420px;">
    <button class="modal-close" onclick="closeModal('tipModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <div style="font-size:2rem;text-align:center;margin-bottom:.4rem;">💡</div>
    <h2 style="text-align:center;" id="tipTitle"></h2>
    <p id="tipBody" style="font-size:.85rem;line-height:1.7;color:var(--text);text-align:center;"></p>
    <div class="modal-footer" style="justify-content:center;">
      <button class="hbtn hbtn-primary" onclick="closeModal('tipModal')">{{ __('app.got_it') }}</button>
    </div>
  </div>
</div>

<!-- MODAL: SALVAR PROMPT GERADO -->
<div class="overlay" id="genSaveModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('genSaveModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <h2>{{ __('app.gen_save_as_card') }}</h2>
    <div class="form-group"><label>{{ __('app.title') }}</label><input type="text" id="genSaveTitle" placeholder="{{ __('app.ph_prompt_name') }}"></div>
    <div class="form-group">
      <label>{{ __('app.target_category') }}</label>
      <select id="genSaveProject" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.82rem;padding:.55rem .8rem;"></select>
    </div>
    <div class="form-group"><label>{{ __('app.tag_opt') }}</label><input type="text" id="genSaveTag" placeholder="{{ __('app.ph_subcat_example') }}"></div>
    <div class="modal-footer">
      <button class="hbtn" onclick="closeModal('genSaveModal')">{{ __('app.cancel') }}</button>
      <button class="hbtn hbtn-primary" onclick="saveGeneratedCard()">{{ __('app.save_card') }}</button>
    </div>
  </div>
</div>

<!-- MODAL: PROJETO -->
<div class="overlay" id="projModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('projModal')" aria-label="{{ __('app.close') }}">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <h2 id="projModalTitle">{{ __('app.cat_new') }}</h2>
    <div class="form-group"><label>{{ __('app.name') }}</label><input type="text" id="projName" placeholder="{{ __('app.ph_cat_example') }}"></div>
    <div class="form-group"><label>{{ __('app.description') }}</label><input type="text" id="projDesc" placeholder="{{ __('app.ph_short_desc') }}"></div>
    {{-- A capa da categoria virou COR: uma foto a menos para anexar, e a cor
         organiza melhor a coluna lateral. --}}
    <div class="form-group">
      <label>{{ __('app.color') }}</label>
      {{-- Paleta própria: o seletor do sistema operacional destoava do resto --}}
      <div class="color-row">
        <input type="text" id="projColorHex" maxlength="7" placeholder="#D2DAE0"
               oninput="onColorHexInput()" autocomplete="off" spellcheck="false">
        <button type="button" class="color-dot" id="projColorDot" onclick="togglePaleta(event)"
                title="{{ __('app.pick_color') }}"></button>
      </div>
      <div class="paleta" id="projPaleta"></div>
      <div class="form-hint">{{ __('app.color_hint') }}</div>
    </div>

    <div class="modal-footer">
      {{-- excluir mora aqui dentro: some da grade e aparece só ao editar --}}
      <button class="hbtn modal-danger" id="projDeleteBtn" onclick="deleteProjectFromModal()" style="display:none;">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M8 6V4h4v2M5 6l1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ __('app.delete_category') }}
      </button>
      <div style="flex:1;"></div>
      <button class="hbtn" onclick="closeModal('projModal')">{{ __('app.cancel') }}</button>
      <button class="hbtn hbtn-primary" onclick="saveProjeto()">{{ __('app.save') }}</button>
    </div>
  </div>
</div>

<!-- MODAL: CARD -->
<div class="overlay" id="cardModal">
  <div class="modal modal-card-edit">
    <button class="modal-close" onclick="closeModal('cardModal')" aria-label="{{ __('app.close') }}">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <div class="card-edit-layout">
      <!-- COLUNA ESQUERDA: thumbnail -->
      <div class="card-edit-img-col">
        <!-- tabs foto 1 / foto 2 -->
        <div style="display:flex;gap:.3rem;margin-bottom:.4rem;">
          <button class="card-img-tab active" id="thumbTab1" onclick="switchThumbTab(1)">{{ __('app.photo1') }}</button>
          <button class="card-img-tab" id="thumbTab2" onclick="switchThumbTab(2)">{{ __('app.photo2') }}</button>
        </div>
        <!-- foto 1 -->
        <div id="thumbPanel1">
          <div class="form-label-sm">{{ __('app.photo1') }}</div>
          <div class="upload-row">
            <button type="button" class="hbtn" style="flex:1;justify-content:center;" onclick="document.getElementById('cardThumbFile').click()">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 11V3M4.5 6L8 2.5 11.5 6M2 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Enviar
            </button>
            <button type="button" class="hbtn upload-remove" id="cardThumbRemove" onclick="clearUploadField('cardThumb','cardThumbPrev')" style="display:none;" title="{{ __('app.remove') }}"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          </div>
          <input type="file" id="cardThumbFile" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" style="display:none" onchange="onUploadPicked(event,'cardThumb','cardThumbPrev')">
          <div class="upload-prog" id="cardThumbProg"><div class="upload-prog-fill"></div></div>
          <div class="form-hint" style="margin-top:.25rem;">{{ __('app.max_size') }}</div>
          <button type="button" class="url-toggle" onclick="toggleUrlField('cardThumb')">{{ __('app.use_url') }}</button>
          <input type="text" id="cardThumb" class="url-field" placeholder="{{ __('app.external_url') }}" oninput="onThumbInput('cardThumb','cardThumbPrev')" autocomplete="off" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.72rem;padding:.4rem .6rem;outline:none;margin:.35rem 0 .4rem;">
        </div>
        <!-- foto 2 -->
        <div id="thumbPanel2" style="display:none;">
          <div class="form-label-sm">{{ __('app.photo2') }}</div>
          <div class="upload-row">
            <button type="button" class="hbtn" style="flex:1;justify-content:center;" onclick="document.getElementById('cardThumb2File').click()">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 11V3M4.5 6L8 2.5 11.5 6M2 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Enviar
            </button>
            <button type="button" class="hbtn upload-remove" id="cardThumb2Remove" onclick="clearUploadField('cardThumb2','cardThumbPrev')" style="display:none;" title="{{ __('app.remove') }}"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          </div>
          <input type="file" id="cardThumb2File" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" style="display:none" onchange="onUploadPicked(event,'cardThumb2','cardThumbPrev')">
          <div class="upload-prog" id="cardThumb2Prog"><div class="upload-prog-fill"></div></div>
          <div class="form-hint" style="margin-top:.25rem;">{{ __('app.max_size') }}</div>
          <button type="button" class="url-toggle" onclick="toggleUrlField('cardThumb2')">{{ __('app.use_url') }}</button>
          <input type="text" id="cardThumb2" class="url-field" placeholder="{{ __('app.external_url') }}" oninput="onThumbInput('cardThumb2','cardThumbPrev')" autocomplete="off" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.72rem;padding:.4rem .6rem;outline:none;margin:.35rem 0 .4rem;">
        </div>
        <div class="card-edit-thumb-wrap">
          <div class="card-edit-thumb-frame">
            <div class="thumb-prev card-edit-thumb-prev" id="cardThumbPrev"><span>{{ __('app.preview') }}</span></div>
          </div>
          <div class="card-edit-pos-btns" id="cardPosbtns" style="display:none;">
            <button class="card-pos-btn" onclick="shiftThumbPos('left')" title="{{ __('app.align_left') }}">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M15 10H5M10 5l-5 5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="card-pos-btn" onclick="shiftThumbPos('center')" title="{{ __('app.align_center') }}">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button class="card-pos-btn" onclick="shiftThumbPos('right')" title="{{ __('app.align_right') }}">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
      <!-- COLUNA DIREITA: campos -->
      <div class="card-edit-fields-col">
        <h2 id="cardModalTitle" style="margin:0 0 1rem;font-size:1.05rem;">{{ __('app.card_new') }}</h2>
        <div class="form-group"><label>{{ __('app.title') }}</label><input type="text" id="cardTitle" placeholder="{{ __('app.ph_prompt_name') }}"></div>
        <div class="form-group"><label>{{ __('app.tag') }}</label><input type="text" id="cardTag" placeholder="{{ __('app.ph_tag_example') }}"></div>
        <div class="form-group" id="cardSubcatGroup" style="display:none;">
          <label>{{ __('app.subcats') }}</label>
          <div id="cardSubcatPills" style="display:flex;flex-wrap:wrap;gap:.4rem;"></div>
        </div>
        <div class="form-group">
          <label>{{ __('app.prompt_text') }}</label>
          <div class="rich-editor" id="cardText" contenteditable="true" data-placeholder="{{ __('app.ph_paste_prompt') }}" onmouseup="fmtCheck()" onkeyup="fmtCheck()" onpaste="onEditorPaste(event)"></div>
        </div>
        <div class="form-group">
          <label>{{ __('app.desc_tip') }}</label>
          <div class="rich-editor" id="cardDesc" contenteditable="true" data-placeholder="{{ __('app.ph_cat_desc') }}" onmouseup="fmtCheckDesc()" onkeyup="fmtCheckDesc()" onpaste="onEditorPaste(event)" style="min-height:70px;max-height:200px;font-family:inherit;resize:vertical;overflow-y:auto;"></div>
        </div>
        <div class="form-group">
          <label>{{ __('app.download_image') }}</label>
          <input type="hidden" id="cardAttachment">
          <input type="hidden" id="cardAttachmentName">
          <div class="upload-row">
            <button type="button" class="hbtn" onclick="document.getElementById('cardAttFile').click()">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 11V3M4.5 6L8 2.5 11.5 6M2 13h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Enviar anexo
            </button>
          </div>
          <input type="file" id="cardAttFile" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" style="display:none" onchange="onAttachPicked(event)">
          <div class="upload-prog" id="cardAttProg"><div class="upload-prog-fill"></div></div>
          <div class="form-hint">{{ __('app.download_hint') }} <strong>2 MB</strong>.</div>
          <div id="cardAttPrev" style="margin-top:.5rem;display:none;align-items:center;gap:.5rem;">
            <img id="cardAttImg" style="height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--border);" alt="" data-baixavel>
            <span id="cardAttName" style="font-size:.68rem;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <button type="button" onclick="clearCardAtt()" style="background:none;border:none;color:var(--danger);font-size:.7rem;cursor:pointer;">{{ __('app.remove') }}</button>
          </div>
        </div>
        <div class="modal-footer" style="margin-top:auto;padding-top:.75rem;border-top:1px solid var(--border);">
          <button class="hbtn" onclick="closeModal('cardModal')">{{ __('app.cancel') }}</button>
          <button class="hbtn hbtn-primary" onclick="saveCard()">{{ __('app.save_card') }}</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL: VIEW -->
<div class="overlay" id="viewModal" onclick="if(event.target===this)closeModal('viewModal')">
  <div class="modal modal-view">
    <div class="view-layout">
      <!-- COLUNA ESQUERDA: imagem -->
      <div class="view-img-col" id="viewImgCol">
        <div class="view-img-wrap" id="viewImgWrap"></div>
      </div>
      <!-- COLUNA DIREITA: conteúdo -->
      <div class="view-content-col">
        <button class="modal-close" onclick="closeModal('viewModal')" style="position:absolute;top:.75rem;right:.75rem;">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <!-- cabeçalho fixo -->
        <div class="view-header-fixed">
          <div class="view-tag" id="viewTag"></div>
          <div class="view-title" id="viewTitle"></div>
        </div>
        <!-- área com scroll: só descrição + prompt -->
        <div class="view-content-scroll">
          <div class="view-desc" id="viewDesc"></div>
          <div class="view-full" id="viewText"></div>
        </div>
        <!-- anexo fixo -->
        <div class="view-atts" id="viewAtts"></div>
        <!-- footer fixo sempre visível -->
        <div class="view-footer">
          <button class="hbtn" id="viewEditBtn" onclick="editFromView()">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M14.5 2.5a2.12 2.12 0 0 1 3 3L6 17l-4 1 1-4L14.5 2.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Editar
          </button>
          <button class="hbtn hbtn-primary" id="viewCopyBtn" onclick="copyFromView()">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 13V4a2 2 0 0 1 2-2h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            Copiar Prompt
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- FORMAT POPOVER (PROMPT) -->
<div class="fmt-pop" id="fmtPop">
  <button class="fmt-btn" onclick="fmtApply('bold','','cardText')" title="{{ __('app.bold') }}"><b>B</b></button>
  <button class="fmt-btn" onclick="fmtApply('upper','','cardText')" style="font-size:.6rem;letter-spacing:.04em;" title="{{ __('app.uppercase') }}">AA</button>
  <button class="fmt-btn" onclick="fmtApply('highlight','','cardText')" title="{{ __('app.highlight') }}" style="background:#f5c400;color:#000;font-size:.7rem;font-weight:800;padding:0 .35rem;">H</button>
  <div class="fmt-div"></div>
  <div class="fmt-dot" style="background:#fa4d4d;" onclick="fmtApply('color','#fa4d4d','cardText')" title="{{ __('app.color_red') }}"></div>
  <div class="fmt-dot" style="background:#ff8c00;" onclick="fmtApply('color','#ff8c00','cardText')" title="{{ __('app.color_orange') }}"></div>
  <div class="fmt-dot" style="background:#f5c400;" onclick="fmtApply('color','#f5c400','cardText')" title="{{ __('app.color_yellow') }}"></div>
  <div class="fmt-dot" style="background:#28cd41;" onclick="fmtApply('color','#28cd41','cardText')" title="{{ __('app.color_green') }}"></div>
  <div class="fmt-dot" style="background:#007aff;" onclick="fmtApply('color','#007aff','cardText')" title="{{ __('app.color_blue') }}"></div>
  <div class="fmt-dot" style="background:#bf5af2;" onclick="fmtApply('color','#bf5af2','cardText')" title="{{ __('app.color_purple') }}"></div>
  <div class="fmt-div"></div>
  <button class="fmt-btn clr" onclick="fmtApply('clear','','cardText')" title="{{ __('app.remove') }}">✕</button>
</div>

<!-- FORMAT POPOVER (DESCRIÇÃO) -->
<div class="fmt-pop" id="fmtPopDesc">
  <button class="fmt-btn" onclick="fmtApply('bold','','cardDesc')" title="{{ __('app.bold') }}"><b>B</b></button>
  <button class="fmt-btn" onclick="fmtApply('upper','','cardDesc')" style="font-size:.6rem;letter-spacing:.04em;" title="{{ __('app.uppercase') }}">AA</button>
  <button class="fmt-btn" onclick="fmtApply('highlight','','cardDesc')" title="{{ __('app.highlight') }}" style="background:#f5c400;color:#000;font-size:.7rem;font-weight:800;padding:0 .35rem;">H</button>
  <div class="fmt-div"></div>
  <div class="fmt-dot" style="background:#fa4d4d;" onclick="fmtApply('color','#fa4d4d','cardDesc')" title="{{ __('app.color_red') }}"></div>
  <div class="fmt-dot" style="background:#ff8c00;" onclick="fmtApply('color','#ff8c00','cardDesc')" title="{{ __('app.color_orange') }}"></div>
  <div class="fmt-dot" style="background:#f5c400;" onclick="fmtApply('color','#f5c400','cardDesc')" title="{{ __('app.color_yellow') }}"></div>
  <div class="fmt-dot" style="background:#28cd41;" onclick="fmtApply('color','#28cd41','cardDesc')" title="{{ __('app.color_green') }}"></div>
  <div class="fmt-dot" style="background:#007aff;" onclick="fmtApply('color','#007aff','cardDesc')" title="{{ __('app.color_blue') }}"></div>
  <div class="fmt-dot" style="background:#bf5af2;" onclick="fmtApply('color','#bf5af2','cardDesc')" title="{{ __('app.color_purple') }}"></div>
  <div class="fmt-div"></div>
  <button class="fmt-btn clr" onclick="fmtApply('clear','','cardDesc')" title="{{ __('app.remove') }}">✕</button>
</div>

<!-- MODAL: GERENCIAR SUBCATEGORIAS -->
<div class="overlay" id="subcatModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('subcatModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <h2>{{ __('app.subcats') }}</h2>
    <p style="font-size:.75rem;color:var(--muted);margin-bottom:1rem;">{{ __('app.subcats_hint') }}</p>
    <div id="subcatList" style="margin-bottom:1rem;display:flex;flex-direction:column;gap:.5rem;"></div>
    <div style="display:flex;gap:.5rem;">
      <input type="text" id="subcatNewName" placeholder="{{ __('app.ph_subcat_name') }}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.82rem;padding:.5rem .75rem;outline:none;" onkeydown="if(event.key==='Enter')addSubcat()">
      <button class="hbtn hbtn-primary" onclick="addSubcat()">{{ __('app.add') }}</button>
    </div>
    <div class="modal-footer">
      <button class="hbtn hbtn-primary" onclick="closeModal('subcatModal')">{{ __('app.close') }}</button>
    </div>
  </div>
</div>

<!-- MODAL: MOVER CARD -->
<div class="overlay" id="moveModal">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('moveModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <h2 id="moveModalTitle">{{ __('app.move_card') }}</h2>
    <p style="font-size:.78rem;color:var(--muted);margin-bottom:1rem;" id="moveCardName"></p>
    <!-- ETAPA 1: lista de categorias -->
    <div id="moveStep1">
      <div id="moveProjectList"></div>
    </div>
    <!-- ETAPA 2: escolha de subcategoria -->
    <div id="moveStep2" style="display:none;">
      <button onclick="moveBackToStep1()" style="display:flex;align-items:center;gap:.4rem;background:none;border:none;color:var(--accent);font-size:.8rem;font-weight:700;cursor:pointer;padding:0;margin-bottom:1rem;">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Voltar
      </button>
      <p style="font-size:.8rem;color:var(--muted);margin-bottom:.75rem;">{{ __('app.target_subcat') }}</p>
      <div id="moveSubcatList" style="display:flex;flex-direction:column;gap:.5rem;"></div>
      <div style="margin-top:1rem;">
        <button class="hbtn hbtn-primary" style="width:100%;" onclick="executeMoveToSubcat(null)">{{ __('app.no_subcat') }}</button>
      </div>
    </div>
  </div>
</div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<!-- SCROLL TOP -->
<!-- MODAL: ATALHOS DE TECLADO -->
<div class="overlay" id="shortcutModal" onclick="closeShortcutOnBackdrop(event)">
  <div class="modal shortcut-modal">
    <button class="modal-close" onclick="closeModal('shortcutModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <div class="shortcut-header">
      <h2>{{ __('app.help_h2') }}</h2>
    </div>
    <div id="shortcutModalBody">
      @php
        $contatos = array_values(array_filter([
          $help['support_email'] ? ['icone' => 'email', 'rotulo' => __('app.help_email'),
                                    'url' => 'mailto:'.$help['support_email'], 'externo' => false] : null,
          $help['whatsapp'] ? ['icone' => 'whatsapp', 'rotulo' => 'WhatsApp',
                               'url' => 'https://wa.me/'.preg_replace('/\D/', '', $help['whatsapp']), 'externo' => true] : null,
          $help['telegram_url'] ? ['icone' => 'telegram', 'rotulo' => __('app.help_telegram'),
                                   'url' => $help['telegram_url'], 'externo' => true] : null,
          $help['instagram_url'] ? ['icone' => 'instagram', 'rotulo' => 'Instagram',
                                    'url' => $help['instagram_url'], 'externo' => true] : null,
          $help['site_url'] ? ['icone' => 'site', 'rotulo' => __('app.help_site'),
                               'url' => $help['site_url'], 'externo' => true] : null,
        ]));
      @endphp
      {{-- Assistente do Telegram: primeiro, porque responde na hora.
           `start=ajuda` é a única forma de o Telegram carregar informação num
           link, e o bot trata essa palavra como "abra o menu de perguntas". --}}
      @if (config('telegram.bot_username'))
        <a class="hbtn hbtn-primary btn-block assistente-btn"
           href="https://t.me/{{ config('telegram.bot_username') }}?start=ajuda"
           target="_blank" rel="noopener noreferrer">
          @include('partials.icons.telegram', ['size' => 18])
          {{ __('app.help_bot') }}
        </a>
        <p class="help-text" style="text-align:center;margin:.5rem 0 1.2rem;">{{ __('app.help_bot_sub') }}</p>
      @endif

      @if ($help['help_text'] || $contatos)
        <div class="help-box">
          <div class="shortcut-section-title" style="margin-bottom:.6rem;">{{ __('app.help_need') }}</div>
          @if ($help['help_text'])
            @foreach (preg_split('/\r?\n/', trim($help['help_text'])) as $linha)
              @if (trim($linha) !== '')<p class="help-text">{{ $linha }}</p>@endif
            @endforeach
          @endif
          @if ($contatos)
            <div class="help-links">
              @foreach ($contatos as $contato)
                <a href="{{ $contato['url'] }}" class="help-link"
                   @if ($contato['externo']) target="_blank" rel="noopener noreferrer" @endif
                   title="{{ $contato['rotulo'] }}">
                  @include('partials.icons.'.$contato['icone'], ['size' => 30])
                  <span>{{ $contato['rotulo'] }}</span>
                </a>
              @endforeach
            </div>
          @endif
        </div>
      @endif

      {{-- Tutorial: vídeo embedado ou PDF, definido pelo master no painel --}}
      @if ($help['tutorial_url'])
        <div class="help-box">
          <div class="shortcut-section-title" style="margin-bottom:.6rem;">{{ __('app.help_tutorial') }}</div>
          @php
            $tut = $help['tutorial_url'];
            $ehVideo = (bool) preg_match('~(youtube\.com|youtu\.be|vimeo\.com)~i', $tut);
            $embed = $tut;
            if (preg_match('~youtu\.be/([\w-]+)~i', $tut, $m)) $embed = 'https://www.youtube.com/embed/'.$m[1];
            elseif (preg_match('~youtube\.com/watch\?v=([\w-]+)~i', $tut, $m)) $embed = 'https://www.youtube.com/embed/'.$m[1];
            elseif (preg_match('~vimeo\.com/(\d+)~i', $tut, $m)) $embed = 'https://player.vimeo.com/video/'.$m[1];
          @endphp
          @if ($ehVideo)
            <div class="help-video">
              <iframe src="{{ $embed }}" title="{{ __('app.help_tutorial') }}" loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                      allowfullscreen></iframe>
            </div>
          @else
            <a href="{{ $tut }}" target="_blank" rel="noopener noreferrer" class="hbtn hbtn-primary" style="width:100%;justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 2h8l4 4v16H6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 2v4h4M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              {{ __('app.help_open_tutorial') }}
            </a>
          @endif
        </div>
      @endif

    </div>
  </div>
</div>

{{-- ══ CELULAR: o botão solto ao lado da barra de baixo ══
     Abre o painel lateral da tela em que a pessoa está:
     Home e Bônus → categorias · Comunidade → ranking · Gerador → blocos.
     No computador o mobile.css esconde os dois. --}}
<div class="painel-fundo" id="painelFundo" onclick="fecharPainelMobile()"></div>
<button class="btn-painel" id="btnPainel" onclick="alternarPainelMobile()" aria-label="Abrir painel">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>
</button>

<script>
/* O painel do celular não é modal novo: é a coluna lateral do computador
   trazida para cima da tela pelo mobile.css. Aqui só ligamos e desligamos
   a classe — nada do app.js precisa saber que isso existe. */
/* Além de painel-aberto, marca QUAL painel abrir (painel-cat/rank/gen):
   o mobile.css não depende só do :has(), que alguns Safari de iPhone não
   reavaliam quando a classe do body muda — o botão "não fazia nada". */
var PAINEL_DA_TELA = { homePage: 'painel-cat', communityPage: 'painel-rank', generatorPage: 'painel-gen' };
function alternarPainelMobile(){
  var b = document.body, abrir = !b.classList.contains('painel-aberto');
  b.classList.remove('painel-cat', 'painel-rank', 'painel-gen');
  if (abrir) {
    var tela = document.querySelector('#homePage.active, #communityPage.active, #generatorPage.active');
    if (tela) b.classList.add(PAINEL_DA_TELA[tela.id]);
  }
  b.classList.toggle('painel-aberto', abrir);
}
function fecharPainelMobile(){ document.body.classList.remove('painel-aberto', 'painel-cat', 'painel-rank', 'painel-gen'); }

/* escolher uma categoria (ou um bloco do gerador) fecha o painel sozinho:
   senão a pessoa escolhe e continua olhando para a folha */
document.addEventListener('click', function(e){
  if (!document.body.classList.contains('painel-aberto')) return;
  // só escolher fecha: "Limpar tudo" do gerador e "Editar" da categoria não
  if (e.target.closest('.cat-editar, .gen-clear')) return;
  if (e.target.closest('.cat-card, .gen-rail .gen-mode, .rank-item')) fecharPainelMobile();
}, true);

/* ── Categorias: no celular sempre em lista ───────────────────────
   O carrossel (roda) não funcionou bem no celular; lá o botão dele some
   (mobile.css) e o modo vira lista. A troca é feita SEM gravar a escolha:
   setModoCategorias() gravaria no navegador e mudaria o computador também,
   se fosse o mesmo. Voltando a tela grande, volta o modo que a pessoa
   tinha escolhido. */
(function(){
  const CELULAR = matchMedia("(max-width:700px)");
  function ajustarModo(){
    if (typeof aplicarModoCategorias !== "function") return;   // app.js ainda não carregou
    let salvo = "roda";
    try { salvo = localStorage.getItem("modoCategorias") || "roda"; } catch (e) {}
    const certo = CELULAR.matches ? "lista" : salvo;
    if (modoCategorias === certo) return;
    modoCategorias = certo;
    aplicarModoCategorias();
    if (typeof posicionarRoda === "function") posicionarRoda();
  }
  document.addEventListener("DOMContentLoaded", ajustarModo);
  CELULAR.addEventListener("change", ajustarModo);
  // reserva: nem todo navegador avisa a troca de faixa ao arrastar a janela
  let espera; window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(ajustarModo, 150); });
})();

/* ── Plano Básico ─────────────────────────────────────────────────
   No computador o Básico vê Bônus e Gerador, que abrem o convite para o
   Premium. No celular a barra mostra só o que o plano tem (o mobile.css
   esconde pelas classes abaixo). PROMPTART é criado mais para baixo na
   página, por isso espera o carregamento. */
document.addEventListener("DOMContentLoaded", function(){
  const u = (window.PROMPTART && PROMPTART.user) || {};
  document.body.classList.toggle("sem-bonus", !u.has_bonus_library);
  document.body.classList.toggle("sem-gerador", !u.has_generator);
});

/* ── Busca dos painéis (Home, Favoritos, Comunidade) ──────────────
   No celular a busca é um círculo com lupa. Tocar abre o campo por cima
   da linha inteira; o X fecha e limpa. Limpar dispara o próprio "input"
   do campo, então quem filtra continua sendo o código que já existia
   (filterCards, renderFavoritesPage, loadCommunity) — nada aqui sabe
   filtrar nada. */
function abrirBuscaPainel(btn){
  const caixa = btn.closest('.panel-notch, .painel-tools');
  if (!caixa) return;
  caixa.classList.add('busca-aberta');
  const campo = btn.closest('.search-wrap').querySelector('input');
  if (campo) setTimeout(() => campo.focus(), 30);
}
function fecharBuscaPainel(btn){
  const wrap = btn.closest('.search-wrap');
  const campo = wrap && wrap.querySelector('input');
  if (campo && campo.value) {
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const caixa = btn.closest('.panel-notch, .painel-tools');
  if (caixa) caixa.classList.remove('busca-aberta');
}

/* ── Filtros da Comunidade ────────────────────────────────────────
   No celular as pílulas "Mais curtidos / Meus favoritos / Todos" não cabem
   na linha e moram num cartão que abre pelo botão de filtro. Escolher uma
   fecha o cartão; tocar fora também. */
function alternarFiltroComunidade(e){
  e.stopPropagation();
  e.currentTarget.closest('.comm-filtro').classList.toggle('aberto');
}
document.addEventListener('click', function(e){
  const aberto = document.querySelector('.comm-filtro.aberto');
  if (!aberto) return;
  if (e.target.closest('.comm-filtro-menu .fpill') || !e.target.closest('.comm-filtro')) {
    aberto.classList.remove('aberto');
  }
});

/* trocar de aba fecha o painel: o conteúdo dele é de outra tela */
document.querySelectorAll('.nav-pills .npill').forEach(function(b){
  b.addEventListener('click', fecharPainelMobile);
});
</script>

{{-- ══ CELULAR: dica "Instale o PromptArt" ══
     Só no navegador do celular, nunca dentro do app já instalado, e só até a
     pessoa fechar (ou instalar). iPhone: explica o caminho pelo Compartilhar,
     porque o Safari não deixa o site instalar sozinho. Android: o Chrome
     avisa que o site pode ser instalado, e o botão "Instalar" abre a janela
     dele. No computador o app.css esconde. --}}
<div class="dica-instalar" id="dicaInstalar" role="dialog" aria-labelledby="dicaInstalarTitulo">
  <img src="{{ asset('icons/icon-192.png') }}" alt="">
  <div class="dica-texto">
    <strong id="dicaInstalarTitulo">{{ __('app.pwa_title') }}</strong>
    <p id="dicaInstalarTexto"></p>
    <button class="dica-botao" onclick="instalarApp()">{{ __('app.pwa_install') }}</button>
  </div>
  <button class="dica-fechar" onclick="fecharDicaInstalar()" aria-label="{{ __('app.close') }}">
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
  </button>
</div>
<script>
(function(){
  const CHAVE = 'dicaInstalarVista';
  const dica = document.getElementById('dicaInstalar');
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let jaViu = false;
  try { jaViu = localStorage.getItem(CHAVE) === '1'; } catch (e) {}
  let pedidoAndroid = null;

  function mostrar(texto, comBotao){
    if (instalado || jaViu || !matchMedia('(max-width:700px)').matches) return;
    document.getElementById('dicaInstalarTexto').textContent = texto;
    dica.classList.toggle('com-botao', comBotao);
    dica.classList.add('mostrar');
  }
  window.fecharDicaInstalar = function(){
    dica.classList.remove('mostrar');
    jaViu = true;
    try { localStorage.setItem(CHAVE, '1'); } catch (e) {}
  };
  window.instalarApp = function(){
    if (pedidoAndroid) { pedidoAndroid.prompt(); pedidoAndroid = null; }
    fecharDicaInstalar();
  };

  // Android (Chrome): o próprio navegador diz quando dá para instalar
  window.addEventListener('beforeinstallprompt', function(e){
    if (instalado || jaViu || !matchMedia('(max-width:700px)').matches) return;
    e.preventDefault();
    pedidoAndroid = e;
    setTimeout(function(){ mostrar(@json(__('app.pwa_android')), true); }, 3000);
  });
  window.addEventListener('appinstalled', fecharDicaInstalar);

  // iPhone: só no Safari (Chrome/Firefox do iPhone têm outro caminho)
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (iphone) window.addEventListener('load', function(){
    setTimeout(function(){ mostrar(@json(__('app.pwa_ios')), false); }, 3000);
  });
})();
</script>
<button class="scroll-top" id="scrollTopBtn" onclick="window.scrollTo({top:0,behavior:'smooth'})">
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>


<!-- MODAL: UPSELL PREMIUM -->
<div class="overlay" id="upsellModal">
  <div class="modal" style="max-width:420px;text-align:center;">
    <button class="modal-close" onclick="closeModal('upsellModal')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <div style="font-size:2.2rem;margin-bottom:.5rem;">✨</div>
    <h2 style="margin-bottom:.5rem;">{{ __('app.premium_feature') }}</h2>
    <p id="upsellText" style="font-size:.82rem;color:var(--muted);line-height:1.6;margin-bottom:1.2rem;"></p>
    <a class="hbtn hbtn-primary" href="/app" style="justify-content:center;width:100%;padding:.6rem;">{{ __('app.know_premium') }}</a>
  </div>
</div>

<script>
window.PROMPTART = {
  user: @json($me),
  counts: @json($counts),
  csrf: "{{ csrf_token() }}",
  locale: "{{ config('promptart.locales')[app()->getLocale()]['html'] }}",
  routes: { plans: "/app", logout: "/app" }
};
// textos da interface (lang/{idioma}/app.php)
window.T = @json(__('app'));
</script>
<script src="{{ asset('js/api.js') }}?v={{ filemtime(public_path('js/api.js')) }}"></script>
<script src="{{ asset('js/app.js') }}?v={{ filemtime(public_path('js/app.js')) }}"></script>
<script src="{{ asset('js/degrau.js') }}?v={{ filemtime(public_path('js/degrau.js')) }}"></script>
<script src="{{ asset('js/pessoal.js') }}?v={{ filemtime(public_path('js/pessoal.js')) }}"></script>
</body>
</html>
