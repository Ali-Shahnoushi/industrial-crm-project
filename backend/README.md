# ⚙️ هسته سرویس‌های بک‌اند سامانه مدیریت مشتریان و دستگاه‌های صنعتی (Laravel 11 API)

سرویس بک‌اند پروژه Industrial CRM توسعه‌داده‌شده با فریم‌ورک **Laravel 11** و **PHP 8.4**، ارائه دهنده APIهای RESTful امن، احراز هویت توکن‌محور Sanctum، سیستم کنترل دسترسی چندسطحی (RBAC v2)، موتور پیشرفته پشتیبان‌گیری، مدیریت انبار و گردش موجودی دستگاه‌ها، خروجی‌های استاندارد اکسل و CSV با تاریخ هجری شمسی، و اتصال به وب‌سرویس ملی‌پیامک.

---

## 🚀 مشخصات فنی و نیازمندی‌ها
- **PHP:** نسخه 8.4.1 یا بالاتر (همراه با اکستنشن‌های `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `xml`, `curl`)
- **Composer:** نسخه 2.7+
- **پایگاه‌داده:** MySQL 8.0+ / MariaDB 10.5+ یا PostgreSQL 15+
- **احراز هویت:** Laravel Sanctum (Bearer Token)
- **مجوزها:** Spatie Laravel Permission (RBAC v2 + Direct ACL)
- **مستندات API:** OpenAPI 3.1 تولیدشده زنده توسط Dedoc Scramble در آدرس `/docs/api`

---

## 🛠 راه‌اندازی و اجرای محلی

### ۱. نصب وابستگی‌ها
```bash
composer install --optimize-autoloader
```

### ۲. پیکربندی محیط (`.env`)
```bash
cp .env.example .env
php artisan key:generate
```

تنظیمات پایگاه‌داده را در `.env` اعمال کنید:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=crm_part
DB_USERNAME=root
DB_PASSWORD=
```

### ۳. اجرای مایگریشن‌ها و داده‌های اولیه
```bash
php artisan migrate --seed
```

### ۴. اجرای سرور توسعه
```bash
php artisan serve --host=127.0.0.1 --port=8000
```
آدرس پایه API: `http://127.0.0.1:8000/api/v1`  
آدرس مستندات تعاملی: `http://127.0.0.1:8000/docs/api`

---

## 👥 حساب‌های کاربری و دسترسی‌های پیش‌فرض

| نقش سازمانی | ایمیل | شماره موبایل | رمز عبور | محدوده دسترسی مشتریان (`customer_scope`) |
| :--- | :--- | :--- | :--- | :--- |
| **مدیر ارشد (`administrator`)** | `admin@crm.local` | `09120000000` | `Admin@123456` | دسترسی سراسری (`all`) به همه مشتریان، تنظیمات، بکاپ و کاربران |
| **کارشناس فروش (`salesperson`)** | `sales@crm.local` | `09121110000` | `Sales@123456` | دسترسی اختصاصی (`own`) فقط به مشتریان ثبت‌شده توسط خود کاربر |
| **تکنسین نصب و خدمات (`installer`)** | `installer@crm.local` | `09122220000` | `Installer@123456` | ثبت سوابق سرویس و خدمات پس از فروش و بازبینی دستگاه‌ها |

---

## 🛡️ امنیت و لایه‌های حفاظتی (Defense-in-Depth)

1. **میدل‌ویر `EnsureUserIsActive`:**
   در تمام روت‌های احراز هویت شده اعمال می‌شود. در صورت غیرفعال شدن کاربر توسط مدیر ارشد (`is_active = false`)، نشست بلافاصله با خطای `403` خاتمه می‌یابد.
2. **میدل‌ویر `SecurityHeadersAndLockdown`:**
   - مسدودسازی قطعی (`404 Not Found`) مسیرهای قدیمی `/admin*`، `/filament*` و `/livewire*`.
   - مسدودسازی مستندات OpenAPI در محیط `production`.
   - تزریق هدرهای امنیتی: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
3. **پشتیبانی از ارقام فارسی:**
   متدهای ورود و ثبت اطلاعات تمامی ارقام فارسی (`۰-۹`) و عربی را در لایه اعتبارسنجی به ارقام انگلیسی استاندارد تبدیل می‌کنند.
4. **محدودسازی نرخ درخواست (Rate Limiting):**
   اندپوینت‌های ورود (`/auth/login`) و ارسال پیامک OTP دارای محدودیت فرکانس درخواست در لایه Throttle هستند.

---

## 📦 ماژول‌ها و ساختار کدهای بک‌اند

```
app/
├── Exports/                     # خروجی اکسل و CSV مشتریان و دستگاه‌ها با تقویم شمسی
│   ├── CustomersExport.php
│   └── Sheets/
├── Http/
│   ├── Controllers/Api/V1/      # کنترلرهای نسخه ۱ RESTful
│   │   ├── AuthController.php   # ورود، پروفایل، خروج و ارسال/تایید OTP
│   │   ├── BackupController.php # خروجی دیتابیس (SQL Dump)، خروجی و بازیابی JSON مشتریان
│   │   ├── CustomerController.php # مدیریت مشتریان، ایمپورت اکسل، خروجی اکسل و سوابق
│   │   ├── DashboardController.php # آمار داشبورد و شاخص‌های کلیدی عملکرد
│   │   ├── PartController.php   # کاتالوگ دستگاه‌ها، انبارداری و تخصیص به مشتری
│   │   ├── SettingController.php# تنظیمات ملی‌پیامک و شرکتی
│   │   ├── SmsController.php    # ارسال پیامک الگو و گزارش‌گیری
│   │   └── UserController.php   # مدیریت کارمندان، نقش‌ها و ماتریس مجوزها
│   └── Middleware/
│       ├── EnsureUserIsActive.php
│       └── SecurityHeadersAndLockdown.php
├── Models/                      # مدل‌های Eloquent
│   ├── Customer.php             # پرونده مشتریان و اسکوپ دسترسی سازمانی (scopeVisibleTo)
│   ├── CustomerPart.php         # تخصیص دستگاه به مشتری با سریال، فاکتور و گارانتی
│   ├── Part.php                 # کاتالوگ و موجودی انبار دستگاه‌ها
│   ├── PartInventoryLog.php     # سابقه تراکنش‌های ورود، خروج، تخصیص و برگشت انبار
│   ├── ServiceHistory.php       # سوابق تعمیر و سرویس دوره‌ای
│   ├── SmsLog.php               # تاریخچه پیامک‌های ملی‌پیامک
│   └── User.php                 # کاربران، نقش‌ها و مجوزهای سازمانی
├── Services/
│   ├── Customers/CustomerService.php # منطق تجاری مشتریان و تخصیص دستگاه
│   └── Sms/MelipayamakService.php    # وب‌سرویس پترن و خدماتی ملی‌پیامک
└── Support/
    └── JalaliDate.php           # مبدل دقیق و خالص تقویم میلادی به هجری شمسی
```

---

## 📡 مهم‌ترین اندپوینت‌های API (`/api/v1`)

### احراز هویت و کاربران
- `POST /api/v1/auth/login` — ورود با نام کاربری، ایمیل یا موبایل (پشتیبانی از اعداد فارسی).
- `GET /api/v1/auth/me` — دریافت اطلاعات کاربر وارد شده و فهرست مجوزها.
- `GET /api/v1/users` — فهرست کارمندان، نقش‌ها و سطوح دسترسی (نیاز به `users.manage`).
- `PUT /api/v1/users/{id}/permissions` — تخصیص مستقیم مجوزهای چک‌باکسی.
- `PATCH /api/v1/users/{id}/toggle-active` — فعال/غیرفعال‌سازی سریع کاربر.

### مشتریان و پرونده‌ها
- `GET /api/v1/customers` — دریافت فهرست مشتریان با قابلیت صفحه‌بندی، فیلترهای چندمعیاره، مرتب‌سازی و تفکیک بر اساس دسترسی سازمانی کاربر.
- `POST /api/v1/customers` — ایجاد مشتری جدید (اعتبارسنجی شرطی حقیقی/حقوقی).
- `GET /api/v1/customers/{id}` — پرونده کامل مشتری، دستگاه‌های نصب‌شده، سوابق سرویس و تاریخچه اقدامات.
- `GET /api/v1/customers/export` — دانلود مستقیم خروجی `.xlsx` یا `.csv` (UTF-8 BOM با تاریخ شمسی).
- `POST /api/v1/customers/import` — ورود دسته‌ای مشتریان از فایل اکسل.
- `GET /api/v1/customers/template` — دانلود قالب نمونه فایل اکسل.

### کاتالوگ، انبارداری و تخصیص دستگاه‌ها
- `GET /api/v1/parts` — فهرست دستگاه‌ها با موجودی لحظه‌ای انبار.
- `POST /api/v1/parts/{id}/stock` — ثبت دستی ورود/خروج موجودی انبار با توضیحات.
- `GET /api/v1/inventory-logs` — تاریخچه کامل لاگ‌های تراکنش انبار.
- `POST /api/v1/customers/{id}/parts` — تخصیص دستگاه به مشتری (تعداد، مبلغ فاکتور، تاریخ نصب و شماره سریال اختیاری).
- `PUT /api/v1/customer-parts/{id}` — ویرایش اطلاعات تخصیص و تنظیم مجدد موجودی انبار.
- `DELETE /api/v1/customer-parts/{id}` — حذف تخصیص و بازگرداندن خودکار موجودی به انبار.
- `POST /api/v1/customer-parts/{id}/history` — ثبت سابقه سرویس یا تعمیر.

### پشتیبان‌گیری و بازیابی داده‌ها (Backup & Restore - v2.3.0)
- `GET /api/v1/backup/status` — وضعیت پایگاه‌داده، نام دیتابیس، حجم و تعداد رکوردها.
- `GET /api/v1/backup/database-dump` — دانلود مستقیم نسخه پشتیبان کامل SQL پایگاه‌داده (با امکان دانلود فرمت gzip یا متن).
- `GET /api/v1/backup/customers-json` — استخراج ساختاریافته پرونده‌های مشتریان و دستگاه‌ها به فرمت JSON.
- `POST /api/v1/backup/customers-restore-json` — بازیابی و بازگردانی هوشمند داده‌ها از فایل JSON با تراکنش امن دیتابیس.

### سامانه پیامک و تنظیمات
- `POST /api/v1/sms/send-pattern` — ارسال پیامک بر اساس الگوهای تاییدشده خدماتی ملی‌پیامک.
- `GET /api/v1/sms/logs` — تاریخچه و وضعیت تحویل پیامک‌ها.
- `GET/PUT /api/v1/settings/sms` — مشاهده و تنظیم پارامترهای وب‌سرویس ملی‌پیامک.
- `POST /api/v1/settings/system/upgrade` — ارتقای خودکار ساختار دیتابیس و پاکسازی کش از پنل مدیریت.

---

## 🧪 تست‌های خودکار (Automated Testing)

مجموعه تست‌های PHPUnit شامل اعتبارسنجی ریاضی تاریخ شمسی، انبارداری تراکنشی، ماتریس دسترسی RBAC، مسدودسازی نفوذ و ماژول پشتیبان‌گیری است:

```bash
php artisan test
```

خروجی تست‌ها:
```text
   PASS  Tests\Unit\JalaliDateTest
   PASS  Tests\Feature\BackupAndNullableSerialTest
   PASS  Tests\Feature\CustomerValidationAndExportTest
   PASS  Tests\Feature\DeviceInventoryAndAssignmentTest
   PASS  Tests\Feature\RbacAndCustomerVisibilityTest
   PASS  Tests\Feature\SecurityHardeningAndAdminLockdownTest

   Tests: 18 passed (172 assertions)
```
