<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'trial_ends_at',
        'trial_plan_id',
        'avatar_path',
        'birth_date',
        'terms_accepted_at',
        'tips_enabled',
        'locale',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** Espelha os defaults do banco para que instâncias recém-criadas já respondam certo. */
    protected $attributes = [
        'is_admin' => false,
        'is_master' => false,
        'tips_enabled' => true,
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'announcements_read_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'birth_date' => 'date',
            'terms_accepted_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_master' => 'boolean',
            'tips_enabled' => 'boolean',
            'last_login_at' => 'datetime',
            'inactivity_notified_at' => 'datetime',
            'inactivity_reminded_at' => 'datetime',
            'storage_used_bytes' => 'integer',
        ];
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    /** Prompts da biblioteca bônus que este usuário marcou com a estrela. */
    public function bonusFavorites(): BelongsToMany
    {
        return $this->belongsToMany(BonusPrompt::class, 'bonus_prompt_favorites')->withTimestamps();
    }

    public function prompts(): HasMany
    {
        return $this->hasMany(Prompt::class);
    }

    public function uploads(): HasMany
    {
        return $this->hasMany(Upload::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Assinatura que ainda dá acesso. Duas situações contam:
     *
     * 1. "active" dentro do período contratado — com tolerância, porque o
     *    Mercado Pago pode demorar a confirmar a renovação;
     * 2. "canceled" pelo próprio usuário, mas com período já pago em aberto —
     *    ele usa até o dia que pagou. Aqui NÃO há tolerância: não existe
     *    renovação a caminho, então o acesso acaba na data exata.
     */
    public function activeSubscription(): HasOne
    {
        $grace = now()->subDays(config('promptart.subscription.grace_days'));

        return $this->hasOne(Subscription::class)
            ->where(function ($q) use ($grace) {
                $q->where(function ($ativa) use ($grace) {
                    $ativa->where('status', 'active')
                        ->where(function ($periodo) use ($grace) {
                            $periodo->whereNull('current_period_end')
                                ->orWhere('current_period_end', '>', $grace);
                        });
                })->orWhere(function ($cancelada) {
                    $cancelada->where('status', 'canceled')
                        ->whereNotNull('current_period_end')
                        ->where('current_period_end', '>', now());
                });
            })
            ->latest('id');
    }

    public function onTrial(): bool
    {
        return $this->trial_ends_at !== null && $this->trial_ends_at->isFuture();
    }

    public function hasActiveSubscription(): bool
    {
        return $this->activeSubscription()->exists();
    }

    /** Data em que o acesso atual vence (trial ou assinatura). Null = sem acesso/ilimitado. */
    public function accessEndsAt(): ?\Illuminate\Support\Carbon
    {
        if ($this->is_admin) {
            return null;
        }

        $subscriptionEnd = $this->activeSubscription()->first()?->current_period_end;

        if ($subscriptionEnd !== null) {
            return $subscriptionEnd;
        }

        return $this->onTrial() ? $this->trial_ends_at : null;
    }

    public function hasAccess(): bool
    {
        return $this->is_admin || $this->onTrial() || $this->hasActiveSubscription();
    }

    /** Plano do teste grátis, quando o cupom/ADM concedeu um plano específico. */
    public function trialPlan(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Plan::class, 'trial_plan_id');
    }

    /**
     * Plano vigente: o da assinatura paga; se estiver só em teste grátis,
     * o plano que o cupom/ADM concedeu (ex.: "Premium por 7 dias").
     */
    public function currentPlan(): ?Plan
    {
        $subscriptionPlan = $this->activeSubscription()->with('plan')->first()?->plan;

        if ($subscriptionPlan !== null) {
            return $subscriptionPlan;
        }

        return $this->onTrial() ? $this->trialPlan : null;
    }

    /** Gerador de prompts: trial (isca de conversão), plano com gerador ou ADM. */
    public function hasGenerator(): bool
    {
        if ($this->is_admin) {
            return true;
        }

        $plan = $this->currentPlan();

        if ($plan !== null) {
            return (bool) $plan->has_generator;
        }

        return $this->onTrial();
    }

    /** Biblioteca bônus: plano premium (inclusive via cupom/ADM) ou ADM. */
    public function hasBonusLibrary(): bool
    {
        return $this->is_admin || (bool) $this->currentPlan()?->has_bonus_library;
    }

    /** O master não tem teto: a biblioteca inteira do produto vive na conta dele. */
    public function hasUnlimitedStorage(): bool
    {
        return (bool) $this->is_master;
    }

    public function storageLimitBytes(): int
    {
        if ($this->hasUnlimitedStorage()) {
            return PHP_INT_MAX;
        }

        // ADM comum: valor definido pelo master no painel (não depende de plano).
        if ($this->is_admin) {
            return (int) Setting::adminStorageMb() * 1024 * 1024;
        }

        $plan = $this->currentPlan();

        $mb = $plan?->storage_limit_mb ?? config('promptart.storage.trial_mb');

        return (int) $mb * 1024 * 1024;
    }

    // ── Perfil ───────────────────────────────────────────

    /** Nível exibido no avatar: premium (moldura dourada) ou comum (moldura azul). */
    public function isPremium(): bool
    {
        return $this->is_admin || (bool) $this->currentPlan()?->has_bonus_library;
    }

    public function avatarUrl(): ?string
    {
        return \App\Support\MediaUrl::resolveThumb($this->avatar_path);
    }

    /** Iniciais para o avatar quando não há foto. */
    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if ($parts === []) {
            return '?';
        }

        $first = mb_substr($parts[0], 0, 1);
        $last = count($parts) > 1 ? mb_substr($parts[count($parts) - 1], 0, 1) : '';

        return mb_strtoupper($first.$last);
    }

    public function birthdayToday(): bool
    {
        return $this->birth_date !== null
            && $this->birth_date->format('m-d') === now()->format('m-d');
    }

    /** Dias até o próximo aniversário (0 = hoje). Null se não informou a data. */
    public function daysUntilBirthday(): ?int
    {
        if ($this->birth_date === null) {
            return null;
        }

        $today = now()->startOfDay();
        $next = $this->birth_date->copy()->year($today->year)->startOfDay();

        if ($next->lt($today)) {
            $next->addYear();
        }

        return (int) $today->diffInDays($next);
    }

    public function age(): ?int
    {
        return $this->birth_date?->age;
    }

    public function hasAcceptedTerms(): bool
    {
        return $this->terms_accepted_at !== null;
    }

    // ── Hierarquia de administração ──────────────────────

    /** ADM master: manda em tudo (planos, biblioteca bônus, promover ADMs, ajuda). */
    public function isMaster(): bool
    {
        return (bool) $this->is_master;
    }

    /**
     * A assinatura mais recente, em qualquer estado. Serve para o painel dizer
     * se a pessoa CANCELOU ou apenas deixou vencer — `canceled_at` continua
     * preenchido depois que o status vira `expired`.
     */
    public function latestSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    // ── Notificações ─────────────────────────────────────

    /**
     * Idioma dos e-mails enviados a este usuário (Laravel lê isso sozinho ao
     * notificar). Sem preferência gravada, cai no idioma padrão do site.
     */
    public function preferredLocale(): string
    {
        return $this->locale ?: config('app.locale');
    }

    // ── Inatividade ──────────────────────────────────────

    /** Dias desde o último acesso. Null se nunca entrou (conta recém-criada). */
    public function daysSinceLastLogin(): ?int
    {
        $ref = $this->last_login_at ?? $this->created_at;

        return $ref ? (int) $ref->diffInDays(now()) : null;
    }

    /** Quando o acesso pago acabou (cancelou ou venceu). Null = nunca assinou. */
    public function accessLostAt(): ?\Illuminate\Support\Carbon
    {
        return $this->subscriptions()
            ->whereIn('status', ['canceled', 'expired'])
            ->whereNotNull('current_period_end')
            ->orderByDesc('current_period_end')
            ->first()?->current_period_end;
    }

    /** Dias desde que o acesso pago acabou. */
    public function daysSinceAccessLost(): ?int
    {
        $fim = $this->accessLostAt();

        return $fim ? (int) $fim->diffInDays(now()) : null;
    }

    public function wasNotifiedOfInactivity(): bool
    {
        return $this->inactivity_notified_at !== null;
    }

    /**
     * Até quando vale o aviso atual. Null = nenhum aviso valendo:
     * nunca foi avisado, ou voltou a entrar depois do aviso.
     */
    public function inactivityDeadline(): ?\Illuminate\Support\Carbon
    {
        if ($this->inactivity_notified_at === null) {
            return null;
        }

        if ($this->last_login_at !== null && $this->last_login_at->gt($this->inactivity_notified_at)) {
            return null;
        }

        return $this->inactivity_notified_at->copy()->addDays(config('promptart.inactivity.grace_days'));
    }

    /**
     * Passou do prazo depois de ser avisado e não voltou:
     * candidato à exclusão (o ADM decide).
     */
    public function overdueForDeletion(): bool
    {
        $prazo = $this->inactivityDeadline();

        return $prazo !== null && now()->gt($prazo);
    }

    // ── Área colaborativa ────────────────────────────────

    public function sharedPrompts(): HasMany
    {
        return $this->hasMany(SharedPrompt::class);
    }
}
