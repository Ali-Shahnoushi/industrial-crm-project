<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sales')) {
            Schema::create('sales', function (Blueprint $table) {
                $table->id();
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('sale_date')->index();
                $table->string('status', 20)->default('confirmed')->index(); // draft | confirmed | cancelled
                $table->string('payment_status', 20)->default('unpaid')->index(); // unpaid | partial | paid
                $table->decimal('subtotal', 18, 0)->default(0);
                $table->decimal('discount_amount', 18, 0)->default(0);
                $table->decimal('tax_percent', 5, 2)->default(10);
                $table->decimal('tax_amount', 18, 0)->default(0);
                $table->decimal('total', 18, 0)->default(0);
                $table->decimal('paid_amount', 18, 0)->default(0);
                $table->text('notes')->nullable();
                $table->softDeletes();
                $table->timestamps();

                $table->index(['customer_id', 'sale_date']);
                $table->index(['user_id', 'sale_date']);
                $table->index(['status', 'sale_date']);
            });
        }

        if (!Schema::hasTable('sale_items')) {
            Schema::create('sale_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
                $table->foreignId('part_id')->constrained('parts')->restrictOnDelete();
                $table->foreignId('customer_part_id')->nullable()->constrained('customer_parts')->nullOnDelete();
                $table->unsignedInteger('quantity')->default(1);
                $table->decimal('unit_price', 18, 0)->default(0);
                $table->decimal('discount_amount', 18, 0)->default(0);
                $table->decimal('line_total', 18, 0)->default(0);
                $table->timestamps();

                $table->index('customer_part_id');
                $table->index('part_id');
            });
        }

        if (!Schema::hasTable('invoices')) {
            Schema::create('invoices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
                $table->string('number', 60)->unique();
                $table->unsignedSmallInteger('jalali_year')->index();
                $table->unsignedInteger('sequence_number');
                $table->date('issued_at')->index();
                $table->date('due_at')->nullable();
                $table->string('status', 20)->default('issued')->index(); // issued | paid | void
                $table->text('notes')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['sale_id', 'status']);
                $table->index(['jalali_year', 'sequence_number']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
