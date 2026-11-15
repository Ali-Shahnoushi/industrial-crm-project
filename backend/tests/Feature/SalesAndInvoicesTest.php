<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Part;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SalesAndInvoicesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $salesOne;
    private User $salesTwo;
    private Part $part;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_ADMINISTRATOR] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->admin = User::create([
            'name' => 'مدیر ارشد فروش',
            'email' => 'sales-admin@example.test',
            'password' => Hash::make('AdminPass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_ADMINISTRATOR,
            'customer_scope' => User::SCOPE_ALL,
        ]);
        $this->admin->syncPermissions(Permission::all());

        $this->salesOne = User::create([
            'name' => 'کارشناس فروش یک',
            'email' => 'sales1@example.test',
            'password' => Hash::make('SalesPass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
        ]);
        $this->salesOne->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON]);

        $this->salesTwo = User::create([
            'name' => 'کارشناس فروش دو',
            'email' => 'sales2@example.test',
            'password' => Hash::make('SalesPass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
        ]);
        $this->salesTwo->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON]);

        $this->part = Part::create([
            'name' => 'اینورتر صنعتی ۲۰ کیلووات',
            'code' => 'INV-20KW-TEST',
            'periodic_service_months' => 12,
            'stock_quantity' => 10,
            'min_stock' => 2,
            'unit' => 'دستگاه',
            'unit_price' => 100000000,
            'is_active' => true,
        ]);
    }

    public function test_assigning_part_auto_creates_sale_and_insufficient_stock_rolls_back(): void
    {
        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت تست صنعت',
            'mobile' => '09121110011',
            'created_by_user_id' => $this->salesOne->id,
        ]);

        // Insufficient stock (11 > 10) must fail and create zero sales
        $this->actingAs($this->salesOne, 'sanctum')
            ->postJson("/api/v1/customers/{$customer->id}/parts", [
                'part_id' => $this->part->id,
                'quantity' => 11,
            ])
            ->assertUnprocessable();

        $this->assertSame(0, Sale::count());
        $this->assertSame(10, $this->part->fresh()->stock_quantity);

        // Assign 2 units with discount and 10% tax
        $res = $this->actingAs($this->salesOne, 'sanctum')
            ->postJson("/api/v1/customers/{$customer->id}/parts", [
                'part_id' => $this->part->id,
                'quantity' => 2,
                'unit_price' => '۱۰۰,۰۰۰,۰۰۰',
                'discount_amount' => '۱۰,۰۰۰,۰۰۰',
                'tax_percent' => 10,
                'payment_status' => 'partial',
                'paid_amount' => '۵۰,۰۰۰,۰۰۰',
                'installation_date' => '2026-11-10',
            ])
            ->assertCreated();

        $saleId = $res->json('sale.id');
        $this->assertNotNull($saleId);

        $sale = Sale::findOrFail($saleId);
        // subtotal = 2 * 100M = 200M; discount = 10M; taxable = 190M; tax 10% = 19M; total = 209M
        $this->assertSame(200000000, $sale->subtotal);
        $this->assertSame(10000000, $sale->discount_amount);
        $this->assertSame(19000000, $sale->tax_amount);
        $this->assertSame(209000000, $sale->total);
        $this->assertSame(50000000, $sale->paid_amount);
        $this->assertSame('partial', $sale->payment_status);
        $this->assertSame(8, $this->part->fresh()->stock_quantity);
    }

    public function test_updating_sale_recalculates_totals_and_cancelled_sale_is_excluded_from_kpis(): void
    {
        $c1 = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'علی',
            'last_name' => 'رضایی',
            'mobile' => '09121112233',
            'created_by_user_id' => $this->admin->id,
        ]);

        $saleRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/sales', [
                'customer_id' => $c1->id,
                'part_id' => $this->part->id,
                'quantity' => 1,
                'unit_price' => 100000000,
                'discount_amount' => 0,
                'tax_percent' => 10,
                'sale_date' => now()->toDateString(),
                'payment_status' => 'unpaid',
            ])
            ->assertCreated();

        $saleId = $saleRes->json('sale.id');

        // Edit price, discount, tax, and payment status
        $updateRes = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/v1/sales/{$saleId}", [
                'unit_price' => 120000000,
                'discount_amount' => 20000000,
                'tax_percent' => 9,
                'payment_status' => 'paid',
            ])
            ->assertOk();

        // (120M - 20M) * 1.09 = 109M
        $this->assertSame(109000000, $updateRes->json('sale.total'));
        $this->assertSame(109000000, $updateRes->json('sale.paid_amount'));
        $this->assertSame('paid', $updateRes->json('sale.payment_status'));

        // Verify KPI includes it
        $summaryBefore = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/sales/summary')
            ->assertOk();
        $this->assertSame(1, $summaryBefore->json('sales_count'));
        $this->assertSame(109000000, $summaryBefore->json('total_revenue'));

        // Cancel sale -> excluded from KPIs & charts
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/v1/sales/{$saleId}")
            ->assertOk();

        $summaryAfter = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/sales/summary')
            ->assertOk();
        $this->assertSame(0, $summaryAfter->json('sales_count'));
        $this->assertSame(0, $summaryAfter->json('total_revenue'));
    }

    public function test_restricted_salesperson_sees_only_own_sales_and_cannot_access_colleague_sale(): void
    {
        $c1 = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'مشتری',
            'last_name' => 'یک',
            'mobile' => '09123330001',
            'created_by_user_id' => $this->salesOne->id,
        ]);
        $c2 = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'مشتری',
            'last_name' => 'دو',
            'mobile' => '09123330002',
            'created_by_user_id' => $this->salesTwo->id,
        ]);

        $s1 = $this->actingAs($this->salesOne, 'sanctum')->postJson('/api/v1/sales', [
            'customer_id' => $c1->id,
            'part_id' => $this->part->id,
            'quantity' => 1,
            'unit_price' => 50000000,
            'tax_percent' => 0,
        ])->assertCreated()->json('sale.id');

        $s2 = $this->actingAs($this->salesTwo, 'sanctum')->postJson('/api/v1/sales', [
            'customer_id' => $c2->id,
            'part_id' => $this->part->id,
            'quantity' => 1,
            'unit_price' => 80000000,
            'tax_percent' => 0,
        ])->assertCreated()->json('sale.id');

        $listOne = $this->actingAs($this->salesOne, 'sanctum')->getJson('/api/v1/sales')->assertOk();
        $this->assertCount(1, $listOne->json('data'));
        $this->assertSame($s1, $listOne->json('data.0.id'));

        $this->actingAs($this->salesOne, 'sanctum')
            ->getJson("/api/v1/sales/{$s2}")
            ->assertForbidden();
    }

    public function test_invoice_sequence_void_reissue_and_excel_export(): void
    {
        $c = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'کارخانه نمونه',
            'mobile' => '09125550000',
            'created_by_user_id' => $this->admin->id,
        ]);

        $sale1Id = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/sales', [
            'customer_id' => $c->id,
            'part_id' => $this->part->id,
            'quantity' => 1,
            'unit_price' => 60000000,
            'sale_date' => '2026-11-10',
        ])->assertCreated()->json('sale.id');

        $inv1 = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/sales/{$sale1Id}/invoice")
            ->assertCreated()
            ->json('invoice');

        $this->assertMatchesRegularExpression('/^INV-\d{4}-0001$/', $inv1['number']);

        // Duplicate active invoice blocked
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/sales/{$sale1Id}/invoice")
            ->assertUnprocessable();

        // Void then re-issue increments sequence to 0002
        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/v1/invoices/{$inv1['id']}/void")
            ->assertOk();

        $inv2 = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/v1/sales/{$sale1Id}/invoice")
            ->assertCreated()
            ->json('invoice');

        $this->assertMatchesRegularExpression('/^INV-\d{4}-0002$/', $inv2['number']);

        // Excel export with date filter returns 200 xlsx
        $exportRes = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/v1/sales/export?from=2026-11-01&to=2026-11-30');
        $exportRes->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            (string) $exportRes->headers->get('content-type')
        );
    }

    public function test_backfill_migration_is_idempotent(): void
    {
        $c = Customer::create([
            'customer_type' => 'effective',
            'type' => 'individual',
            'first_name' => 'تست',
            'last_name' => 'بک‌فیل',
            'mobile' => '09127770000',
            'created_by_user_id' => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/customers/{$c->id}/parts", [
            'part_id' => $this->part->id,
            'quantity' => 1,
            'invoice_amount' => 45000000,
        ])->assertCreated();

        $beforeSales = Sale::count();
        $beforeItems = SaleItem::count();

        $migration = require database_path('migrations/2026_11_13_000020_add_sales_permissions_and_backfill.php');
        $migration->up();

        $this->assertSame($beforeSales, Sale::count());
        $this->assertSame($beforeItems, SaleItem::count());
    }
}
