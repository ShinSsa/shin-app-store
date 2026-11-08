<?php

/**
 * Tira do site (promptart.com.br) um backup SÓ da sua conta, com as fotos,
 * no formato que o PromptArt do Umbrel importa.
 *
 * Não muda nada no site: só lê o banco e copia as fotos para um .zip.
 *
 * Uso, dentro do servidor:
 *   cd /home/promptshinart/htdocs/promptart.com.br
 *   php /root/exportar-do-site.php
 *
 * Sem e-mail, exporta a conta do ADM master. Para outra conta:
 *   php /root/exportar-do-site.php email@da.conta
 *
 * Gera /root/promptart-para-umbrel.zip
 */

$site = getcwd();
if (! is_file($site.'/artisan')) {
    fwrite(STDERR, "Rode este comando de dentro da pasta do site (cd /home/promptshinart/htdocs/promptart.com.br).\n");
    exit(1);
}
if (! class_exists('ZipArchive')) {
    fwrite(STDERR, "O PHP do servidor está sem a extensão zip.\n");
    exit(1);
}

require $site.'/vendor/autoload.php';
$app = require $site.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();


$email = $argv[1] ?? null;
$user = $email
    ? \Illuminate\Support\Facades\DB::table('users')->where('email', $email)->first()
    : \Illuminate\Support\Facades\DB::table('users')->where('is_master', true)->orderBy('id')->first();

if (! $user) {
    fwrite(STDERR, "Conta não encontrada.\n");
    exit(1);
}

$categorias = \Illuminate\Support\Facades\DB::table('categories')->where('user_id', $user->id)->get();
$idsCat = $categorias->pluck('id')->all();
$subcategorias = \Illuminate\Support\Facades\DB::table('subcategories')->whereIn('category_id', $idsCat)->get();
$prompts = \Illuminate\Support\Facades\DB::table('prompts')->where('user_id', $user->id)->get();
$idsPrompt = $prompts->pluck('id')->all();
$pivo = collect();
foreach (array_chunk($idsPrompt, 500) as $lote) {
    $pivo = $pivo->merge(\Illuminate\Support\Facades\DB::table('prompt_subcategory')->whereIn('prompt_id', $lote)->get());
}
$uploads = \Illuminate\Support\Facades\DB::table('uploads')->where('user_id', $user->id)->get();

// Todos os arquivos que a conta usa: os registrados e os apontados pelos cards/capas
$caminhos = $uploads->pluck('path')->all();
foreach ($categorias as $c) {
    $caminhos[] = $c->thumb_path;
}
foreach ($prompts as $p) {
    array_push($caminhos, $p->thumb1_path, $p->thumb2_path, $p->attachment_path);
}
$caminhos = array_values(array_unique(array_filter($caminhos, fn ($c) => is_string($c) && $c !== ''
    && ! str_starts_with($c, 'http://') && ! str_starts_with($c, 'https://') && ! str_contains($c, '..'))));

// a miniatura leve de cada foto (mesma regra do ImageThumbnailer)
$miniatura = function (string $c): string {
    $barra = strrpos($c, '/');
    $pasta = $barra === false ? '' : substr($c, 0, $barra + 1);
    $arquivo = $barra === false ? $c : substr($c, $barra + 1);
    $ponto = strrpos($arquivo, '.');

    return $pasta.'thumbs/'.($ponto === false ? $arquivo : substr($arquivo, 0, $ponto)).'.webp';
};

$raiz = rtrim(config('filesystems.disks.'.config('promptart.uploads.disk').'.root'), '/');
$saida = getenv('PROMPTART_SAIDA') ?: '/root/promptart-para-umbrel.zip';
@unlink($saida);

$zip = new ZipArchive;
if ($zip->open($saida, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Não consegui criar {$saida}.\n");
    exit(1);
}

$dados = [
    'formato' => 'promptart-backup',
    'versao' => 1,
    'origem' => 'site',
    'criado_em' => date('c'),
    'usuario' => ['name' => $user->name],
    'tabelas' => [
        'categories' => $categorias->map(fn ($r) => (array) $r)->all(),
        'subcategories' => $subcategorias->map(fn ($r) => (array) $r)->all(),
        'prompts' => $prompts->map(fn ($r) => (array) $r)->all(),
        'prompt_subcategory' => $pivo->map(fn ($r) => (array) $r)->all(),
        'uploads' => $uploads->map(fn ($r) => (array) $r)->all(),
    ],
];
$zip->addFromString('promptart-backup.json', json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

$fotos = 0;
$bytes = 0;
$faltando = 0;
foreach ($caminhos as $c) {
    foreach ([$c, $miniatura($c)] as $i => $arquivo) {
        $completo = $raiz.'/'.$arquivo;
        if (! is_file($completo)) {
            if ($i === 0) {
                $faltando++;
            }
            continue;
        }
        $zip->addFile($completo, 'arquivos/'.$arquivo);
        $zip->setCompressionName('arquivos/'.$arquivo, ZipArchive::CM_STORE);
        $fotos++;
        $bytes += filesize($completo);
    }
}
$zip->close();

printf(
    "\n== PRONTO ==\nConta: %s\nCategorias: %d | Prompts: %d | Arquivos: %d (%.1f MB)%s\nArquivo: %s (%.1f MB)\n",
    $user->email,
    count($categorias),
    count($prompts),
    $fotos,
    $bytes / 1048576,
    $faltando ? " | {$faltando} foto(s) apontada(s) que não existem mais no disco" : '',
    $saida,
    filesize($saida) / 1048576
);
