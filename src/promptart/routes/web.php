<?php

use App\Http\Controllers\BackupController;
use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

/*
 * PromptArt pessoal (Umbrel): só o app, as fotos e o backup.
 * Sem página de vendas, cadastro, login, planos, comunidade, bônus ou painel ADM.
 */
Route::middleware('pessoal')->group(function () {
    Route::redirect('/', '/app');

    Route::get('/app', function () {
        $user = request()->user();

        return view('app', [
            'help' => \App\Models\Setting::help(),
            'me' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_admin' => true,
                'is_master' => true,
                'on_trial' => false,
                'trial_ends_at' => null,
                'access_ends_at' => null,
                'plan' => null,
                'plan_label' => null,
                'has_generator' => true,
                'has_bonus_library' => false,
                'is_premium' => true,
                'avatar_url' => null,
                'storage_used_bytes' => $user->storage_used_bytes,
                'storage_limit_bytes' => null,
                'tips_enabled' => false,
            ],
            'counts' => ['shared' => 0],
        ]);
    })->name('app');

    Route::get('/media/{path}', [MediaController::class, 'show'])
        ->where('path', '.*')
        ->name('media.show');

    // Backup: baixar tudo em .zip e trazer o .zip do site (ou de outro Umbrel)
    Route::get('/backup/exportar', [BackupController::class, 'exportar'])->name('backup.exportar');
    Route::post('/backup/importar', [BackupController::class, 'importar'])->name('backup.importar');

    // a API do app vive aqui dentro para usar a mesma sessão e a mesma proteção CSRF
    Route::prefix('api')->group(base_path('routes/api.php'));
});
