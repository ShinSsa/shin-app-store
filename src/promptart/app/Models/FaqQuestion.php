<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Pergunta que o assistente não soube responder.
 *
 * Duas preocupações moram aqui. A primeira é agrupar: variações da mesma
 * dúvida viram uma linha com contador. A segunda é o que se guarda — texto
 * livre de suporte recebe o que a pessoa resolver digitar, inclusive o que
 * ninguém pediu.
 */
class FaqQuestion extends Model
{
    public const PENDENTE = 'pendente';

    public const RESPONDIDA = 'respondida';

    public const DESCARTADA = 'descartada';

    protected $fillable = [
        'text', 'normalized', 'telegram_username', 'chat_id',
        'times_asked', 'status', 'last_asked_at',
    ];

    protected function casts(): array
    {
        return ['last_asked_at' => 'datetime'];
    }

    /**
     * Registra a dúvida. Se uma igual já existe, só incrementa o contador.
     *
     * @return array{0:self,1:bool} a pergunta e se ela é nova
     */
    public static function registrar(string $texto, ?string $username, ?int $chatId): array
    {
        $texto = self::limpar($texto);
        $chave = self::normalizar($texto);

        $existente = static::where('normalized', $chave)->first();

        if ($existente) {
            $existente->increment('times_asked');
            $existente->forceFill([
                'last_asked_at' => now(),
                'telegram_username' => $existente->status === self::PENDENTE ? $username : null,
                'chat_id' => $existente->status === self::PENDENTE ? $chatId : null,
            ])->save();

            return [$existente, false];
        }

        return [static::create([
            'text' => $texto,
            'normalized' => $chave,
            'telegram_username' => $username,
            'chat_id' => $chatId,
            'last_asked_at' => now(),
        ]), true];
    }

    /**
     * Rede de proteção na entrada. Ninguém deveria digitar cartão ou senha
     * num chat de suporte, mas digita — e a partir daí o dado passa a morar
     * no nosso banco e em todos os backups. Sequência longa de dígitos vira
     * marcador antes de ser gravada.
     */
    public static function limpar(string $texto): string
    {
        $texto = preg_replace('/\b[\d\s.\-]{12,}\b/u', '[número removido]', trim($texto));

        return mb_substr((string) $texto, 0, 500);
    }

    /** Minúsculas, sem acento e sem espaço sobrando — para agrupar iguais. */
    public static function normalizar(string $texto): string
    {
        $texto = mb_strtolower(trim($texto));
        $texto = strtr($texto, [
            'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a',
            'é' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ï' => 'i',
            'ó' => 'o', 'õ' => 'o', 'ô' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ü' => 'u', 'ç' => 'c',
        ]);
        $texto = preg_replace('/[^a-z0-9 ]+/', ' ', $texto);
        $texto = preg_replace('/\s+/', ' ', (string) $texto);

        return mb_substr(trim((string) $texto), 0, 191);
    }

    /** Ao resolver, o que identifica quem perguntou deixa de fazer sentido. */
    public function resolver(string $status): void
    {
        $this->forceFill([
            'status' => $status,
            'telegram_username' => null,
            'chat_id' => null,
        ])->save();
    }
}
