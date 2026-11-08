<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avisos que qualquer ADM escreve e todos os usuários veem no sino.
 *
 * O "lido" é uma data única por usuário, não uma linha por aviso: abrir o
 * painel zera a bolinha, que é exatamente o comportamento pedido. Além de
 * simples, não cria uma tabela que cresce com usuários × avisos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // quem escreveu
            $table->string('title');
            $table->text('body');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dateTime('announcements_read_at')->nullable()->after('inactivity_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('announcements_read_at'));
        Schema::dropIfExists('announcements');
    }
};
