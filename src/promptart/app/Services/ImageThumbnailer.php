<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Log;

/**
 * Gera uma miniatura WebP leve (poucos KB) a partir de uma imagem armazenada,
 * preservando proporção. O original é mantido intacto para o "clique = ver maior".
 *
 * Convenção de caminho: uploads/{user}/{nome}.jpg → uploads/{user}/thumbs/{nome}.webp
 */
class ImageThumbnailer
{
    /** Deriva o caminho da miniatura a partir do caminho do original. */
    public static function thumbPathFor(string $originalPath): string
    {
        $slash = strrpos($originalPath, '/');
        $dir = $slash === false ? '' : substr($originalPath, 0, $slash + 1);
        $file = $slash === false ? $originalPath : substr($originalPath, $slash + 1);
        $dot = strrpos($file, '.');
        $base = $dot === false ? $file : substr($file, 0, $dot);

        return $dir.'thumbs/'.$base.'.webp';
    }

    /**
     * Cria a miniatura a partir do arquivo já salvo no disco.
     * Retorna o caminho da miniatura, ou null se não gerou (mime não suportado / erro).
     */
    public function generate(Filesystem $disk, string $originalPath, string $mime): ?string
    {
        if (! $this->isSupported($mime) || ! function_exists('imagewebp')) {
            return null;
        }

        try {
            $bytes = $disk->get($originalPath);
            $src = @imagecreatefromstring($bytes);

            if ($src === false) {
                return null;
            }

            $srcW = imagesx($src);
            $srcH = imagesy($src);
            $max = max(1, config('promptart.thumbnail.max_dimension'));

            // não amplia imagens menores que o alvo
            $scale = min(1, $max / max($srcW, $srcH));
            $dstW = max(1, (int) round($srcW * $scale));
            $dstH = max(1, (int) round($srcH * $scale));

            $dst = imagecreatetruecolor($dstW, $dstH);
            // preserva transparência (PNG/GIF/WebP)
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
            imagefilledrectangle($dst, 0, 0, $dstW, $dstH, $transparent);

            imagecopyresampled($dst, $src, 0, 0, 0, 0, $dstW, $dstH, $srcW, $srcH);

            ob_start();
            imagewebp($dst, null, max(1, min(100, config('promptart.thumbnail.quality'))));
            $webp = ob_get_clean();

            imagedestroy($src);
            imagedestroy($dst);

            if ($webp === false || $webp === '') {
                return null;
            }

            $thumbPath = self::thumbPathFor($originalPath);
            $disk->put($thumbPath, $webp);

            return $thumbPath;
        } catch (\Throwable $e) {
            Log::warning('Falha ao gerar miniatura', ['path' => $originalPath, 'erro' => $e->getMessage()]);

            return null;
        }
    }

    public function isSupported(string $mime): bool
    {
        return in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);
    }
}
