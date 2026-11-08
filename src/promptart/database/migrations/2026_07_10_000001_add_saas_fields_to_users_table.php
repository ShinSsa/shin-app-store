<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // datetime (não timestamp) para não esbarrar no limite de 2038 do MySQL
            $table->dateTime('trial_ends_at')->nullable()->after('password');
            $table->unsignedBigInteger('storage_used_bytes')->default(0)->after('trial_ends_at');
            $table->boolean('is_admin')->default(false)->after('storage_used_bytes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['trial_ends_at', 'storage_used_bytes', 'is_admin']);
        });
    }
};
