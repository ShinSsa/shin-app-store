<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Código de uso único que o site mostra e o usuário manda para o bot.
 * Aleatório de propósito: derivar do id do usuário deixaria adivinhar o
 * código de outra pessoa e sequestrar a vinculação dela.
 */
class TelegramLinkCode extends Model
{
    protected $fillable = ['user_id', 'code', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Gera um código novo e derruba os anteriores que ainda não foram usados. */
    public static function gerarPara(User $user): self
    {
        static::where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $tamanho = config('telegram.codigo.tamanho', 8);

        do {
            // sem vogais e sem 0/O/1/I: o usuário lê da tela e digita no celular
            $code = substr(str_replace(['0', 'O', '1', 'I'], '', strtoupper(Str::random(32))), 0, $tamanho);
        } while (strlen($code) < $tamanho || static::where('code', $code)->exists());

        return static::create([
            'user_id' => $user->id,
            'code' => $code,
            'expires_at' => now()->addMinutes(config('telegram.codigo.validade_minutos', 10)),
        ]);
    }

    public static function valido(string $code): ?self
    {
        return static::where('code', strtoupper(trim($code)))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();
    }
}
