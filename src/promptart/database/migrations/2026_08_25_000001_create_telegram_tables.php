<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Quem é quem: o Telegram só nos manda o chat_id, e é por ele que
        // descobrimos de qual assinante é a mensagem.
        Schema::create('telegram_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // único de propósito: um chat só pode alimentar uma conta, senão
            // dava para cadastrar prompt na conta de outra pessoa
            $table->unsignedBigInteger('chat_id')->unique();
            $table->string('telegram_username')->nullable();
            $table->string('first_name')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // Código de uso único que o site gera e o usuário manda para o bot.
        Schema::create('telegram_link_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 12)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'used_at']);
        });

        // O Telegram reenvia a mensagem se a resposta demorar. Sem guardar o
        // que já foi processado, o mesmo prompt viraria dois cards.
        Schema::create('telegram_processed_updates', function (Blueprint $table) {
            $table->unsignedBigInteger('update_id')->primary();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_processed_updates');
        Schema::dropIfExists('telegram_link_codes');
        Schema::dropIfExists('telegram_links');
    }
};
