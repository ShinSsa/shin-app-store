<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Aviso escrito por um ADM e exibido no sino de todos os usuários. */
class Announcement extends Model
{
    protected $fillable = ['user_id', 'title', 'body', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Os avisos no ar, do mais recente para o mais antigo. */
    public static function visiveis(int $limite = 20)
    {
        return static::where('active', true)->latest('id')->limit($limite)->get();
    }

    /**
     * Quantos avisos o usuário ainda não viu. Sem data de leitura, tudo é novo
     * — inclusive para quem acabou de se cadastrar.
     */
    public static function naoLidos(User $user): int
    {
        return static::where('active', true)
            ->when($user->announcements_read_at, fn ($q) => $q->where('created_at', '>', $user->announcements_read_at))
            ->count();
    }
}
