<?php

namespace Tests\Feature;

use App\Exports\CustomerDevicesDetailSheet;
use App\Imports\CustomersImport;
use App\Models\Customer;
use App\Models\Part;
use App\Models\User;
use App\Services\Customers\CustomerService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CustomerValidationAndExportTest extends TestCase
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
            'name' => 'مدیر تست مشتریان',
            'email' => 'cust-admin@example.test',
            'password' => Hash::make('AdminPass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_ADMINISTRATOR,
            'customer_scope' => User::SCOPE_ALL,
        ]);
        $this->admin->syncPermissions(Permission::all());
    }

    public function test_individual_vs_company_conditional_validation_and_optional_persian_mobile(): void
    {
        // Legal (company) customer WITHOUT first_name, last_name, or mobile must succeed!
        $legalRes = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/customers', [
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت ماشین‌سازی اراک',
            'national_code' => '۱۰۱۰۳۴۵۶۷۸۹',
            'phone' => '۰۲۱۸۸۷۷۶۶۵۵',
        ]);
        $legalRes->assertCreated();
        $this->assertSame('10103456789', $legalRes->json('customer.national_code'));
        $this->assertSame('02188776655', $legalRes->json('customer.phone'));
        $this->assertNull($legalRes->json('customer.mobile'));

        // Legal customer missing company_name must fail 422
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/customers', [
            'customer_type' => 'potential',
            'type' => 'company',
            'first_name' => 'امیر',
            'last_name' => 'کریمی',
        ])->assertStatus(422)->assertJsonValidationErrors(['company_name']);

        // Individual customer WITHOUT mobile must succeed, and WITH Persian mobile normalizes cleanly
        $indNoMobile = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/customers', [
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'مهدی',
            'last_name' => 'احمدی',
        ]);
        $indNoMobile->assertCreated();

        $indPersianMobile = $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/customers', [
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'نگار',
            'last_name' => 'علوی',
            'mobile' => '۰۹۱۲۳۴۵۶۷۸۹',
        ]);
        $indPersianMobile->assertCreated();
        $this->assertSame('09123456789', $indPersianMobile->json('customer.mobile'));

        // Individual customer missing last_name must fail 422
        $this->actingAs($this->admin, 'sanctum')->postJson('/api/v1/customers', [
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'فقط‌نام',
        ])->assertStatus(422)->assertJsonValidationErrors(['last_name']);
    }

    public function test_csv_and_device_detail_exports_use_utf8_bom_and_jalali_dates(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 11, 9, 10, 15, 0, 'UTC'));

        $customer = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'فولاد مبارکه تست',
            'mobile' => '09131112233',
            'created_by_user_id' => $this->admin->id,
        ]);

        $part = Part::create([
            'name' => 'دستگاه برش لیزر صنعتی',
            'code' => 'LASER-CNC-01',
            'periodic_service_months' => 12,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);

        app(CustomerService::class)->assignPart(
            $customer,
            $part,
            'SN-LASER-001',
            [
                'quantity' => 2,
                'invoice_amount' => 500000000,
                'invoice_number' => 'INV-900',
                'installation_date' => '2026-11-09',
            ],
            $this->admin->id
        );

        $csvRes = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/v1/customers/export?format=csv');

        $csvRes->assertOk();
        $content = $csvRes->streamedContent();

        // Must begin with UTF-8 BOM
        $this->assertTrue(str_starts_with($content, "\xEF\xBB\xBF"));
        // Must contain Persian company name, device name, and Jalali date 1405/08/18 (not 2026/11/09)
        $this->assertStringContainsString('فولاد مبارکه تست', $content);
        $this->assertStringContainsString('دستگاه برش لیزر صنعتی', $content);
        $this->assertStringContainsString('1405/08/18', $content);
        $this->assertStringNotContainsString('2026/11/09', $content);

        // Detail sheet must also format installation_date and warranty_expire_date in Jalali
        $loadedCustomer = Customer::with('customerParts.part')->findOrFail($customer->id);
        $detailSheet = new CustomerDevicesDetailSheet(collect([$loadedCustomer]));
        $firstDetailRow = $detailSheet->map($detailSheet->collection()->first());

        $this->assertContains('1405/08/18', $firstDetailRow);
        $this->assertContains('1406/08/18', $firstDetailRow);

        Carbon::setTestNow();
    }

    public function test_excel_import_blocks_restricted_salesperson_from_overwriting_colleague_customer(): void
    {
        $owner = User::create([
            'name' => 'کارمند اول',
            'email' => 'owner@example.test',
            'password' => Hash::make('Pass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
        ]);

        $otherSales = User::create([
            'name' => 'کارمند دوم',
            'email' => 'other@example.test',
            'password' => Hash::make('Pass1234'),
            'is_active' => true,
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
        ]);

        $protectedCustomer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'شرکت اصلی اول',
            'mobile' => '09129998877',
            'created_by_user_id' => $owner->id,
        ]);

        $importer = new CustomersImport($otherSales);
        $result = $importer->model([
            'noe_mshtry' => 'بالقوه',
            'noe_shkhs' => 'حقوقی',
            'nam_shrkt' => 'تلاش برای تغییر نام شرکت',
            'shmarh_hmrah' => '۰۹۱۲۹۹۹۸۸۷۷',
        ]);

        $this->assertNull($result);
        $this->assertSame(0, $importer->getImportedCount());
        $this->assertNotEmpty($importer->getErrors());
        $this->assertSame('شرکت اصلی اول', $protectedCustomer->fresh()->company_name);
    }
}
