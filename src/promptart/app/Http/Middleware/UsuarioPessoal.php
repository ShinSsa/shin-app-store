<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Versão pessoal: existe um usuário só, e quem chega até o app já passou
 * pela tela de entrada do Umbrel. Não há login próprio: toda requisição
 * entra como esse usuário, criado sozinho no primeiro acesso.
 */
class UsuarioPessoal
{
    public function handle(Request $request, Closure $next)
    {
        Auth::guard('web')->setUser(self::usuario());

        return $next($request);
    }

    public static function usuario(): User
    {
        $user = User::query()->orderBy('id')->first();

        if ($user === null) {
            $user = new User;
            $user->forceFill([
                'name' => env('PROMPTART_NOME', 'Ramon'),
                'email' => 'eu@promptart.local',
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
                'is_admin' => true,
                'is_master' => true,
                'tips_enabled' => false,
            ])->save();
        }

        return $user;
    }
}
