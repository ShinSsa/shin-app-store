<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'user_id',
        'plan_id',
        'mp_preapproval_id',
        'status',
        'current_period_end',
        'canceled_at',
    ];

    protected function casts(): array
    {
        return [
            'current_period_end' => 'datetime',
            'canceled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** Cancelada pelo usuário, mas com período pago ainda em aberto. */
    public function isCancelingAtPeriodEnd(): bool
    {
        return $this->status === 'canceled'
            && $this->current_period_end !== null
            && $this->current_period_end->isFuture();
    }

    /** Já foi paga alguma vez? (usamos para separar "cancelou" de "nunca chegou a pagar") */
    public function wasEverPaid(): bool
    {
        return $this->current_period_end !== null;
    }
}
