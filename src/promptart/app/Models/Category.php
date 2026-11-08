<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'description',
        'color',
        'thumb_path',
        'sort_order',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subcategories(): HasMany
    {
        return $this->hasMany(Subcategory::class)->orderBy('sort_order')->orderBy('id');
    }

    public function prompts(): HasMany
    {
        return $this->hasMany(Prompt::class);
    }
}
