<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // ADM master: hierarquia acima do ADM comum
            $table->boolean('is_master')->default(false)->after('is_admin');

            // Preferência do usuário: pode desligar o pop-up de dicas
            $table->boolean('tips_enabled')->default(true)->after('is_master');

            // Controle de inatividade
            $table->dateTime('last_login_at')->nullable()->after('tips_enabled');
            $table->dateTime('inactivity_notified_at')->nullable()->after('last_login_at');
        });

        // quem já era admin no e-mail configurado vira o master
        $masterEmail = env('PROMPTART_ADMIN_EMAIL', 'admin@promptart.test');
        User::where('email', $masterEmail)->update(['is_master' => true, 'is_admin' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_master', 'tips_enabled', 'last_login_at', 'inactivity_notified_at']);
        });
    }
};
