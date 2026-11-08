<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // basico | premium
            $table->string('label');
            $table->unsignedInteger('price_cents');
            $table->unsignedInteger('storage_limit_mb');
            $table->boolean('has_generator')->default(false);
            $table->boolean('has_bonus_library')->default(false);
            $table->string('mp_plan_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
