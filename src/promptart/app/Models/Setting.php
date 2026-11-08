<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/** Configurações gerais (ajuda, contatos) editadas pelo ADM master. */
class Setting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = Cache::rememberForever("setting:{$key}", fn () => static::find($key)?->value);

        return $value !== null && $value !== '' ? $value : $default;
    }

    public static function put(string $key, ?string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("setting:{$key}");
    }

    /** Espaço (MB) dos ADMs comuns — o master define no painel. */
    public static function adminStorageMb(): int
    {
        return (int) static::get('admin_storage_mb', (string) config('promptart.storage.admin_mb'));
    }

    /** Todos os campos de ajuda/contato em um array. */
    public static function help(): array
    {
        return [
            'help_text' => static::get('help_text'),
            'support_email' => static::get('support_email'),
            'telegram_url' => static::get('telegram_url'),
            'instagram_url' => static::get('instagram_url'),
            'whatsapp' => static::get('whatsapp'),
            'site_url' => static::get('site_url'),
            // link do tutorial: vídeo (YouTube/Vimeo) ou PDF
            'tutorial_url' => static::get('tutorial_url'),
        ];
    }
}
