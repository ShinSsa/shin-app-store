<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Define o idioma da requisição. Ordem de prioridade:
 * 1. escolha guardada na sessão (o clique na bandeirinha)
 * 2. idioma salvo no perfil do usuário
 * 3. padrão do site (pt_BR) — não seguimos o idioma do navegador de propósito:
 *    o público principal é brasileiro e quem quiser troca pela bandeirinha.
 */
class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->session()->get('locale')
            ?? $request->user()?->locale
            ?? config('app.locale');

        if (! array_key_exists($locale, config('promptart.locales'))) {
            $locale = config('app.locale');
        }

        App::setLocale($locale);

        return $next($request);
    }
}
