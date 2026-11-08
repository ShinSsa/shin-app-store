<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Uma resposta do assistente, com os botões que saem dela. */
class FaqNode extends Model
{
    public const RAIZ = 'start';

    protected $fillable = ['slug', 'title', 'body', 'sort_order', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function options(): HasMany
    {
        return $this->hasMany(FaqOption::class)->orderBy('sort_order')->orderBy('id');
    }

    public static function porSlug(string $slug): ?self
    {
        return static::with('options')->where('slug', $slug)->where('active', true)->first();
    }

    /**
     * Busca antes de dar a pergunta como perdida.
     *
     * O TÍTULO manda. O corpo só é consultado quando o usuário escreveu uma
     * frase de verdade — palavra curta e comum casava por acaso no meio de
     * qualquer resposta ("ajuda" batia em "a cor ajuda a bater o olho", dentro
     * de Criar categoria). Resposta errada é pior que "não sei": pelo menos o
     * "não sei" vira pendência e alguém conserta.
     */
    public static function procurar(string $texto): ?self
    {
        $texto = trim($texto);

        if (mb_strlen($texto) < 3) {
            return null;
        }

        $porTitulo = static::with('options')
            ->where('active', true)
            ->where('title', 'like', "%{$texto}%")
            ->orderBy('sort_order')
            ->first();

        if ($porTitulo || mb_strlen($texto) < 8) {
            return $porTitulo;
        }

        return static::with('options')
            ->where('active', true)
            ->where('body', 'like', "%{$texto}%")
            ->orderBy('sort_order')
            ->first();
    }
}
