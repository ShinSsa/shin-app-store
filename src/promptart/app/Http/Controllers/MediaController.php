<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;

/**
 * Serve as fotos e anexos guardados em storage/app/uploads.
 * Versão pessoal: só existe um usuário, então todo arquivo é dele.
 */
class MediaController extends Controller
{
    public function show(string $path)
    {
        $path = str_replace('\\', '/', $path);
        abort_if(str_contains($path, '..'), 404);

        $disk = Storage::disk(config('promptart.uploads.disk'));

        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }
}
