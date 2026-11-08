<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        // a API é carregada dentro de routes/web.php (mesma sessão, mesmo CSRF)
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Atrás do app_proxy do Umbrel, que já pediu a senha do Umbrel.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'pessoal' => \App\Http\Middleware\UsuarioPessoal::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        /* Página aberta há horas: a sessão vence e leva junto a chave do
           formulário. O Laravel devolveria a tela crua "419 PAGE EXPIRED", que
           é um beco sem saída — o usuário não tem como saber que basta
           recarregar. Aqui ele volta para o mesmo formulário, com a chave nova,
           o que digitou preservado (menos a senha) e um aviso do que houve. */
        /* O tipo aqui é HttpException, e não TokenMismatchException: o Laravel
           converte uma na outra ANTES de consultar os tratadores (veja
           prepareException). Casar pela classe original nunca dispararia. */
        $exceptions->render(function (HttpException $e, Request $request) {
            if ($e->getStatusCode() !== 419) {
                return null;   // deixa os outros erros seguirem o caminho normal
            }

            if ($request->expectsJson()) {
                return response()->json(['message' => __('site.messages.sessao_expirada')], 419);
            }

            /* De onde ele veio, lido da própria requisição. E só se for deste
               site: seguir um `referer` qualquer deixaria alguém usar o 419
               para jogar o usuário num endereço de fora. */
            $veioDe = (string) $request->headers->get('referer');
            $daCasa = $veioDe !== '' && str_starts_with($veioDe, $request->schemeAndHttpHost());

            return redirect($daCasa ? $veioDe : '/app')
                ->withInput($request->except(['password', 'password_confirmation', '_token']))
                ->with('status', __('site.messages.sessao_expirada'));
        });
    })->create();
