<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prompts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('tag')->nullable();
            $table->text('body'); // HTML rico sanitizado
            $table->text('description')->nullable(); // HTML rico sanitizado
            $table->string('thumb1_path')->nullable();
            $table->enum('thumb1_pos_x', ['left', 'center', 'right'])->default('center');
            $table->enum('thumb1_pos_y', ['top', 'center', 'bottom'])->default('center');
            $table->string('thumb2_path')->nullable();
            $table->enum('thumb2_pos_x', ['left', 'center', 'right'])->default('center');
            $table->enum('thumb2_pos_y', ['top', 'center', 'bottom'])->default('center');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->boolean('is_favorite')->default(false);
            $table->unsignedInteger('char_count')->default(0);
            $table->timestamps();
        });

        Schema::create('prompt_subcategory', function (Blueprint $table) {
            $table->foreignId('prompt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subcategory_id')->constrained()->cascadeOnDelete();
            $table->primary(['prompt_id', 'subcategory_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prompt_subcategory');
        Schema::dropIfExists('prompts');
    }
};
