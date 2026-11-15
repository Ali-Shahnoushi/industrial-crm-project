<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('parts') && !Schema::hasColumn('parts', 'unit_price')) {
            Schema::table('parts', function (Blueprint $table) {
                $table->decimal('unit_price', 18, 0)->default(0)->after('unit');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('parts') && Schema::hasColumn('parts', 'unit_price')) {
            Schema::table('parts', function (Blueprint $table) {
                $table->dropColumn('unit_price');
            });
        }
    }
};
