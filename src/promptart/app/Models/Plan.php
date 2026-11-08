<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'label',
        'price_cents',
        'storage_limit_mb',
        'has_generator',
        'has_bonus_library',
        'mp_plan_id',
    ];

    protected function casts(): array
    {
        return [
            'has_generator' => 'boolean',
            'has_bonus_library' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function priceFormatted(): string
    {
        return 'R$ '.number_format($this->price_cents / 100, 2, ',', '.');
    }
}
