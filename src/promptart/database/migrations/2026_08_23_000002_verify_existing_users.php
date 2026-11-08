<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;

/**
 * Quem já tinha conta entra como verificado.
 *
 * Sem isto, no dia em que a confirmação de e-mail sobe todo mundo — inclusive
 * o dono — fica preso numa tela esperando um e-mail que nunca foi enviado.
 * A exigência vale só para quem se cadastrar daqui em diante.
 */
return new class extends Migration
{
    public function up(): void
    {
        User::whereNull('email_verified_at')->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // não desfaz: desverificar contas antigas só criaria o problema que
        // esta migration existe para evitar.
    }
};
