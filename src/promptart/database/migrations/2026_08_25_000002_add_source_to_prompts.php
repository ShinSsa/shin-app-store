<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** De onde veio o card. Serve para o /status contar quantos entraram
     *  pelo Telegram, e para saber o peso do recurso lá na frente. */
    public function up(): void
    {
        Schema::table('prompts', function (Blueprint $table) {
            $table->string('source', 16)->default('web')->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('prompts', fn (Blueprint $t) => $t->dropColumn('source'));
    }
};
