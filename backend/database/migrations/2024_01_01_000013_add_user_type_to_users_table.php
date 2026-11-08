<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('user_type')->default('manager')->after('is_active'); // 'administrator' | 'manager'
        });

        // On fresh installs the initial admin (migration 2024_01_01_000011) is created
        // before this column exists, so make sure the root administrator is flagged correctly.
        DB::table('users')->where('email', 'admin@crm.local')->update(['user_type' => 'administrator']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('user_type');
        });
    }
};
