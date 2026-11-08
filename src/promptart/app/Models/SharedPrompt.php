<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Prompt publicado na área colaborativa. É uma CÓPIA do prompt do usuário —
 * alterar ou apagar o original não afeta o que já foi compartilhado.
 */
class SharedPrompt extends Model
{
    protected $fillable = [
        'user_id',
        'prompt_id',
        'title',
        'tag',
        'body',
        'description',
        'thumb1_path',
        'thumb2_path',
    ];

    protected function casts(): array
    {
        return [
            'is_blocked' => 'boolean',
            'blocked_at' => 'datetime',
            'likes_count' => 'integer',
            'copies_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function likedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'shared_prompt_likes')->withTimestamps();
    }

    /** Favoritos pessoais (lista privada de cada usuário). */
    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'shared_prompt_favorites')->withTimestamps();
    }

    /** Somente os visíveis ao público (não bloqueados pelo ADM). */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_blocked', false);
    }
}
