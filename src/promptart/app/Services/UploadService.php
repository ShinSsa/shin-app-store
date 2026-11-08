<?php

namespace App\Services;

use App\Models\BonusCategory;
use App\Models\BonusPrompt;
use App\Models\SharedPrompt;
use App\Models\Upload;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UploadService
{
    public function __construct(private ImageThumbnailer $thumbnailer) {}

    /**
     * Valida mime real, tamanho por arquivo e limite total do plano;
     * salva em uploads/{user_id}/ com nome hasheado e registra em `uploads`.
     * Para imagens, gera também uma miniatura leve (não conta na cota).
     */
    public function store(User $user, UploadedFile $file): Upload
    {
        $mime = $file->getMimeType();
        $allowed = config('promptart.uploads.allowed_mimes');

        if (! in_array($mime, $allowed, true)) {
            throw ValidationException::withMessages([
                'file' => 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP, GIF ou MP4.',
            ]);
        }

        $isVideo = str_starts_with($mime, 'video/');
        $maxKb = $isVideo
            ? config('promptart.storage.max_video_kb')
            : config('promptart.storage.max_image_kb');

        $size = $file->getSize();

        if ($size > $maxKb * 1024) {
            throw ValidationException::withMessages([
                'file' => 'Arquivo excede o tamanho máximo de '.round($maxKb / 1024).'MB.',
            ]);
        }

        if ($user->storage_used_bytes + $size > $user->storageLimitBytes()) {
            throw ValidationException::withMessages([
                'file' => 'Limite de armazenamento do seu plano atingido. Exclua arquivos ou faça upgrade.',
            ]);
        }

        $disk = config('promptart.uploads.disk');
        $name = Str::random(40).'.'.strtolower($file->getClientOriginalExtension());
        $path = $file->storeAs("uploads/{$user->id}", $name, $disk);

        // miniatura leve (o original é preservado para o clique = ver maior)
        $this->thumbnailer->generate(Storage::disk($disk), $path, $mime);

        return DB::transaction(function () use ($user, $file, $disk, $path, $size, $mime) {
            $upload = $user->uploads()->create([
                'path' => $path,
                'disk' => $disk,
                'size_bytes' => $size,
                'mime' => $mime,
                'original_name' => $file->getClientOriginalName(),
            ]);

            $user->increment('storage_used_bytes', $size);

            return $upload;
        });
    }

    public function delete(Upload $upload): void
    {
        DB::transaction(function () use ($upload) {
            $disk = Storage::disk($upload->disk);
            $disk->delete($upload->path);
            $disk->delete(ImageThumbnailer::thumbPathFor($upload->path)); // remove a miniatura junto
            $user = $upload->user;
            $user->decrement('storage_used_bytes', min($upload->size_bytes, $user->storage_used_bytes));
            $upload->delete();
        });
    }

    /** Remove arquivos referenciados por paths (usado na exclusão de prompts/categorias). */
    public function deleteByPaths(User $user, array $paths): void
    {
        $paths = array_values(array_filter($paths, fn ($p) => $p && ! str_starts_with($p, 'http')));

        if ($paths === []) {
            return;
        }

        // A biblioteca bônus e a comunidade guardam CÓPIAS que apontam para os
        // mesmos arquivos. Apagar aqui deixaria o assinante vendo card sem foto,
        // então o arquivo fica — e vira órfão de verdade só quando a cópia sumir.
        // Quem recolhe depois é o comando promptart:prune-uploads.
        $paths = array_values(array_diff($paths, $this->pathsAindaEmUso($paths)));

        if ($paths === []) {
            return;
        }

        $user->uploads()->whereIn('path', $paths)->get()
            ->each(fn (Upload $u) => $this->delete($u));
    }

    /**
     * Quais destes paths ainda aparecem numa cópia (bônus ou comunidade).
     *
     * @param  array<int, string>  $paths
     * @return array<int, string>
     */
    private function pathsAindaEmUso(array $paths): array
    {
        return collect()
            ->merge(BonusPrompt::whereIn('thumb1_path', $paths)->pluck('thumb1_path'))
            ->merge(BonusPrompt::whereIn('thumb2_path', $paths)->pluck('thumb2_path'))
            ->merge(BonusPrompt::whereIn('attachment_path', $paths)->pluck('attachment_path'))
            ->merge(BonusCategory::whereIn('thumb_path', $paths)->pluck('thumb_path'))
            ->merge(SharedPrompt::whereIn('thumb1_path', $paths)->pluck('thumb1_path'))
            ->merge(SharedPrompt::whereIn('thumb2_path', $paths)->pluck('thumb2_path'))
            ->unique()
            ->values()
            ->all();
    }
}
