<?php

namespace App\Support;

/**
 * A cor da categoria. Desde a reforma do card em vidro, a cor escolhida pelo
 * usuário é a do PAINEL DE TRÁS — a frente virou vidro jateado e deixa ela
 * aparecer. O padrão é o azul da logo.
 *
 * `fundo()` continua devolvendo o tom mais escuro (cada canal x 0,805) porque
 * o painel ADM e a biblioteca bônus ainda o usam para a borda de baixo.
 */
class CategoryColor
{
    public const PADRAO = '#007aff';

    /** Quanto a camada de trás escurece em relação à frente. */
    private const FATOR = 0.805;

    /** Acima disto o fundo é claro demais para texto branco. */
    private const LIMIAR_CONTRASTE = 0.45;

    /** Normaliza para #RRGGBB minúsculo; devolve o padrão se vier lixo. */
    public static function normalizar(?string $hex): string
    {
        $hex = strtolower(trim((string) $hex));

        if (preg_match('/^#?([0-9a-f]{3})$/', $hex, $m)) {
            [$r, $g, $b] = str_split($m[1]);
            $hex = "#{$r}{$r}{$g}{$g}{$b}{$b}";
        }

        if (preg_match('/^#?([0-9a-f]{6})$/', $hex, $m)) {
            return '#'.$m[1];
        }

        return self::PADRAO;
    }

    /** A camada de trás: a mesma cor, mais escura. */
    public static function fundo(?string $hex): string
    {
        [$r, $g, $b] = self::rgb(self::normalizar($hex));

        return sprintf('#%02x%02x%02x',
            (int) round($r * self::FATOR),
            (int) round($g * self::FATOR),
            (int) round($b * self::FATOR),
        );
    }

    /**
     * Cor do texto sobre a camada de trás — que agora é a própria cor escolhida.
     * Sem isso, uma categoria amarelo-clara ficaria com a descrição em branco
     * sobre fundo claro, ilegível.
     */
    public static function textoSobreFundo(?string $hex): string
    {
        return self::luminancia(self::normalizar($hex)) > self::LIMIAR_CONTRASTE ? '#1b1f24' : '#ffffff';
    }

    /** @return array{0:int,1:int,2:int} */
    private static function rgb(string $hex): array
    {
        return [
            hexdec(substr($hex, 1, 2)),
            hexdec(substr($hex, 3, 2)),
            hexdec(substr($hex, 5, 2)),
        ];
    }

    /** Luminância relativa (WCAG), 0 = preto, 1 = branco. */
    private static function luminancia(string $hex): float
    {
        $canais = array_map(function (int $c): float {
            $c /= 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        }, self::rgb($hex));

        return 0.2126 * $canais[0] + 0.7152 * $canais[1] + 0.0722 * $canais[2];
    }
}
