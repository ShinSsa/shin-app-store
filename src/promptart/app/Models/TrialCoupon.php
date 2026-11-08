<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialCoupon extends Model
{
    protected $fillable = [
        'code',
        'trial_days',
        'plan_id',
        'expires_at',
        'max_uses',
        'uses_count',
        'active',
    ];

    public function plan(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'active' => 'boolean',
        ];
    }

    public function isValid(): bool
    {
        if (! $this->active) {
            return false;
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return false;
        }

        if ($this->max_uses !== null && $this->uses_count >= $this->max_uses) {
            return false;
        }

        return true;
    }

    public static function findValid(?string $code): ?self
    {
        if ($code === null || trim($code) === '') {
            return null;
        }

        $coupon = static::whereRaw('LOWER(code) = ?', [mb_strtolower(trim($code))])->first();

        return $coupon && $coupon->isValid() ? $coupon : null;
    }
}
