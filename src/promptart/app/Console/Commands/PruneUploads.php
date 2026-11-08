<?php

namespace App\Console\Commands;

use App\Models\BonusCategory;
use App\Models\BonusPrompt;
use App\Models\Category;
use App\Models\Prompt;
use App\Models\SharedPrompt;
use App\Models\Upload;
use App\Models\User;
use App\Services\UploadService;
use Illuminate\Console\Command;

/**
 * Faxina dos arquivos órfãos.
 *
 * Trocar a foto de um card grava um arquivo novo e deixa o antigo no disco —
 * nada o apaga, e ele continua contando no armazenamento do usuário. Este
 * comando remove o que NENHUM lugar do sistema referencia mais.
 *
 * Por segurança ele é conservador: sem --force apenas mostra o que faria.
 */
class PruneUploads extends Command
{
    protected $signature = 'promptart:prune-uploads
                            {--force : Apaga de verdade. Sem esta opção, apenas lista o que seria apagado.}';

    protected $description = 'Remove arquivos enviados que nenhum card, categoria, biblioteca bônus, comunidade ou avatar usa mais';

    public function handle(UploadService $uploads): int
    {
        $emUso = $this->pathsEmUso();

        $this->line('Arquivos em uso: '.$emUso->count());

        $orfaos = Upload::query()
            ->when($emUso->isNotEmpty(), fn ($q) => $q->whereNotIn('path', $emUso->all()))
            ->orderBy('id')
            ->get();

        if ($orfaos->isEmpty()) {
            $this->info('Nada a limpar — todos os arquivos estão em uso.');

            return self::SUCCESS;
        }

        $bytes = (int) $orfaos->sum('size_bytes');

        $this->newLine();
        $this->line('Órfãos encontrados: '.$orfaos->count().'  ('.$this->emMB($bytes).')');

        $this->table(
            ['Dono', 'Arquivo', 'Tamanho', 'Enviado em'],
            $orfaos->take(20)->map(fn (Upload $u) => [
                $u->user?->email ?? '(usuário removido)',
                $u->original_name,
                $this->emMB((int) $u->size_bytes),
                $u->created_at?->format('d/m/Y'),
            ])->all()
        );

        if ($orfaos->count() > 20) {
            $this->line('... e mais '.($orfaos->count() - 20).'.');
        }

        if (! $this->option('force')) {
            $this->newLine();
            $this->warn('Nada foi apagado. Rode de novo com --force para confirmar.');

            return self::SUCCESS;
        }

        $apagados = 0;

        foreach ($orfaos as $upload) {
            $uploads->delete($upload);
            $apagados++;
        }

        $this->newLine();
        $this->info("{$apagados} arquivo(s) apagado(s), ".$this->emMB($bytes).' liberado(s).');

        return self::SUCCESS;
    }

    /**
     * Todo caminho referenciado em qualquer lugar do sistema. As cópias da
     * biblioteca bônus e da comunidade apontam para os MESMOS arquivos do card
     * original — por isso elas entram na conta, senão a faxina apagaria a foto
     * que um assinante ainda vê.
     *
     * @return \Illuminate\Support\Collection<int, string>
     */
    private function pathsEmUso(): \Illuminate\Support\Collection
    {
        return collect()
            ->merge(Prompt::pluck('thumb1_path'))
            ->merge(Prompt::pluck('thumb2_path'))
            ->merge(Prompt::pluck('attachment_path'))
            ->merge(Category::pluck('thumb_path'))
            ->merge(BonusPrompt::pluck('thumb1_path'))
            ->merge(BonusPrompt::pluck('thumb2_path'))
            ->merge(BonusPrompt::pluck('attachment_path'))
            ->merge(BonusCategory::pluck('thumb_path'))
            ->merge(SharedPrompt::pluck('thumb1_path'))
            ->merge(SharedPrompt::pluck('thumb2_path'))
            ->merge(User::pluck('avatar_path'))
            ->filter(fn ($p) => is_string($p) && $p !== '' && ! str_starts_with($p, 'http'))
            ->unique()
            ->values();
    }

    private function emMB(int $bytes): string
    {
        return number_format($bytes / 1048576, 1, ',', '.').' MB';
    }
}
