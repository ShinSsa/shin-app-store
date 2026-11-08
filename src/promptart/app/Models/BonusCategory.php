<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BonusCategory extends Model
{
    protected $fillable = [
        'source_category_id',
        'name',
        'description',
        'color',
        'thumb_path',
        'sort_order',
    ];

    public function prompts(): HasMany
    {
        return $this->hasMany(BonusPrompt::class)->orderBy('sort_order')->orderBy('id');
    }

    /** Categoria do ADM de onde esta veio — usada pelo botão "Atualizar". */
    public function sourceCategory(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Category::class, 'source_category_id');
    }
}
