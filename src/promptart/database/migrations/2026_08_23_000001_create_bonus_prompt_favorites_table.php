<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A biblioteca bônus é lida por todo mundo, então o favorito não pode
        // morar no prompt: ele é de cada usuário. Mesmo desenho dos favoritos
        // da comunidade.
        Schema::create('bonus_prompt_favorites', function (Blueprint $table) {
            $table->foreignId('bonus_prompt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['bonus_prompt_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bonus_prompt_favorites');
    }
};
