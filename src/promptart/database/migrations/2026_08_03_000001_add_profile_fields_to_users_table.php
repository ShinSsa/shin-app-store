<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('email');
            $table->date('birth_date')->nullable()->after('avatar_path');
            $table->dateTime('terms_accepted_at')->nullable()->after('birth_date');

            // Plano que o teste grátis simula (null = acesso de trial padrão).
            // Permite ao ADM liberar "Premium por X dias" e ao cupom definir o plano.
            $table->foreignId('trial_plan_id')->nullable()->after('trial_ends_at')
                ->constrained('plans')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('trial_plan_id');
            $table->dropColumn(['avatar_path', 'birth_date', 'terms_accepted_at']);
        });
    }
};
