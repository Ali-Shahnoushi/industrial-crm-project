<?php

use App\Models\Setting;
use App\Models\User;
use App\Support\JalaliDate;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Seed new Sales ACL permissions and assign to existing roles/users idempotently
        if (Schema::hasTable('permissions')) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            $salesPermissions = ['sales.view', 'sales.create', 'sales.manage'];
            $permModels = [];
            foreach ($salesPermissions as $permName) {
                $permModels[$permName] = Permission::firstOrCreate([
                    'name' => $permName,
                    'guard_name' => 'web',
                ]);
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();

            if (Schema::hasTable('roles')) {
                foreach ([User::ROLE_ADMINISTRATOR, User::ROLE_MANAGER, 'super_admin'] as $roleName) {
                    $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
                    if ($role) {
                        $role->givePermissionTo(array_values($permModels));
                    }
                }
                $salesRole = Role::where('name', User::ROLE_SALESPERSON)->where('guard_name', 'web')->first();
                if ($salesRole) {
                    $salesRole->givePermissionTo([$permModels['sales.view'], $permModels['sales.create']]);
                }
            }

            if (Schema::hasTable('users')) {
                $allPermissions = Permission::where('guard_name', 'web')->get();
                $admins = User::where('user_type', User::ROLE_ADMINISTRATOR)
                    ->orWhere('email', 'admin@crm.local')
                    ->get();
                foreach ($admins as $admin) {
                    $admin->syncPermissions($allPermissions);
                }

                $managers = User::where('user_type', User::ROLE_MANAGER)->get();
                foreach ($managers as $manager) {
                    $manager->givePermissionTo(array_values($permModels));
                }

                $salespeople = User::where('user_type', User::ROLE_SALESPERSON)->get();
                foreach ($salespeople as $sp) {
                    $sp->givePermissionTo([$permModels['sales.view'], $permModels['sales.create']]);
                }
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        // 2. Default sales settings
        if (Schema::hasTable('settings')) {
            if (Setting::get('sales_default_tax_percent') === null) {
                Setting::set('sales_default_tax_percent', '10');
            }
        }

        // 3. Backfill existing customer_parts records into sales, sale_items, and invoices (idempotent)
        if (
            Schema::hasTable('customer_parts')
            && Schema::hasTable('sales')
            && Schema::hasTable('sale_items')
        ) {
            $existingCpIds = DB::table('sale_items')
                ->whereNotNull('customer_part_id')
                ->pluck('customer_part_id')
                ->flip()
                ->all();

            $fallbackSellerId = DB::table('users')
                ->where('user_type', User::ROLE_ADMINISTRATOR)
                ->orderBy('id')
                ->value('id');

            $customerParts = DB::table('customer_parts')
                ->join('customers', 'customer_parts.customer_id', '=', 'customers.id')
                ->select(
                    'customer_parts.*',
                    'customers.created_by_user_id as customer_owner_id'
                )
                ->orderBy('customer_parts.id')
                ->get();

            foreach ($customerParts as $cp) {
                if (isset($existingCpIds[$cp->id])) {
                    continue;
                }

                $qty = max(1, (int) ($cp->quantity ?? 1));
                $amount = (int) round((float) ($cp->invoice_amount ?? 0));
                $unitPrice = $qty > 0 ? (int) round($amount / $qty) : 0;
                $lineTotal = $amount;

                $saleDate = $cp->installation_date
                    ? Carbon::parse($cp->installation_date)->toDateString()
                    : ($cp->created_at ? Carbon::parse($cp->created_at)->toDateString() : now()->toDateString());

                $sellerId = $cp->customer_owner_id ?: $fallbackSellerId;
                $isPaid = $lineTotal > 0 && !empty($cp->invoice_number);

                $saleId = DB::table('sales')->insertGetId([
                    'customer_id' => $cp->customer_id,
                    'user_id' => $sellerId,
                    'sale_date' => $saleDate,
                    'status' => 'confirmed',
                    'payment_status' => $isPaid ? 'paid' : 'unpaid',
                    'subtotal' => $lineTotal,
                    'discount_amount' => 0,
                    'tax_percent' => 0,
                    'tax_amount' => 0,
                    'total' => $lineTotal,
                    'paid_amount' => $isPaid ? $lineTotal : 0,
                    'notes' => $cp->notes,
                    'created_at' => $cp->created_at ?? now(),
                    'updated_at' => $cp->updated_at ?? now(),
                ]);

                DB::table('sale_items')->insert([
                    'sale_id' => $saleId,
                    'part_id' => $cp->part_id,
                    'customer_part_id' => $cp->id,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'discount_amount' => 0,
                    'line_total' => $lineTotal,
                    'created_at' => $cp->created_at ?? now(),
                    'updated_at' => $cp->updated_at ?? now(),
                ]);

                if (!empty($cp->invoice_number) && Schema::hasTable('invoices')) {
                    $invNumber = trim((string) $cp->invoice_number);
                    $alreadyExists = DB::table('invoices')->where('number', $invNumber)->exists();
                    if (!$alreadyExists) {
                        [$jy] = JalaliDate::gregorianToJalali(
                            (int) Carbon::parse($saleDate)->year,
                            (int) Carbon::parse($saleDate)->month,
                            (int) Carbon::parse($saleDate)->day
                        );
                        if (preg_match('/(\d{4})[^\d]+(\d+)$/', $invNumber, $m)) {
                            $jy = (int) $m[1];
                            $seq = (int) $m[2];
                        } else {
                            $maxSeq = (int) (DB::table('invoices')->where('jalali_year', $jy)->max('sequence_number') ?? 0);
                            $seq = $maxSeq + 1;
                        }

                        DB::table('invoices')->insert([
                            'sale_id' => $saleId,
                            'number' => $invNumber,
                            'jalali_year' => $jy,
                            'sequence_number' => $seq,
                            'issued_at' => $saleDate,
                            'status' => $isPaid ? 'paid' : 'issued',
                            'created_by_user_id' => $sellerId,
                            'created_at' => $cp->created_at ?? now(),
                            'updated_at' => $cp->updated_at ?? now(),
                        ]);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        // Non-destructive down for permissions/backfill
    }
};
