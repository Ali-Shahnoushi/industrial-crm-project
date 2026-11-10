<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerPortalIsolationAndRepairTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_customer_portal_full_lifecycle_sales_contacts_device_repair_and_strict_isolation(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $salesManager = User::create([
            'name' => 'مهندس رادمان (مدیر فروش)',
            'email' => 'sales.mgr@crm.local',
            'phone' => '09121002001',
            'password' => Hash::make('Manager@12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);
        $salesManager->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_MANAGER]);

        $salesRep = User::create([
            'name' => 'خانم سارا محمدی (مسئول فروش)',
            'email' => 'sales.rep@crm.local',
            'phone' => '09121002002',
            'password' => Hash::make('Sales@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);
        $salesRep->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON]);

        $repairAgent = User::create([
            'name' => 'مهندس نوید تهرانی (تعمیرات)',
            'email' => 'repair.agent@crm.local',
            'phone' => '09121002003',
            'password' => Hash::make('Repair@12345'),
            'user_type' => User::ROLE_INSTALLER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);
        $repairAgent->syncPermissions(['customers.view', 'parts.view', 'tickets.view', 'tickets.reply']);

        // Configure repair department
        $repairDept = TicketDepartment::updateOrCreate(
            ['name' => 'پشتیبانی فنی و تعمیرات دستگاه‌ها'],
            [
                'description' => 'ثبت خرابی و تعمیرات تخصصی',
                'assignment_strategy' => 'least_loaded',
                'is_default_repair' => true,
                'is_active' => true,
            ]
        );
        $repairDept->agents()->sync([$repairAgent->id]);

        // Create two customers: Customer A (our portal user) and Customer B (another customer whose data must be unreachable)
        $customerA = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'مجتمع صنعتی بهاران',
            'first_name' => 'امیر',
            'last_name' => 'بهارلو',
            'mobile' => '09129008001',
            'email' => 'portal.baharan@example.com',
            'created_by_user_id' => $salesRep->id,
            'sales_manager_user_id' => $salesManager->id,
        ]);

        $customerB = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'شرکت رقیب دیگر',
            'mobile' => '09129008002',
            'created_by_user_id' => $admin->id,
        ]);

        $part = Part::create([
            'name' => 'اینورتر صنعتی زیمنس ۵۰ کیلووات',
            'code' => 'INV-SIEMENS-50KW',
            'periodic_service_months' => 6,
            'stock_quantity' => 10,
            'min_stock' => 2,
            'unit' => 'دستگاه',
            'is_active' => true,
        ]);

        $deviceA = CustomerPart::create([
            'customer_id' => $customerA->id,
            'part_id' => $part->id,
            'serial_number' => 'SN-BAHARAN-001',
            'quantity' => 1,
            'installation_date' => '2026-06-01',
            'warranty_expire_date' => '2027-06-01',
            'status' => 'active',
        ]);

        $deviceB = CustomerPart::create([
            'customer_id' => $customerB->id,
            'part_id' => $part->id,
            'serial_number' => 'SN-OTHER-999',
            'quantity' => 1,
            'installation_date' => '2026-06-01',
            'warranty_expire_date' => '2027-06-01',
            'status' => 'active',
        ]);

        // Admin enables Customer Portal access for Customer A
        Sanctum::actingAs($admin);
        $portalSetupRes = $this->postJson("/api/v1/customers/{$customerA->id}/portal-access", [
            'portal_enabled' => true,
            'password' => 'CustPortal123',
            'sales_manager_user_id' => $salesManager->id,
        ])->assertOk();

        $this->assertTrue((bool) $portalSetupRes->json('customer.portal_enabled'));

        // Customer A logs in via standard /api/v1/auth/login using mobile + password
        Auth::forgetGuards();
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'login' => '09129008001',
            'password' => 'CustPortal123',
        ])->assertOk()
            ->assertJsonPath('user.user_type', User::ROLE_CUSTOMER)
            ->assertJsonPath('user.is_customer_portal', true)
            ->assertJsonPath('user.customer_id', $customerA->id);

        $customerToken = $loginRes->json('token');
        $portalUser = User::where('customer_id', $customerA->id)->firstOrFail();

        // STRICT ZERO-EXTRA-ACCESS ISOLATION: Customer CANNOT access ANY staff CRM endpoints!
        Sanctum::actingAs($portalUser);
        $this->getJson('/api/v1/dashboard/stats')->assertStatus(403);
        $this->getJson('/api/v1/customers')->assertStatus(403);
        $this->getJson("/api/v1/customers/{$customerB->id}")->assertStatus(403);
        $this->getJson('/api/v1/parts')->assertStatus(403);
        $this->getJson('/api/v1/inventory/summary')->assertStatus(403);
        $this->getJson('/api/v1/tickets')->assertStatus(403);
        $this->getJson('/api/v1/users')->assertStatus(403);
        $this->getJson('/api/v1/settings/sms')->assertStatus(403);
        $this->getJson('/api/v1/sms/logs')->assertStatus(403);

        // Customer CAN access their own isolated Portal Overview -> sees Sales Manager & Sales Representative & own device
        $overview = $this->getJson('/api/v1/portal/overview')
            ->assertOk()
            ->assertJsonPath('customer.company_name', 'مجتمع صنعتی بهاران')
            ->assertJsonPath('sales_team.sales_rep.name', 'خانم سارا محمدی (مسئول فروش)')
            ->assertJsonPath('sales_team.sales_rep.phone', '09121002002')
            ->assertJsonPath('sales_team.sales_manager.name', 'مهندس رادمان (مدیر فروش)')
            ->assertJsonPath('sales_team.sales_manager.phone', '09121002001');

        $this->assertCount(1, $overview->json('devices'));
        $this->assertSame('SN-BAHARAN-001', $overview->json('devices.0.serial_number'));

        // Customer CANNOT submit a repair request referencing Customer B's device!
        $this->postJson('/api/v1/portal/tickets', [
            'ticket_type' => 'repair_request',
            'customer_part_id' => $deviceB->id,
            'priority' => 'high',
            'subject' => 'تلاش دسترسی به دستگاه مشتری دیگر',
            'body' => 'تست امنیت شناسه دستگاه غیرمجاز.',
        ])->assertStatus(422);

        // Customer submits a valid Device Breakdown / Repair Request for their own deviceA -> routes to repairAgent!
        $repairRes = $this->postJson('/api/v1/portal/tickets', [
            'ticket_type' => 'repair_request',
            'customer_part_id' => $deviceA->id,
            'priority' => 'urgent',
            'subject' => 'خطای اضافه بار E-04 روی اینورتر خط تولید',
            'body' => 'از صبح امروز اینورتر خط ۲ زیر بار خطای E-04 می‌دهد و متوقف می‌شود.',
        ])->assertStatus(201);

        $repairTicketId = (int) $repairRes->json('ticket.id');
        $this->assertSame($repairAgent->id, (int) $repairRes->json('ticket.assigned_to_user_id'));

        // Customer also sends a direct message to their Sales Representative!
        $salesTicketRes = $this->postJson('/api/v1/portal/tickets', [
            'ticket_type' => 'sales_inquiry',
            'target_contact' => 'sales_rep',
            'priority' => 'medium',
            'subject' => 'استعلام خرید دستگاه دوم برای فاز توسعه',
            'body' => 'سلام خانم محمدی، لطفاً پیش‌فاکتور یک دستگاه اینورتر ۵۰ کیلووات جدید ارسال فرمایید.',
        ])->assertStatus(201);

        $this->assertSame($salesRep->id, (int) $salesTicketRes->json('ticket.assigned_to_user_id'));

        // Staff posts BOTH an internal note AND a public reply on the repair ticket
        Sanctum::actingAs($repairAgent);
        $this->postJson("/api/v1/tickets/{$repairTicketId}/messages", [
            'body' => 'یادداشت محرمانه فنی: احتمال سوختن فن خنک‌کننده داخلی، هزینه تخمینی ۴ میلیون تومان.',
            'is_internal_note' => true,
        ])->assertStatus(201);

        $this->postJson("/api/v1/tickets/{$repairTicketId}/messages", [
            'body' => 'سلام جناب بهارلو، درخواست تعمیر شما ثبت شد و تکنسین فردا در محل کارخانه حضور می‌یابد.',
            'is_internal_note' => false,
        ])->assertStatus(201);

        // Customer views the ticket in Portal -> MUST see public reply and MUST NEVER see the internal note!
        Sanctum::actingAs($portalUser);
        $portalTicketView = $this->getJson("/api/v1/portal/tickets/{$repairTicketId}")
            ->assertOk();

        $portalBodies = implode("\n", collect($portalTicketView->json('ticket.messages'))->pluck('body')->all());
        $this->assertStringContainsString('تکنسین فردا در محل کارخانه حضور می‌یابد', $portalBodies);
        $this->assertStringNotContainsString('یادداشت محرمانه فنی', $portalBodies);
        $this->assertCount(2, $portalTicketView->json('ticket.messages'));

        // Admin disables portal access -> customer's portal token is revoked and /api/v1/portal/* is immediately blocked!
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/customers/{$customerA->id}/portal-access", [
            'portal_enabled' => false,
        ])->assertOk();

        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $customerToken)
            ->getJson('/api/v1/portal/overview')
            ->assertStatus(401);
    }
}
