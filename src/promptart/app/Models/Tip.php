<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Dica criada pelo ADM, exibida aleatoriamente ao usuário no login. */
class Tip extends Model
{
    protected $fillable = ['title', 'body', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public static function random(): ?self
    {
        return static::where('active', true)->inRandomOrder()->first();
    }
}
