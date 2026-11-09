<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Part;
use App\Models\PartInventoryLog;
use App\Models\User;
use App\Services\Customers\CustomerService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Ensure Admin User
        $admin = User::firstOrCreate(
            ['email' => 'admin@crm.local'],
            [
                'name' => 'مدیر ارشد سامانه',
                'phone' => '09120000000',
                'password' => Hash::make('Admin@123456'),
                'is_active' => true,
                'user_type' => User::ROLE_ADMINISTRATOR,
                'customer_scope' => User::SCOPE_ALL,
            ]
        );

        $admin->user_type = User::ROLE_ADMINISTRATOR;
        $admin->customer_scope = User::SCOPE_ALL;
        $admin->save();

        $admin->syncPermissions(Permission::all());

        $customerService = app(CustomerService::class);

        // 2. Sample Devices Catalog
        $partsData = [
            [
                'name' => 'پمپ پیستونی هیدرولیک فشار قوی',
                'code' => 'PUMP-HYD-500',
                'periodic_service_months' => 6,
                'description' => 'پمپ هیدرولیک دبی متغیر ۵۰۰ بار مناسب خطوط اکستروژن و پرس',
            ],
            [
                'name' => 'شیر برقی پروپورشنال کنترل جهت و جریان',
                'code' => 'VALVE-PROP-24V',
                'periodic_service_months' => 12,
                'description' => 'شیر هیدرولیکی سرو با فیدبک موقعیت LVDT ولتاژ ۲۴ ولت',
            ],
            [
                'name' => 'سیلندر هیدرولیک دوطرفه صنعتی سنگین',
                'code' => 'CYL-IND-160',
                'periodic_service_months' => 12,
                'description' => 'سیلندر کورس ۱۰۰۰ میلیمتر با پیستون کروم سخت',
            ],
            [
                'name' => 'الکتروموتور سه‌فاز صنعتی ۱۵ کیلووات',
                'code' => 'MOT-3PH-15KW',
                'periodic_service_months' => 24,
                'description' => 'الکتروموتور پوسته چدنی کلاس عایقی F با بیرینگ‌های تقویت‌شده',
            ],
        ];

        $parts = [];
        foreach ($partsData as $item) {
            $part = Part::firstOrCreate(['code' => $item['code']], $item);
            if ((int) $part->stock_quantity === 0 && !$part->inventoryLogs()->exists()) {
                $customerService->adjustStock(
                    $part,
                    PartInventoryLog::TYPE_IN,
                    10,
                    'موجودی اولیه انبار (داده‌های نمونه)',
                    $admin->id
                );
                $part->refresh();
            }
            $parts[$item['code']] = $part;
        }

        // 3. Sample Customers (Potential & Effective)
        $c1 = Customer::firstOrCreate(
            ['mobile' => '09121112233'],
            [
                'customer_type' => 'potential',
                'type' => 'company',
                'first_name' => 'سارا',
                'last_name' => 'افشار',
                'company_name' => 'شرکت فولاد فرایند اصفهان',
                'national_code' => '10103456789',
                'phone' => '03133221100',
                'email' => 'info@foulad-process.ir',
                'province' => 'اصفهان',
                'city' => 'اصفهان',
                'address' => 'شهرک صنعتی جی، خیابان چهارم، پلاک ۲۴',
                'notes' => 'دارای ۴ خط تولید فعال - خرید عمده دستگاه‌های صنعتی',
                'created_by_user_id' => $admin->id,
            ]
        );

        Customer::firstOrCreate(
            ['mobile' => '09359876543'],
            [
                'customer_type' => 'potential',
                'type' => 'company',
                'first_name' => 'کامران',
                'last_name' => 'نادری',
                'company_name' => 'کارگاه قالب‌سازی دقیق نادری',
                'national_code' => '12899887761',
                'phone' => '03134445566',
                'email' => 'naderi.precision@gmail.com',
                'province' => 'اصفهان',
                'city' => 'نجف‌آباد',
                'address' => 'بلوار صنعت، کوی کارآفرینان ۳',
                'notes' => 'مشتری بالقوه در حال مذاکره برای خرید دستگاه‌های هیدرولیک',
                'created_by_user_id' => $admin->id,
            ]
        );

        Customer::firstOrCreate(
            ['mobile' => '09191234567'],
            [
                'customer_type' => 'potential',
                'type' => 'individual',
                'first_name' => 'حامد',
                'last_name' => 'کریمی',
                'national_code' => '0019876543',
                'phone' => '02188779900',
                'email' => 'hamed.karimi@yahoo.com',
                'province' => 'تهران',
                'city' => 'تهران',
                'address' => 'خیابان جمهوری، پاساژ حافظ',
                'notes' => 'پرسش درباره دوره گارانتی و سرویس دوره‌ای دستگاه‌ها',
                'created_by_user_id' => $admin->id,
            ]
        );

        // 4. Assign device to Customer 1 to demonstrate automatic potential-to-effective conversion & stock deduction
        if ($c1->customerParts()->count() === 0) {
            $customerPart = $customerService->assignPart(
                $c1,
                $parts['PUMP-HYD-500'],
                'SN-2026-HYD-00189',
                [
                    'quantity' => 2,
                    'invoice_amount' => 185000000,
                    'invoice_number' => 'INV-1405-101',
                    'notes' => 'تحویل حضوری با برگه ضمانت ۶ ماهه',
                ],
                $admin->id
            );

            $customerService->recordServiceHistory($customerPart, [
                'service_date' => now()->subDays(10)->toDateString(),
                'service_type' => 'periodic',
                'description' => 'سرویس اولیه، روانکاری سیل‌ها و تعویض اورینگ‌های آب‌بندی',
                'cost' => 1500000,
            ], $admin->id);
        }
    }
}
