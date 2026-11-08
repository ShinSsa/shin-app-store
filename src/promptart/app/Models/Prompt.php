<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Prompt extends Model
{
    protected $fillable = [
        'category_id',
        'user_id',
        'source',
        'title',
        'tag',
        'body',
        'description',
        'thumb1_path',
        'thumb1_pos_x',
        'thumb1_pos_y',
        'thumb2_path',
        'thumb2_pos_x',
        'thumb2_pos_y',
        'attachment_path',
        'attachment_name',
        'is_favorite',
        'char_count',
    ];

    protected function casts(): array
    {
        return [
            'is_favorite' => 'boolean',
            'char_count' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subcategories(): BelongsToMany
    {
        return $this->belongsToMany(Subcategory::class);
    }
}
