<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use ZipArchive;

/**
 * Backup completo em um .zip: os dados (categorias, subcategorias, prompts,
 * fotos registradas) num JSON e os arquivos das fotos numa pasta.
 *
 *   promptart-backup.json
 *   arquivos/uploads/1/foto.png
 *   arquivos/uploads/1/thumbs/foto.webp
 *
 * O mesmo formato sai do site (ferramentas/exportar-do-site.php, rodado no
 * servidor) e sai daqui, então serve tanto para trazer tudo do site quanto
 * para guardar uma cópia do próprio Umbrel e restaurar depois.
 *
 * Importar SUBSTITUI tudo: é uma restauração, não uma soma. Assim dá para
 * repetir a importação quantas vezes quiser sem duplicar nada.
 */
class BackupController extends Controller
{
    /** Tabelas na ordem de inserção (pais antes dos filhos). */
    private const TABELAS = ['categories', 'subcategories', 'prompts', 'prompt_subcategory', 'uploads'];

    private const JSON = 'promptart-backup.json';

    public function exportar(Request $request)
    {
        @set_time_limit(0);
        $user = $request->user();

        $dados = [
            'formato' => 'promptart-backup',
            'versao' => 1,
            'origem' => 'umbrel',
            'criado_em' => now()->toIso8601String(),
            'usuario' => ['name' => $user->name],
            'tabelas' => [],
        ];
        foreach (self::TABELAS as $tabela) {
            $dados['tabelas'][$tabela] = DB::table($tabela)->get()->map(fn ($r) => (array) $r)->all();
        }

        $tmp = tempnam(sys_get_temp_dir(), 'pa-backup-');
        $zip = new ZipArchive;
        $zip->open($tmp, ZipArchive::OVERWRITE);
        $zip->addFromString(self::JSON, json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $raiz = $this->raizDasFotos();
        if (is_dir($raiz)) {
            $itens = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($raiz, \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($itens as $item) {
                if ($item->isFile()) {
                    $relativo = ltrim(substr($item->getPathname(), strlen($raiz)), '/');
                    $zip->addFile($item->getPathname(), 'arquivos/'.$relativo);
                    // fotos já são comprimidas: guardar sem comprimir é bem mais rápido
                    $zip->setCompressionName('arquivos/'.$relativo, ZipArchive::CM_STORE);
                }
            }
        }
        $zip->close();

        return response()->download($tmp, 'promptart-backup-'.now()->format('Y-m-d').'.zip', [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend();
    }

    public function importar(Request $request)
    {
        @set_time_limit(0);

        $request->validate(['arquivo' => ['required', 'file']]);
        $caminhoZip = $request->file('arquivo')->getRealPath();

        $zip = new ZipArchive;
        if ($zip->open($caminhoZip) !== true) {
            throw ValidationException::withMessages(['arquivo' => 'Este arquivo não é um .zip válido.']);
        }

        $json = $zip->getFromName(self::JSON);
        $dados = $json === false ? null : json_decode($json, true);
        if (! is_array($dados) || ($dados['formato'] ?? null) !== 'promptart-backup' || ! is_array($dados['tabelas'] ?? null)) {
            $zip->close();
            throw ValidationException::withMessages(['arquivo' => 'Este .zip não é um backup do PromptArt (falta o promptart-backup.json).']);
        }

        $user = $request->user();
        $raiz = $this->raizDasFotos();
        $novo = $raiz.'/.importando';

        // 1) Fotos primeiro, numa pasta à parte: se algo falhar aqui, nada do que já existe foi tocado
        $this->apagarPasta($novo);
        @mkdir($novo, 0775, true);
        $fotos = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $nome = $zip->getNameIndex($i);
            if (! str_starts_with($nome, 'arquivos/') || str_ends_with($nome, '/')) {
                continue;
            }
            $relativo = substr($nome, strlen('arquivos/'));
            if ($relativo === '' || str_contains($relativo, '..') || str_starts_with($relativo, '/')) {
                continue;
            }
            $destino = $novo.'/'.$relativo;
            @mkdir(dirname($destino), 0775, true);
            $entrada = $zip->getStream($nome);
            $saida = fopen($destino, 'wb');
            if ($entrada === false || $saida === false) {
                $zip->close();
                $this->apagarPasta($novo);
                throw ValidationException::withMessages(['arquivo' => "Não consegui gravar a foto {$relativo}. Confira o espaço livre do Umbrel."]);
            }
            stream_copy_to_stream($entrada, $saida);
            fclose($entrada);
            fclose($saida);
            $fotos++;
        }
        $zip->close();

        // 2) Banco: troca tudo de uma vez (ou nada, se der erro)
        $tabelas = $dados['tabelas'];
        DB::transaction(function () use ($tabelas, $user) {
            foreach (array_reverse(self::TABELAS) as $tabela) {
                DB::table($tabela)->delete();
            }
            foreach (self::TABELAS as $tabela) {
                $colunas = array_flip(Schema::getColumnListing($tabela));
                $linhas = [];
                foreach ((array) ($tabelas[$tabela] ?? []) as $linha) {
                    if (! is_array($linha)) {
                        continue;
                    }
                    $linha = array_intersect_key($linha, $colunas);
                    if (isset($colunas['user_id'])) {
                        $linha['user_id'] = $user->id;
                    }
                    $linhas[] = $linha;
                }
                foreach (array_chunk($linhas, 40) as $lote) {
                    DB::table($tabela)->insert($lote);
                }
            }
            $user->forceFill(['storage_used_bytes' => (int) DB::table('uploads')->sum('size_bytes')])->save();
        });

        // 3) Troca as pastas de fotos: sai a antiga, entra a nova
        foreach (scandir($raiz) ?: [] as $nome) {
            if ($nome !== '.' && $nome !== '..' && $nome !== '.importando') {
                $this->apagarPasta($raiz.'/'.$nome);
            }
        }
        foreach (scandir($novo) ?: [] as $nome) {
            if ($nome !== '.' && $nome !== '..') {
                rename($novo.'/'.$nome, $raiz.'/'.$nome);
            }
        }
        $this->apagarPasta($novo);

        return response()->json([
            'categorias' => count((array) ($tabelas['categories'] ?? [])),
            'prompts' => count((array) ($tabelas['prompts'] ?? [])),
            'fotos' => $fotos,
        ]);
    }

    private function raizDasFotos(): string
    {
        $raiz = rtrim(config('filesystems.disks.'.config('promptart.uploads.disk').'.root'), '/');
        is_dir($raiz) || @mkdir($raiz, 0775, true);

        return $raiz;
    }

    private function apagarPasta(string $pasta): void
    {
        if (is_file($pasta) || is_link($pasta)) {
            @unlink($pasta);

            return;
        }
        if (! is_dir($pasta)) {
            return;
        }
        $itens = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($pasta, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($itens as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($pasta);
    }
}
