<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trial_coupons', function (Blueprint $table) {
            // Qual plano o cupom libera durante o teste (null = acesso básico de trial)
            $table->foreignId('plan_id')->nullable()->after('trial_days')
                ->constrained('plans')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('trial_coupons', function (Blueprint $table) {
            $table->dropConstrainedForeignId('plan_id');
        });
    }
};
