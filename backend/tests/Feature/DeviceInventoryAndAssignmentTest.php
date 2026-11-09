<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Part;
use App\Models\PartInventoryLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class DeviceInventoryAndAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_ADMINISTRATOR] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->admin = User::create([
            'name' => 'مدیر تست انبار',
            'email' => 'warehouse-admin@example.test',
            'password' => Hash::make('AdminPass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_ADMINISTRATOR,
            'customer_scope' => User::SCOPE_ALL,
        ]);
        $this->admin->syncPermissions(Permission::all());
    }

    public function test_full_device_warehouse_lifecycle_stock_assign_edit_and_delete(): void
    {
        // 1. Create device with initial stock in Persian digits ('۱۰' -> 10)
        $createRes = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/parts', [
            'name' => 'پمپ هیدرولیک صنعتی ۲۰۰ بار',
            'code' => 'HYD-PUMP-200',
            'periodic_service_months' => '۱۲',
            'stock_quantity' => '۱۰',
            'is_active' => true,
        ]);
        $createRes->assertCreated();
        $partId = $createRes->json('part.id');
        $this->assertSame(10, Part::findOrFail($partId)->stock_quantity);

        // 2. Manual stock-in (+5 -> 15) and manual stock-out (-3 -> 12)
        $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/parts/{$partId}/stock", [
            'type' => PartInventoryLog::TYPE_IN,
            'quantity' => '۵',
            'description' => 'ورود محموله جدید',
        ])->assertCreated();
        $this->assertSame(15, Part::findOrFail($partId)->stock_quantity);

        $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/parts/{$partId}/stock", [
            'type' => PartInventoryLog::TYPE_OUT_MANUAL,
            'quantity' => 3,
            'description' => 'خروج نمونه آزمایشگاهی',
        ])->assertCreated();
        $this->assertSame(12, Part::findOrFail($partId)->stock_quantity);

        // Over-withdrawal must fail with 422 and preserve stock = 12
        $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/parts/{$partId}/stock", [
            'type' => PartInventoryLog::TYPE_OUT_MANUAL,
            'quantity' => 50,
        ])->assertStatus(422);
        $this->assertSame(12, Part::findOrFail($partId)->stock_quantity);

        // 3. Assign 4 units to a potential customer -> stock becomes 8, customer becomes effective
        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'گروه صنعتی پارس',
            'created_by_user_id' => $this->admin->id,
        ]);

        $assignRes = $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/customers/{$customer->id}/parts", [
            'part_id' => $partId,
            'serial_number' => 'SN-HYD-1001',
            'quantity' => '۴',
            'invoice_amount' => '۱۲۵,۰۰۰,۰۰۰',
            'invoice_number' => 'INV-۱۴۰۵-۰۱',
            'installation_date' => '2026-11-09',
        ]);
        $assignRes->assertCreated();
        $cpId = $assignRes->json('customer_part.id');

        $this->assertSame(8, Part::findOrFail($partId)->stock_quantity);
        $this->assertSame('effective', $customer->fresh()->customer_type);
        $this->assertSame('INV-1405-01', $assignRes->json('customer_part.invoice_number'));
        $this->assertEquals(125000000, (float) $assignRes->json('customer_part.invoice_amount'));

        // 4. Edit assignment: increase quantity 4 -> 6 (deducts 2 more -> stock = 6)
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/customer-parts/{$cpId}", [
            'quantity' => 6,
            'invoice_amount' => 180000000,
        ])->assertOk();
        $this->assertSame(6, Part::findOrFail($partId)->stock_quantity);

        // Edit assignment: decrease quantity 6 -> 2 (returns 4 -> stock = 10)
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/customer-parts/{$cpId}", [
            'quantity' => 2,
        ])->assertOk();
        $this->assertSame(10, Part::findOrFail($partId)->stock_quantity);

        // 5. Delete assignment: returns remaining 2 -> stock = 12
        $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/v1/customer-parts/{$cpId}")
            ->assertOk();
        $this->assertSame(12, Part::findOrFail($partId)->stock_quantity);

        // Verify inventory logs endpoint returns exact balance trail
        $logsRes = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/inventory-logs?part_id={$partId}");
        $logsRes->assertOk();
        $this->assertGreaterThanOrEqual(6, count($logsRes->json('data')));
        $this->assertSame(12, $logsRes->json('data.0.balance_after'));
    }
}
