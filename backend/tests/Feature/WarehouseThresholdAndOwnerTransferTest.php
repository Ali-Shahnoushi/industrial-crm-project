<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Part;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WarehouseThresholdAndOwnerTransferTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_min_stock_threshold_inventory_summary_and_zero_stock_reconciliation(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        Sanctum::actingAs($admin);

        // Create device with min_stock = 5 and stock_quantity = 3 (immediately in low-stock state)
        $partRes = $this->postJson('/api/v1/parts', [
            'name' => 'سنسور فشار هیدرولیک ۴۰۰ بار',
            'code' => 'SENS-HYD-400',
            'unit' => 'عدد',
            'min_stock' => '۵',
            'periodic_service_months' => 12,
            'stock_quantity' => '۳',
        ])->assertCreated();

        $partId = $partRes->json('part.id');
        $this->assertSame(5, (int) $partRes->json('part.min_stock'));
        $this->assertSame('عدد', $partRes->json('part.unit'));

        // Inventory summary must report this device in low_stock_parts
        $summary = $this->getJson('/api/v1/inventory/summary')->assertOk();
        $lowCodes = collect($summary->json('low_stock_parts'))->pluck('code')->all();
        $this->assertContains('SENS-HYD-400', $lowCodes);

        // Stocktaking reconciliation (type = adjustment) to 0 must succeed and log delta
        $this->postJson("/api/v1/parts/{$partId}/stock", [
            'type' => 'adjustment',
            'quantity' => 0,
            'description' => 'انبارگردانی پایان دوره و صفر کردن موجودی',
        ])->assertCreated()
            ->assertJsonPath('part.stock_quantity', 0);

        $this->assertSame(0, (int) Part::findOrFail($partId)->stock_quantity);
    }

    public function test_custom_warranty_expire_date_is_respected_on_assignment(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        Sanctum::actingAs($admin);

        $part = Part::firstOrFail();
        if ((int) $part->stock_quantity < 1) {
            $part->update(['stock_quantity' => 5]);
        }

        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت گارانتی سفارشی',
            'created_by_user_id' => $admin->id,
        ]);

        $res = $this->postJson("/api/v1/customers/{$customer->id}/parts", [
            'part_id' => $part->id,
            'serial_number' => 'SN-CUSTOM-WARR-1',
            'quantity' => 1,
            'installation_date' => '2026-11-09',
            'warranty_expire_date' => '2029-11-09',
        ])->assertCreated();

        $this->assertStringStartsWith('2029-11-09', (string) $res->json('customer_part.warranty_expire_date'));
    }

    public function test_admin_can_transfer_customer_ownership_and_log_history(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $sales = User::create([
            'name' => 'کارشناس جدید پرونده',
            'email' => 'new-owner@crm.local',
            'password' => Hash::make('Pass12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);
        $sales->givePermissionTo('customers.view');

        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'پرونده انتقالی به کارشناس فروش',
            'created_by_user_id' => $admin->id,
        ]);

        // Before transfer, sales cannot see admin's customer
        Sanctum::actingAs($sales);
        $this->getJson("/api/v1/customers/{$customer->id}")->assertStatus(403);

        // Admin transfers ownership to sales
        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/customers/{$customer->id}/owner", [
            'created_by_user_id' => $sales->id,
        ])->assertOk()
            ->assertJsonPath('customer.created_by_user_id', $sales->id);

        $this->assertDatabaseHas('customer_histories', [
            'customer_id' => $customer->id,
            'action' => 'owner_changed',
        ]);

        // Now sales owns and can view the customer!
        Sanctum::actingAs($sales);
        $this->getJson("/api/v1/customers/{$customer->id}")->assertOk();
    }

    public function test_rich_multi_role_seeder_fixtures_exist_in_non_production(): void
    {
        $this->assertDatabaseHas('users', ['email' => 'admin@crm.local', 'user_type' => User::ROLE_ADMINISTRATOR]);
        $this->assertDatabaseHas('users', ['email' => 'demo.manager@crm.local', 'user_type' => User::ROLE_MANAGER]);
        $this->assertDatabaseHas('users', ['email' => 'demo.sales@crm.local', 'user_type' => User::ROLE_SALESPERSON]);
        $this->assertDatabaseHas('users', ['email' => 'demo.installer@crm.local', 'user_type' => User::ROLE_INSTALLER]);
        $this->assertGreaterThanOrEqual(4, Part::count());
    }
}
