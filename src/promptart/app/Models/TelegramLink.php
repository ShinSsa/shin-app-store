<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** O vínculo entre uma conversa do Telegram e uma conta do PromptArt. */
class TelegramLink extends Model
{
    protected $fillable = [
        'user_id',
        'chat_id',
        'telegram_username',
        'first_name',
        'verified_at',
    ];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
