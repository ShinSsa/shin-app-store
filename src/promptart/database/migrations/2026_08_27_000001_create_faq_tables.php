<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cada nó é uma resposta do assistente. O `slug` é o que viaja no
        // botão do Telegram, que tem limite de 64 bytes no dado do callback.
        Schema::create('faq_nodes', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 48)->unique();
            $table->string('title');           // como aparece na lista do painel
            $table->text('body');              // a resposta em si
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Os botões de cada nó. Tabela à parte porque o ADM edita, reordena e
        // apaga um a um — guardar como JSON dificultaria justamente isso.
        Schema::create('faq_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faq_node_id')->constrained()->cascadeOnDelete();
            $table->string('label', 64);       // o Telegram corta rótulo longo
            $table->string('target', 48);      // slug do nó de destino
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['faq_node_id', 'sort_order']);
        });

        /* Perguntas que o bot não soube responder.
           `normalized` existe para agrupar variações da mesma dúvida em uma
           linha só, com contador — vinte pessoas perguntando o mesmo vale
           mais que vinte linhas iguais.
           `telegram_username` e `chat_id` são apagados quando a pergunta é
           resolvida: depois disso identificar quem perguntou não serve para
           nada, e guardar sem finalidade é o que a LGPD não quer. */
        Schema::create('faq_questions', function (Blueprint $table) {
            $table->id();
            $table->text('text');
            $table->string('normalized', 191)->index();
            $table->string('telegram_username')->nullable();
            $table->unsignedBigInteger('chat_id')->nullable();
            $table->unsignedInteger('times_asked')->default(1);
            $table->string('status', 12)->default('pendente');
            $table->timestamp('last_asked_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'times_asked']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faq_questions');
        Schema::dropIfExists('faq_options');
        Schema::dropIfExists('faq_nodes');
    }
};
