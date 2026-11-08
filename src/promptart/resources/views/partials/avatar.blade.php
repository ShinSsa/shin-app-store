{{--
  Avatar com moldura por nível:
  · usuário comum  → moldura azul
  · premium/ADM    → moldura dourada + coroa
  Uso: @include('partials.avatar', ['user' => $user, 'size' => 38])
--}}
@php
  $size = $size ?? 38;
  $isPremium = $user->isPremium();
  $url = $user->avatarUrl();
@endphp
<div class="av-wrap" style="width:{{ $size }}px;height:{{ $size }}px;">
  @if ($isPremium)<span class="av-crown" style="font-size:{{ max(9, $size * 0.32) }}px;">👑</span>@endif
  @if ($url)
    <img src="{{ $url }}" alt="{{ $user->name }}"
         class="av {{ $isPremium ? 'av-premium' : 'av-common' }}"
         style="width:{{ $size }}px;height:{{ $size }}px;">
  @else
    <div class="av av-fallback {{ $isPremium ? 'av-premium' : 'av-common' }}"
         style="width:{{ $size }}px;height:{{ $size }}px;font-size:{{ max(10, $size * 0.34) }}px;"
         title="{{ $user->name }}">{{ $user->initials() }}</div>
  @endif
</div>
