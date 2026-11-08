<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Liga cada item da biblioteca bônus à categoria/prompt de onde ele veio.
 *
 * A bônus continua sendo uma CÓPIA independente (editar o original não mexe
 * nela) — a origem é gravada só para o botão "Atualizar" saber onde procurar
 * prompts novos. Se a categoria original for excluída, o vínculo vira null e a
 * bônus segue intacta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bonus_categories', function (Blueprint $table) {
            $table->foreignId('source_category_id')->nullable()->after('id')
                ->constrained('categories')->nullOnDelete();
        });

        Schema::table('bonus_prompts', function (Blueprint $table) {
            $table->foreignId('source_prompt_id')->nullable()->after('bonus_category_id')
                ->constrained('prompts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bonus_categories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_category_id');
        });

        Schema::table('bonus_prompts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_prompt_id');
        });
    }
};
