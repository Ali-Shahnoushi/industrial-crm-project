<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('parts')) {
            Schema::table('parts', function (Blueprint $table) {
                if (!Schema::hasColumn('parts', 'min_stock')) {
                    $table->integer('min_stock')->default(0)->after('stock_quantity');
                }
                if (!Schema::hasColumn('parts', 'unit')) {
                    $table->string('unit', 30)->default('دستگاه')->after('min_stock');
                }
            });
        }
    }

    public function down(): void
    {
        // Intentional no-op to preserve zero-data-loss guarantee on production databases.
    }
};
