<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;

/**
 * Marca de "esta mensagem já foi tratada". A chave primária é o próprio
 * update_id, então quem tenta gravar duas vezes esbarra no banco — é a
 * garantia que sobrevive até a duas requisições simultâneas.
 */
class TelegramProcessedUpdate extends Model
{
    protected $table = 'telegram_processed_updates';

    protected $primaryKey = 'update_id';

    public $incrementing = false;

    public const UPDATED_AT = null;

    protected $fillable = ['update_id'];

    /** @return bool true se é a primeira vez que vemos este update. */
    public static function registrar(int $updateId): bool
    {
        try {
            static::create(['update_id' => $updateId]);

            return true;
        } catch (QueryException) {
            return false;   // chave duplicada: já passou por aqui
        }
    }
}
