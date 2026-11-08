<?php

namespace App\Support;

use App\Services\ImageThumbnailer;

class MediaUrl
{
    /**
     * Converte um valor de coluna *_path em URL exibível (ORIGINAL, tamanho cheio).
     * URLs externas passam direto; paths do storage privado viram
     * a rota controlada /media/{path} (auth + dono/plano).
     */
    public static function resolve(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return url('/media/'.ltrim($path, '/'));
    }

    /**
     * URL da MINIATURA leve (para o card). Cai no original quando não há thumb
     * (URL externa, vídeo, ou upload antigo sem miniatura).
     */
    public static function resolveThumb(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        // externas e vídeos não têm miniatura estática — usa o próprio valor
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if (preg_match('/\.(mp4|webm|ogg)$/i', $path)) {
            return self::resolve($path);
        }

        return url('/media/'.ltrim(ImageThumbnailer::thumbPathFor($path), '/'));
    }
}
