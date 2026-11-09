<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public const SYSTEM_ROLES = [
        'administrator',
        'manager',
        'salesperson',
        'installer',
    ];

    /**
     * Run the migrations safely with zero data loss.
     */
    public function up(): void
    {
        // 1. Users: add customer_scope for granular customer visibility control
        if (!Schema::hasColumn('users', 'customer_scope')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('customer_scope', 30)->default('all')->after('user_type');
            });
        }

        // 2. Customers: make first_name, last_name, mobile nullable & track creator user
        Schema::table('customers', function (Blueprint $table) {
            $table->string('first_name')->nullable()->change();
            $table->string('last_name')->nullable()->change();
            $table->string('mobile')->nullable()->change();
        });

        if (!Schema::hasColumn('customers', 'created_by_user_id')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->foreignId('created_by_user_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }

        // Backfill created_by_user_id for pre-existing customers from customer_histories
        if (Schema::hasTable('customer_histories') && Schema::hasColumn('customers', 'created_by_user_id')) {
            $creationLogs = DB::table('customer_histories')
                ->where('action', 'created')
                ->whereNotNull('user_id')
                ->orderBy('id')
                ->get(['customer_id', 'user_id']);

            foreach ($creationLogs as $log) {
                DB::table('customers')
                    ->where('id', $log->customer_id)
                    ->whereNull('created_by_user_id')
                    ->update(['created_by_user_id' => $log->user_id]);
            }
        }

        // 3. Granular ACL exception tables for Salesperson / Staff customer visibility
        if (!Schema::hasTable('user_customer_staff_grants')) {
            Schema::create('user_customer_staff_grants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('grantee_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('staff_user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['grantee_user_id', 'staff_user_id'], 'ucsg_grantee_staff_unique');
            });
        }

        if (!Schema::hasTable('user_customer_grants')) {
            Schema::create('user_customer_grants', function (Blueprint $table) {
                $table->id();
                $table->foreignId('grantee_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['grantee_user_id', 'customer_id'], 'ucg_grantee_customer_unique');
            });
        }

        // 4. Devices (parts): add stock_quantity for warehouse inventory tracking
        if (!Schema::hasColumn('parts', 'stock_quantity')) {
            Schema::table('parts', function (Blueprint $table) {
                $table->unsignedInteger('stock_quantity')->default(0)->after('periodic_service_months');
            });
        }

        // 5. Assigned Devices (customer_parts): add quantity, invoice_amount, invoice_number
        Schema::table('customer_parts', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_parts', 'quantity')) {
                $table->unsignedInteger('quantity')->default(1)->after('serial_number');
            }
            if (!Schema::hasColumn('customer_parts', 'invoice_amount')) {
                $table->decimal('invoice_amount', 18, 0)->nullable()->after('quantity');
            }
            if (!Schema::hasColumn('customer_parts', 'invoice_number')) {
                $table->string('invoice_number', 100)->nullable()->after('invoice_amount');
            }
        });

        // 6. Warehouse Inventory Audit Logs table
        if (!Schema::hasTable('part_inventory_logs')) {
            Schema::create('part_inventory_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('part_id')->constrained('parts')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->foreignId('customer_part_id')->nullable()->constrained('customer_parts')->nullOnDelete();
                $table->string('type', 40)->index(); // in | out_manual | out_assign | return
                $table->unsignedInteger('quantity');
                $table->unsignedInteger('balance_before')->default(0);
                $table->unsignedInteger('balance_after')->default(0);
                $table->text('description')->nullable();
                $table->timestamps();

                $table->index(['part_id', 'created_at'], 'pil_part_created_idx');
            });
        }

        // 7. Register system roles in Spatie Permission and sync existing users' roles safely
        if (Schema::hasTable('roles')) {
            app()[PermissionRegistrar::class]->forgetCachedPermissions();

            foreach (self::SYSTEM_ROLES as $roleName) {
                Role::firstOrCreate([
                    'name' => $roleName,
                    'guard_name' => 'web',
                ]);
            }

            $users = \App\Models\User::all();
            foreach ($users as $user) {
                $role = in_array($user->user_type, self::SYSTEM_ROLES, true)
                    ? $user->user_type
                    : 'manager';
                if ($user->user_type !== $role) {
                    $user->user_type = $role;
                    $user->save();
                }
                $user->syncRoles([$role]);
            }

            app()[PermissionRegistrar::class]->forgetCachedPermissions();
        }
    }

    /**
     * Reverse the migrations safely.
     */
    public function down(): void
    {
        Schema::dropIfExists('part_inventory_logs');
        Schema::dropIfExists('user_customer_grants');
        Schema::dropIfExists('user_customer_staff_grants');

        Schema::table('customer_parts', function (Blueprint $table) {
            $cols = [];
            foreach (['quantity', 'invoice_amount', 'invoice_number'] as $col) {
                if (Schema::hasColumn('customer_parts', $col)) {
                    $cols[] = $col;
                }
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });

        if (Schema::hasColumn('parts', 'stock_quantity')) {
            Schema::table('parts', function (Blueprint $table) {
                $table->dropColumn('stock_quantity');
            });
        }

        if (Schema::hasColumn('customers', 'created_by_user_id')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropConstrainedForeignId('created_by_user_id');
            });
        }

        if (Schema::hasColumn('users', 'customer_scope')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('customer_scope');
            });
        }
    }
};
