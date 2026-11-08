<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Favoritar ≠ curtir: curtir é público (contador/ranking),
        // favoritar é a lista pessoal do usuário para reencontrar depois.
        Schema::create('shared_prompt_favorites', function (Blueprint $table) {
            $table->foreignId('shared_prompt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['shared_prompt_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_prompt_favorites');
    }
};
