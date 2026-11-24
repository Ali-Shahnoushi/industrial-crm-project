<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add device / session metadata columns to personal_access_tokens (idempotent)
        if (Schema::hasTable('personal_access_tokens')) {
            Schema::table('personal_access_tokens', function (Blueprint $table) {
                if (!Schema::hasColumn('personal_access_tokens', 'ip_address')) {
                    $table->string('ip_address', 45)->nullable()->after('abilities');
                }
                if (!Schema::hasColumn('personal_access_tokens', 'user_agent')) {
                    $table->text('user_agent')->nullable()->after('ip_address');
                }
                if (!Schema::hasColumn('personal_access_tokens', 'device_name')) {
                    $table->string('device_name', 120)->nullable()->after('user_agent');
                }
                if (!Schema::hasColumn('personal_access_tokens', 'browser')) {
                    $table->string('browser', 80)->nullable()->after('device_name');
                }
                if (!Schema::hasColumn('personal_access_tokens', 'platform')) {
                    $table->string('platform', 80)->nullable()->after('browser');
                }
            });
        }

        // 2. Seed new `users.sessions` ACL permission & grant to existing admins/managers idempotently
        if (Schema::hasTable('permissions')) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            $perm = Permission::firstOrCreate([
                'name' => 'users.sessions',
                'guard_name' => 'web',
            ]);

            if (Schema::hasTable('roles')) {
                foreach (['administrator', 'manager', 'super_admin'] as $roleName) {
                    $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
                    if ($role && !$role->hasPermissionTo($perm)) {
                        $role->givePermissionTo($perm);
                    }
                }
            }

            if (Schema::hasTable('users')) {
                $adminsAndManagers = \App\Models\User::whereIn('user_type', ['administrator', 'manager'])
                    ->orWhere('email', 'admin@crm.local')
                    ->get();

                foreach ($adminsAndManagers as $user) {
                    if (!$user->hasDirectPermission($perm)) {
                        $user->givePermissionTo($perm);
                    }
                }
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('personal_access_tokens')) {
            Schema::table('personal_access_tokens', function (Blueprint $table) {
                $cols = [];
                foreach (['ip_address', 'user_agent', 'device_name', 'browser', 'platform'] as $col) {
                    if (Schema::hasColumn('personal_access_tokens', $col)) {
                        $cols[] = $col;
                    }
                }
                if (!empty($cols)) {
                    $table->dropColumn($cols);
                }
            });
        }
    }
};
