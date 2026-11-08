<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bonus_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('thumb_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('bonus_prompts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bonus_category_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('tag')->nullable();
            $table->text('body');
            $table->text('description')->nullable();
            $table->string('thumb1_path')->nullable();
            $table->string('thumb2_path')->nullable();
            $table->string('attachment_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bonus_prompts');
        Schema::dropIfExists('bonus_categories');
    }
};
