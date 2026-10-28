<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('part_service_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_part_id')->constrained('customer_parts')->cascadeOnDelete();
            $table->foreignId('performed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('service_date');
            $table->string('service_type')->default('repair'); // periodic | repair | overhaul
            $table->text('description');
            $table->decimal('cost', 14, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('part_service_histories');
    }
};
