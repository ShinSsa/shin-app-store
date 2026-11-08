<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class BonusPrompt extends Model
{
    protected $fillable = [
        'bonus_category_id',
        'source_prompt_id',
        'title',
        'tag',
        'body',
        'description',
        'thumb1_path',
        'thumb2_path',
        'attachment_path',
        'sort_order',
    ];

    public function bonusCategory(): BelongsTo
    {
        return $this->belongsTo(BonusCategory::class);
    }

    /** Favoritar é pessoal: o prompt bônus é o mesmo para todos os usuários. */
    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'bonus_prompt_favorites')->withTimestamps();
    }
}
