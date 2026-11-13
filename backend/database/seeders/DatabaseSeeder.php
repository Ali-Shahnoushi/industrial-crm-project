<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Part;
use App\Models\PartInventoryLog;
use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use App\Services\Customers\CustomerService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.delete',
            'customers.import',
            'customers.export',
            'parts.view',
            'parts.manage',
            'parts.assign',
            'parts.history',
            'tickets.view',
            'tickets.reply',
            'tickets.manage',
            'sales.view',
            'sales.create',
            'sales.manage',
            'sms.send',
            'sms.logs',
            'users.manage',
            'settings.manage',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // 4 Standardized Persian Business Roles
        $adminRole = Role::firstOrCreate(['name' => User::ROLE_ADMINISTRATOR, 'guard_name' => 'web']);
        $adminRole->syncPermissions($permissions);

        $managerRole = Role::firstOrCreate(['name' => User::ROLE_MANAGER, 'guard_name' => 'web']);
        $managerRole->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_MANAGER]);

        $installerRole = Role::firstOrCreate(['name' => User::ROLE_INSTALLER, 'guard_name' => 'web']);
        $installerRole->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_INSTALLER]);

        $salesRole = Role::firstOrCreate(['name' => User::ROLE_SALESPERSON, 'guard_name' => 'web']);
        $salesRole->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON]);

        // Keep legacy role alias mapped so existing upgraded DBs never fail lookups
        $superAdminLegacy = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdminLegacy->syncPermissions($permissions);

        // Ensure Primary Administrator account exists
        $admin = User::firstOrCreate(
            ['email' => 'admin@crm.local'],
            [
                'name' => 'مدیر ارشد سیستم',
                'phone' => '09120000000',
                'password' => Hash::make('Admin@123456'),
                'is_active' => true,
                'user_type' => User::ROLE_ADMINISTRATOR,
                'customer_scope' => User::SCOPE_ALL,
            ]
        );
        $admin->update([
            'user_type' => User::ROLE_ADMINISTRATOR,
            'customer_scope' => User::SCOPE_ALL,
        ]);
        if (!$admin->hasRole(User::ROLE_ADMINISTRATOR)) {
            $admin->assignRole(User::ROLE_ADMINISTRATOR);
        }
        $admin->syncPermissions($permissions);

        // Guard: Never seed demo staff, devices, or sample customers in production environments!
        if (app()->environment('production')) {
            return;
        }

        // Rich multi-role staff fixtures for QA, staging & automated tests
        $demoManager = User::firstOrCreate(
            ['email' => 'demo.manager@crm.local'],
            [
                'name' => 'مهندس سارا محمدی (مدیر فروش و عملیات)',
                'phone' => '09120000001',
                'password' => Hash::make('Manager@123456'),
                'is_active' => true,
                'user_type' => User::ROLE_MANAGER,
                'customer_scope' => User::SCOPE_ALL,
            ]
        );
        $demoManager->syncRoles([User::ROLE_MANAGER]);
        $demoManager->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_MANAGER]);

        $demoSales = User::firstOrCreate(
            ['email' => 'demo.sales@crm.local'],
            [
                'name' => 'امیرحسین کریمی (کارشناس فروش)',
                'phone' => '09120000002',
                'password' => Hash::make('Sales@123456'),
                'is_active' => true,
                'user_type' => User::ROLE_SALESPERSON,
                'customer_scope' => User::SCOPE_OWN,
            ]
        );
        $demoSales->syncRoles([User::ROLE_SALESPERSON]);
        $demoSales->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON]);

        $demoInstaller = User::firstOrCreate(
            ['email' => 'demo.installer@crm.local'],
            [
                'name' => 'رضا کاظمی (تکنسین نصب و سرویس)',
                'phone' => '09120000003',
                'password' => Hash::make('Installer@123456'),
                'is_active' => true,
                'user_type' => User::ROLE_INSTALLER,
                'customer_scope' => User::SCOPE_ALL,
            ]
        );
        $demoInstaller->syncRoles([User::ROLE_INSTALLER]);
        $demoInstaller->syncPermissions(User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_INSTALLER]);

        // Industrial Devices Catalog with Warehouse Thresholds (including 1 low-stock alert fixture)
        $partsCatalog = [
            [
                'code' => 'DEV-INV-55KW',
                'name' => 'دستگاه اینورتر صنعتی ۵۵ کیلووات زیمنس',
                'periodic_service_months' => 6,
                'stock_quantity' => 15,
                'min_stock' => 4,
                'unit' => 'دستگاه',
                'unit_price' => 240000000,
                'description' => 'بازدید خازن‌ها، فن خنک‌کننده و کالیبراسیون دور موتور هر ۶ ماه',
                'is_active' => true,
            ],
            [
                'code' => 'DEV-PMP-HYD300',
                'name' => 'دستگاه پمپ هیدرولیک فشار قوی رکسروت',
                'periodic_service_months' => 3,
                'stock_quantity' => 8,
                'min_stock' => 3,
                'unit' => 'دستگاه',
                'unit_price' => 195000000,
                'description' => 'بررسی اورینگ‌ها، فشار روغن و تعویض فیلتر هیدرولیک هر ۳ ماه',
                'is_active' => true,
            ],
            [
                'code' => 'DEV-PLC-S71500',
                'name' => 'دستگاه کنترلر صنعتی PLC S7-1500',
                'periodic_service_months' => 12,
                'stock_quantity' => 12,
                'min_stock' => 3,
                'unit' => 'دستگاه',
                'unit_price' => 215000000,
                'description' => 'بکاپ برنامه، تست باتری پشتیبان و بررسی اتصالات شبکه صنعتی سالانه',
                'is_active' => true,
            ],
            [
                'code' => 'DEV-CMP-ATLAS75',
                'name' => 'کمپرسور اسکرو صنعتی ۷۵ کیلووات اطلس کوپکو',
                'periodic_service_months' => 4,
                'stock_quantity' => 2, // Intentionally <= min_stock (5) to exercise low-stock alerts
                'min_stock' => 5,
                'unit' => 'دستگاه',
                'unit_price' => 620000000,
                'description' => 'تعویض سپراتور، فیلتر هوا و آنالیز ارتعاش واحد هواساز هر ۴ ماه',
                'is_active' => true,
            ],
            [
                'code' => 'DEV-HMI-TP1200',
                'name' => 'نمایشگر صنعتی لمسی ۱۲ اینچ Comfort Panel',
                'periodic_service_months' => 12,
                'stock_quantity' => 9,
                'min_stock' => 2,
                'unit' => 'عدد',
                'unit_price' => 98000000,
                'description' => 'کالیبراسیون پنل لمسی و بروزرسانی فرم‌ویر سالانه',
                'is_active' => true,
            ],
        ];

        $seededParts = [];
        foreach ($partsCatalog as $item) {
            $existing = Part::where('code', $item['code'])->first();
            if (!$existing) {
                $created = Part::create($item);
                if ($created->stock_quantity > 0) {
                    PartInventoryLog::create([
                        'part_id' => $created->id,
                        'user_id' => $admin->id,
                        'type' => PartInventoryLog::TYPE_IN,
                        'quantity' => $created->stock_quantity,
                        'balance_before' => 0,
                        'balance_after' => $created->stock_quantity,
                        'description' => 'موجودی اولیه انبار (داده‌های نمونه)',
                    ]);
                }
                $seededParts[$item['code']] = $created;
            } else {
                $seededParts[$item['code']] = $existing;
            }
        }

        // Seed realistic potential & effective customers + device assignments + service histories on empty DBs
        if (Customer::count() === 0) {
            /** @var CustomerService $customerService */
            $customerService = app(CustomerService::class);

            $createDemoCustomer = function (array $attrs, int $creatorId): Customer {
                $attrs['created_by_user_id'] = $creatorId;
                $c = Customer::create($attrs);
                $c->histories()->create([
                    'user_id' => $creatorId,
                    'action' => 'created',
                    'description' => "مشتری جدید («{$c->display_name}») در سامانه ثبت شد.",
                ]);
                return $c;
            };

            $cust1 = $createDemoCustomer([
                'customer_type' => 'potential',
                'type' => 'company',
                'company_name' => 'مجتمع فولاد آلیاژی سپاهان',
                'national_code' => '10260123456',
                'mobile' => '09131112233',
                'phone' => '03136201100',
                'email' => 'procurement@sepahansteel.ir',
                'province' => 'اصفهان',
                'city' => 'اصفهان',
                'address' => 'شهرک صنعتی مبارکه، بلوار صنعت، پلاک ۴',
                'notes' => 'مشتری کلیدی خط نورد گرم — قرارداد سرویس سالانه فعال',
            ], $demoSales->id);

            $cust2 = $createDemoCustomer([
                'customer_type' => 'potential',
                'type' => 'company',
                'company_name' => 'کارخانجات سیمان شرق خراسان',
                'national_code' => '10380987654',
                'mobile' => '09152223344',
                'phone' => '05138445566',
                'email' => 'technical@sharghcement.ir',
                'province' => 'خراسان رضوی',
                'city' => 'مشهد',
                'address' => 'کیلومتر ۱۸ جاده کلات، مجتمع صنعتی سیمان',
                'notes' => 'نیاز به پایش دوره‌ای کمپرسور و اینورترهای کوره',
            ], $demoManager->id);

            $cust3 = $createDemoCustomer([
                'customer_type' => 'potential',
                'type' => 'individual',
                'first_name' => 'مهندس بهرام',
                'last_name' => 'شریفی',
                'national_code' => '0071234567',
                'mobile' => '09124445566',
                'phone' => '02166778899',
                'province' => 'تهران',
                'city' => 'شهریار',
                'address' => 'شهرک صنعتی نصیرآباد، خیابان سرو ۱۲',
                'notes' => 'کارگاه قطعه‌سازی دقیق — استعلام قیمت PLC و پنل لمسی',
            ], $demoSales->id);

            $createDemoCustomer([
                'customer_type' => 'potential',
                'type' => 'company',
                'company_name' => 'پتروشیمی تابان جنوب',
                'national_code' => '10861122334',
                'phone' => '06132229900',
                'province' => 'خوزستان',
                'city' => 'ماهشهر',
                'address' => 'منطقه ویژه اقتصادی پتروشیمی، سایت ۳',
                'notes' => 'سرنخ نمایشگاه بین‌المللی صنعت — در انتظار ارسال پیش‌فاکتور پمپ هیدرولیک',
            ], $demoManager->id);

            $createDemoCustomer([
                'customer_type' => 'potential',
                'type' => 'individual',
                'first_name' => 'کیوان',
                'last_name' => 'نعمتی',
                'national_code' => '2298765432',
                'mobile' => '09175556677',
                'province' => 'فارس',
                'city' => 'شیراز',
                'address' => 'شهرک صنعتی بزرگ شیراز، میدان دوم',
                'notes' => 'متقاضی خرید اینورتر ۵۵ کیلووات در ماه آینده',
            ], $demoSales->id);

            // Assign devices (5-arg CustomerService::assignPart — promotes cust1, cust2, cust3 potential -> effective)
            $cp1 = $customerService->assignPart($cust1, $seededParts['DEV-INV-55KW'], 'SN-SIEM-55K-9001', [
                'quantity' => 2,
                'invoice_number' => 'INV-1404-101',
                'invoice_amount' => 480000000,
                'installation_date' => now()->subMonths(5)->toDateString(),
                'warranty_months' => 18,
                'notes' => 'نصب روی خط نورد شماره ۲',
            ], $demoManager->id);

            $customerService->assignPart($cust1, $seededParts['DEV-PLC-S71500'], 'SN-S71500-4410', [
                'quantity' => 1,
                'invoice_number' => 'INV-1404-102',
                'invoice_amount' => 215000000,
                'installation_date' => now()->subMonths(3)->toDateString(),
                'warranty_months' => 24,
            ], $demoManager->id);

            $cp3 = $customerService->assignPart($cust2, $seededParts['DEV-PMP-HYD300'], 'SN-REX-HYD-3308', [
                'quantity' => 2,
                'invoice_number' => 'INV-1404-205',
                'invoice_amount' => 390000000,
                'installation_date' => now()->subMonths(2)->toDateString(),
                'warranty_months' => 12,
            ], $demoManager->id);

            $customerService->assignPart($cust3, $seededParts['DEV-HMI-TP1200'], 'SN-HMI-1200-771', [
                'quantity' => 1,
                'invoice_number' => 'INV-1404-309',
                'invoice_amount' => 98000000,
                'installation_date' => now()->subMonth()->toDateString(),
                'warranty_months' => 12,
            ], $demoSales->id);

            $customerService->recordServiceHistory($cp1, [
                'service_type' => 'periodic',
                'service_date' => now()->subMonths(5)->addDays(10)->toDateString(),
                'cost' => 12500000,
                'description' => 'سرویس دوره‌ای فن‌ها، تست خازن لینک DC و کالیبراسیون پارامترهای گشتاور انجام شد.',
            ], $demoInstaller->id);

            $customerService->recordServiceHistory($cp3, [
                'service_type' => 'periodic',
                'service_date' => now()->subDays(20)->toDateString(),
                'cost' => 6800000,
                'description' => 'بازدید فشار کاری ۲۵۰ بار و کنترل دمای روغن هیدرولیک بدون نشتی.',
            ], $demoInstaller->id);

            // Configure Sales Manager & Enable Isolated Customer Portal for $cust1 + Seed Default Department Agents & Demo Ticket
            $cust1->update([
                'sales_manager_user_id' => $demoManager->id,
                'portal_enabled' => true,
            ]);

            $portalUser = User::firstOrCreate(
                ['email' => 'portal.foolad@crm.local'],
                [
                    'name' => $cust1->display_name,
                    'phone' => '09139998877',
                    'password' => Hash::make('Portal@123456'),
                    'is_active' => true,
                    'user_type' => User::ROLE_CUSTOMER,
                    'customer_scope' => User::SCOPE_OWN,
                    'customer_id' => $cust1->id,
                ]
            );

            $repairDept = TicketDepartment::where('is_default_repair', true)->first();
            if ($repairDept) {
                $repairDept->agents()->syncWithoutDetaching([$demoInstaller->id, $demoManager->id]);
            }

            $salesDept = TicketDepartment::where('name', 'like', '%فروش%')->first();
            if ($salesDept) {
                $salesDept->agents()->syncWithoutDetaching([$demoSales->id, $demoManager->id]);
            }

            if (Ticket::count() === 0) {
                $demoTicket = Ticket::create([
                    'tracking_code' => 'TKT-261109-1001',
                    'customer_id' => $cust1->id,
                    'customer_part_id' => $cp1->id,
                    'department_id' => $repairDept?->id,
                    'created_by_user_id' => $portalUser->id,
                    'assigned_to_user_id' => $demoInstaller->id,
                    'ticket_type' => Ticket::TYPE_REPAIR_REQUEST,
                    'priority' => 'high',
                    'status' => Ticket::STATUS_IN_PROGRESS,
                    'subject' => 'درخواست سرویس دوره‌ای و بررسی صدای فن اینورتر خط ۲',
                    'last_reply_at' => now()->subHours(2),
                ]);

                $demoTicket->messages()->create([
                    'user_id' => $portalUser->id,
                    'sender_type' => 'customer',
                    'is_internal_note' => false,
                    'body' => 'با سلام، فن خنک‌کننده اینورتر خط نورد شماره ۲ صدای غیرعادی دارد. لطفاً جهت اعزام کارشناس هماهنگ فرمایید.',
                ]);

                $demoTicket->messages()->create([
                    'user_id' => $demoInstaller->id,
                    'sender_type' => 'staff',
                    'is_internal_note' => false,
                    'body' => 'سلام جناب مهندس، درخواست شما بررسی شد و قطعه فن اورجینال رزرو گردید. فردا صبح در محل کارخانه حضور خواهیم داشت.',
                ]);
            }

            $this->call(SalesDemoSeeder::class);
        }
    }
}
