<?php

namespace Tests\Feature;

use App\Imports\CustomersImport;
use App\Models\Customer;
use App\Models\Part;
use App\Models\SmsLog;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrivilegeEscalationAndIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_manager_with_users_manage_cannot_create_admin_or_edit_another_manager(): void
    {
        $managerA = User::create([
            'name' => 'Manager A',
            'email' => 'manager-a@crm.local',
            'password' => Hash::make('Pass12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);
        $managerA->givePermissionTo('users.manage');

        $managerB = User::create([
            'name' => 'Manager B',
            'email' => 'manager-b@crm.local',
            'password' => Hash::make('Pass12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);

        Sanctum::actingAs($managerA);

        // Cannot create an administrator
        $this->postJson('/api/v1/users', [
            'name' => 'Fake Admin',
            'email' => 'fake-admin@crm.local',
            'password' => 'Pass12345',
            'user_type' => User::ROLE_ADMINISTRATOR,
        ])->assertStatus(403);

        // Cannot edit or reset another manager's password
        $this->putJson("/api/v1/users/{$managerB->id}", [
            'name' => 'Manager B',
            'email' => $managerB->email,
            'password' => 'HackedPass99',
        ])->assertStatus(403);
    }

    public function test_deleting_staff_reassigns_their_customers_to_acting_admin(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $sales = User::create([
            'name' => 'Departing Sales',
            'email' => 'departing@crm.local',
            'password' => Hash::make('Pass12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);

        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت مشتری انتقالی',
            'created_by_user_id' => $sales->id,
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/users/{$sales->id}")->assertOk();

        $this->assertSame($admin->id, (int) $customer->fresh()->created_by_user_id);
    }

    public function test_deleting_customer_restores_warehouse_stock_or_blocks_if_service_history_exists(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $partRes = $this->postJson('/api/v1/parts', [
            'name' => 'کمپرسور تست حذف مشتری',
            'code' => 'CMP-DEL-01',
            'periodic_service_months' => 12,
            'stock_quantity' => 5,
        ])->assertCreated();
        $partId = $partRes->json('part.id');

        $c1 = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'مشتری بدون سابقه سرویس',
            'created_by_user_id' => $admin->id,
        ]);

        $this->postJson("/api/v1/customers/{$c1->id}/parts", [
            'part_id' => $partId,
            'serial_number' => 'SN-DEL-RESTORE-1',
            'quantity' => 2,
        ])->assertCreated();

        $this->assertSame(3, (int) Part::findOrFail($partId)->stock_quantity);

        // Deleting customer without service history restores the 2 devices back to stock!
        $this->deleteJson("/api/v1/customers/{$c1->id}")->assertOk();
        $this->assertSame(5, (int) Part::findOrFail($partId)->stock_quantity);

        // Now create customer WITH recorded service history -> deleting assignment or customer must be blocked (422)
        $c2 = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'مشتری دارای سابقه تعمیر',
            'created_by_user_id' => $admin->id,
        ]);

        $assignRes = $this->postJson("/api/v1/customers/{$c2->id}/parts", [
            'part_id' => $partId,
            'serial_number' => 'SN-HAS-SERVICE-1',
            'quantity' => 1,
        ])->assertCreated();
        $cpId = $assignRes->json('customer_part.id');

        $this->postJson("/api/v1/customer-parts/{$cpId}/history", [
            'service_date' => '2026-11-09',
            'service_type' => 'repair',
            'description' => 'تعویض برد الکترونیکی',
            'cost' => 2500000,
        ])->assertCreated();

        $this->deleteJson("/api/v1/customer-parts/{$cpId}")->assertStatus(422);
        $this->deleteJson("/api/v1/customers/{$c2->id}")->assertStatus(422);
    }

    public function test_part_with_inventory_logs_cannot_be_deleted_and_inactive_part_cannot_be_assigned(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $partRes = $this->postJson('/api/v1/parts', [
            'name' => 'دستگاه دارای گردش انبار',
            'code' => 'DEV-LOG-GUARD',
            'periodic_service_months' => 12,
            'stock_quantity' => 4,
            'is_active' => false,
        ])->assertCreated();
        $partId = $partRes->json('part.id');

        // Has initial stock-in log -> must block deletion (422)
        $this->deleteJson("/api/v1/parts/{$partId}")->assertStatus(422);

        // Inactive part -> must block assignment (422)
        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت تست غیرفعال',
            'created_by_user_id' => $admin->id,
        ]);

        $this->postJson("/api/v1/customers/{$customer->id}/parts", [
            'part_id' => $partId,
            'serial_number' => 'SN-INACTIVE-01',
            'quantity' => 1,
        ])->assertStatus(422);
    }

    public function test_direct_sms_scope_guard_sms_logs_privacy_formula_injection_and_strict_import(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $salesA = User::create([
            'name' => 'Sales A',
            'email' => 'sales-a-sec@crm.local',
            'password' => Hash::make('Pass12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);
        $salesA->syncPermissions(['customers.view', 'customers.import', 'customers.export', 'sms.send']);

        $adminCustomer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت محرمانه مدیر',
            'mobile' => '09128887766',
            'created_by_user_id' => $admin->id,
        ]);

        $ownCustomer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => '=CMD|\' /C calc\'!A0',
            'mobile' => '09126665544',
            'created_by_user_id' => $salesA->id,
        ]);

        SmsLog::create([
            'customer_id' => $ownCustomer->id,
            'recipient_mobile' => '09126665544',
            'pattern_code' => '100',
            'tokens' => ['a'],
            'status' => 'sent',
        ]);

        Sanctum::actingAs($salesA);

        // 1. Direct SMS without customer_id to out-of-scope customer's mobile -> 403
        $this->postJson('/api/v1/sms/send-pattern', [
            'mobile' => '09128887766',
            'pattern_code' => '1001',
            'tokens' => ['تست'],
        ])->assertStatus(403);

        // 2. Customer show hides sms_logs when user lacks sms.logs permission
        $showRes = $this->getJson("/api/v1/customers/{$ownCustomer->id}")->assertOk();
        $this->assertArrayNotHasKey('sms_logs', $showRes->json());

        // 3. CSV export neutralizes formula injection (=CMD...)
        $csvRes = $this->get('/api/v1/customers/export?format=csv')->assertOk();
        $this->assertStringContainsString("'=CMD", $csvRes->streamedContent());

        // 4. Import without customers.edit permission cannot overwrite existing customer, and invalid email/national_code rejected
        $import = new CustomersImport($salesA);
        $import->model(['nam_shrkt' => 'نام تغییریافته غیرمجاز', 'shmarh_hmrah' => '09126665544']);
        $this->assertSame("=CMD|' /C calc'!A0", $ownCustomer->fresh()->company_name);

        $import->model(['nam_shrkt' => 'شرکت ایمیل خراب', 'aymyl' => 'not-an-email', 'shmarh_hmrah' => '09124443322']);
        $this->assertDatabaseMissing('customers', ['company_name' => 'شرکت ایمیل خراب']);
        $this->assertGreaterThanOrEqual(2, count($import->getErrors()));

        // 5. Exact-header matching: 'نام' must NEVER greedily match 'نام_خانوادگی' even when 'نام_خانوادگی' comes first!
        $createdRow = $import->model([
            'نام_خانوادگی' => 'کاظمی',
            'نام' => 'بهرام',
            'شماره_همراه' => '09121239876',
        ]);
        $this->assertNotNull($createdRow);
        $this->assertSame('بهرام', $createdRow->first_name);
        $this->assertSame('کاظمی', $createdRow->last_name);

        // 6. Unauthenticated request to /api/v1/customers/template must be rejected with 401
        \Illuminate\Support\Facades\Auth::forgetGuards();
        $this->getJson('/api/v1/customers/template')->assertStatus(401);
    }
}
