<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Área colaborativa: cópia do prompt publicada pelo usuário.
        // É uma CÓPIA — editar/apagar o original não afeta o compartilhado.
        Schema::create('shared_prompts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('prompt_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('tag')->nullable();
            $table->text('body');
            $table->text('description')->nullable();
            $table->string('thumb1_path')->nullable();
            $table->string('thumb2_path')->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('copies_count')->default(0);
            // Moderação do ADM
            $table->boolean('is_blocked')->default(false);
            $table->string('blocked_reason')->nullable();
            $table->dateTime('blocked_at')->nullable();
            $table->timestamps();

            $table->index(['is_blocked', 'created_at']);
        });

        Schema::create('shared_prompt_likes', function (Blueprint $table) {
            $table->foreignId('shared_prompt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['shared_prompt_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_prompt_likes');
        Schema::dropIfExists('shared_prompts');
    }
};
