<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->unsignedInteger('trial_days');
            $table->dateTime('expires_at')->nullable();     // validade do cupom
            $table->unsignedInteger('max_uses')->nullable(); // null = ilimitado
            $table->unsignedInteger('uses_count')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_coupons');
    }
};
