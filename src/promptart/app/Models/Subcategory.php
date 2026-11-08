<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Subcategory extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'sort_order',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function prompts(): BelongsToMany
    {
        return $this->belongsToMany(Prompt::class);
    }
}
