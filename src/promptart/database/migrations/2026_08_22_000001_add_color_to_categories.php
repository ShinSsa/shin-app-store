<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cor da categoria — substitui a foto de capa no card.
 *
 * `thumb_path` continua na tabela de propósito: o app para de usá-la, mas
 * as capas atuais não são apagadas. Se um dia a foto voltar, os dados estão lá.
 */
return new class extends Migration
{
    private const PADRAO = '#D2DAE0';

    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('color', 7)->default(self::PADRAO)->after('description');
        });

        Schema::table('bonus_categories', function (Blueprint $table) {
            $table->string('color', 7)->default(self::PADRAO)->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('categories', fn (Blueprint $t) => $t->dropColumn('color'));
        Schema::table('bonus_categories', fn (Blueprint $t) => $t->dropColumn('color'));
    }
};
