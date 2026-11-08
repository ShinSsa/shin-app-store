<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** A cor padrão da categoria era o cinza #d2dae0; com o card em vidro
     *  passou a ser o azul da logo. Quem já tinha categorias continuava com o
     *  cinza guardado no banco, então a Home ficava cinza e só a bônus azul.
     *  Troca só quem está exatamente no antigo padrão — cor escolhida a dedo
     *  não é tocada. */
    private const ANTIGO = '#d2dae0';

    private const NOVO = '#007aff';

    public function up(): void
    {
        foreach (['categories', 'bonus_categories'] as $tabela) {
            // o padrão da COLUNA também era o cinza: sem trocar aqui, toda
            // categoria nova continuaria nascendo cinza mesmo com o código novo
            Schema::table($tabela, function (Blueprint $t) {
                $t->string('color', 7)->default(self::NOVO)->change();
            });

            DB::table($tabela)
                ->whereRaw('LOWER(color) = ?', [self::ANTIGO])
                ->update(['color' => self::NOVO]);
        }
    }

    public function down(): void
    {
        foreach (['categories', 'bonus_categories'] as $tabela) {
            Schema::table($tabela, function (Blueprint $t) {
                $t->string('color', 7)->default(self::ANTIGO)->change();
            });

            DB::table($tabela)
                ->whereRaw('LOWER(color) = ?', [self::NOVO])
                ->update(['color' => self::ANTIGO]);
        }
    }
};
