<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add Customer Portal & Sales Manager columns to `customers`
        if (Schema::hasTable('customers') && !Schema::hasColumn('customers', 'sales_manager_user_id')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->foreignId('sales_manager_user_id')
                    ->nullable()
                    ->after('created_by_user_id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }
        if (Schema::hasTable('customers') && !Schema::hasColumn('customers', 'portal_enabled')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->boolean('portal_enabled')->default(false)->after('notes');
            });
        }

        // 2. Link Customer Portal accounts (`users.customer_id`)
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'customer_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('customer_id')
                    ->nullable()
                    ->after('customer_scope')
                    ->constrained('customers')
                    ->cascadeOnDelete();
                $table->unique('customer_id', 'users_customer_id_unique');
            });
        }

        // 3. Create `ticket_departments` table
        if (!Schema::hasTable('ticket_departments')) {
            Schema::create('ticket_departments', function (Blueprint $table) {
                $table->id();
                $table->string('name', 120);
                $table->text('description')->nullable();
                $table->string('assignment_strategy', 30)->default('round_robin'); // round_robin | random | least_loaded
                $table->boolean('is_default_repair')->default(false);
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->foreignId('last_assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        // 4. Create `ticket_department_user` pivot table
        if (!Schema::hasTable('ticket_department_user')) {
            Schema::create('ticket_department_user', function (Blueprint $table) {
                $table->id();
                $table->foreignId('department_id')->constrained('ticket_departments')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['department_id', 'user_id']);
            });
        }

        // 5. Create `tickets` table
        if (!Schema::hasTable('tickets')) {
            Schema::create('tickets', function (Blueprint $table) {
                $table->id();
                $table->string('tracking_code', 40)->unique();
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->foreignId('customer_part_id')->nullable()->constrained('customer_parts')->nullOnDelete();
                $table->foreignId('department_id')->nullable()->constrained('ticket_departments')->nullOnDelete();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('ticket_type', 40)->default('general'); // repair_request | sales_inquiry | technical_support | general
                $table->string('priority', 20)->default('medium');     // low | medium | high | urgent
                $table->string('status', 30)->default('open');         // open | in_progress | answered | customer_reply | resolved | closed
                $table->string('subject', 200);
                $table->timestamp('last_reply_at')->nullable()->index();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();

                $table->index(['status', 'assigned_to_user_id']);
                $table->index(['customer_id', 'status']);
            });
        }

        // 6. Create `ticket_messages` table
        if (!Schema::hasTable('ticket_messages')) {
            Schema::create('ticket_messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('sender_type', 20)->default('staff'); // customer | staff | system
                $table->boolean('is_internal_note')->default(false);
                $table->text('body');
                $table->string('attachment_path')->nullable();
                $table->string('attachment_name')->nullable();
                $table->timestamps();

                $table->index(['ticket_id', 'is_internal_note']);
            });
        }

        // 7. Seed new Ticketing permissions & grant to existing staff roles idempotently
        if (Schema::hasTable('permissions')) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            $newPermissions = ['tickets.view', 'tickets.reply', 'tickets.manage'];
            foreach ($newPermissions as $permName) {
                Permission::firstOrCreate(['name' => $permName, 'guard_name' => 'web']);
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();

            if (Schema::hasTable('users')) {
                $admins = \App\Models\User::where('user_type', 'administrator')
                    ->orWhere('email', 'admin@crm.local')
                    ->get();
                foreach ($admins as $admin) {
                    $admin->givePermissionTo($newPermissions);
                }

                $managers = \App\Models\User::where('user_type', 'manager')->get();
                foreach ($managers as $manager) {
                    $manager->givePermissionTo($newPermissions);
                }

                $staffMembers = \App\Models\User::whereIn('user_type', ['salesperson', 'installer'])->get();
                foreach ($staffMembers as $staff) {
                    $staff->givePermissionTo(['tickets.view', 'tickets.reply']);
                }
            }
        }

        // 8. Seed initial default Ticket Departments if empty
        if (Schema::hasTable('ticket_departments') && DB::table('ticket_departments')->count() === 0) {
            $now = now();
            DB::table('ticket_departments')->insert([
                [
                    'name' => 'پشتیبانی فنی و تعمیرات دستگاه‌ها',
                    'description' => 'ثبت خرابی دستگاه، درخواست اعزام تکنسین، کالیبراسیون و سرویس ادواری',
                    'assignment_strategy' => 'least_loaded',
                    'is_default_repair' => true,
                    'is_active' => true,
                    'sort_order' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'واحد فروش و پیگیری پروژه',
                    'description' => 'ارتباط مستقیم با واحد فروش، استعلام قیمت دستگاه جدید و پیگیری قراردادها',
                    'assignment_strategy' => 'round_robin',
                    'is_default_repair' => false,
                    'is_active' => true,
                    'sort_order' => 2,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                [
                    'name' => 'گارانتی و خدمات پس از فروش',
                    'description' => 'استعلام وضعیت پوشش گارانتی، تمدید ضمانت‌نامه و قطعات مصرفی',
                    'assignment_strategy' => 'round_robin',
                    'is_default_repair' => false,
                    'is_active' => true,
                    'sort_order' => 3,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
        Schema::dropIfExists('ticket_department_user');
        Schema::dropIfExists('tickets');
        Schema::dropIfExists('ticket_departments');
    }
};
