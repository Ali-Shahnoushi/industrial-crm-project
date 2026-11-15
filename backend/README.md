# ⚙️ هسته سرویس‌های بک‌اند سامانه مدیریت مشتریان و دستگاه‌های صنعتی (Laravel 11 API)

سرویس بک‌اند پروژه Industrial CRM توسعه‌داده‌شده با فریم‌ورک **Laravel 11** و **PHP 8.4**، ارائه دهنده APIهای RESTful امن، احراز هویت توکن‌محور Sanctum، سیستم کنترل دسترسی چندسطحی (RBAC v2)، موتور پیشرفته پشتیبان‌گیری، مدیریت انبار و گردش موجودی دستگاه‌ها، خروجی‌های استاندارد اکسل و CSV با تاریخ هجری شمسی، و اتصال به وب‌سرویس ملی‌پیامک.

---

## 🚀 مشخصات فنی و نیازمندی‌ها
- **PHP:** نسخه 8.4.1 یا بالاتر (همراه با اکستنشن‌های `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `xml`, `curl`)

> فایل `composer.json` حداقل PHP 8.2 را اعلام می‌کند، اما وابستگی‌های قفل‌شده (مثل Symfony) به PHP ‎≥ 8.4.1‎ نیاز دارند؛ همین نسخه در اسکریپت‌های ساخت و نصب نیز اجباری است.
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

> فایل `.env.example` به‌صورت پیش‌فرض SQLite را تنظیم می‌کند؛ برای MySQL مقادیر بالا را اعمال کنید.

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
| **مدیر فروش و عملیات (`manager`)** | `demo.manager@crm.local` | `09120000001` | `Manager@123456` | دسترسی سراسری (`all`) به مشتریان، فروش و تیکت‌ها (بدون مدیریت کاربران) |
| **کارشناس فروش (`salesperson`)** | `demo.sales@crm.local` | `09120000002` | `Sales@123456` | دسترسی اختصاصی (`own`) فقط به مشتریان ثبت‌شده توسط خود کاربر |
| **تکنسین نصب و خدمات (`installer`)** | `demo.installer@crm.local` | `09120000003` | `Installer@123456` | محدوده `all` در داده نمونه؛ مجوزها محدود به مشاهده و ثبت سوابق سرویس است |
| **مشتری (`customer`)** | `portal.foolad@crm.local` | `09139998877` | `Portal@123456` | فقط پورتال مشتری: پرونده، دستگاه‌ها و تیکت‌های همان مشتری |

> حساب‌های نمونه (`demo.*` و پورتال) فقط در محیط‌های غیرپروداکشن سید می‌شوند.

---

## 🛡️ امنیت و لایه‌های حفاظتی (Defense-in-Depth)

1. **میدل‌ویر `EnsureActiveUser` (نام مستعار `active.user`):**
   در تمام روت‌های احراز هویت شده اعمال می‌شود. در صورت غیرفعال شدن کاربر توسط مدیر ارشد (`is_active = false`)، درخواست بلافاصله با خطای `401` رد می‌شود.
2. **میدل‌ویر `SecurityHeadersAndLockdown`:**
   - مسدودسازی قطعی (`404 Not Found`) مسیرهای قدیمی `/admin*`، `/filament*` و `/livewire*`.
   - مسدودسازی مستندات OpenAPI در محیط `production`.
   - تزریق هدرهای امنیتی: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Permitted-Cross-Domain-Policies: none`.
3. **پشتیبانی از ارقام فارسی:**
   متدهای ورود و ثبت اطلاعات تمامی ارقام فارسی (`۰-۹`) و عربی را در لایه اعتبارسنجی به ارقام انگلیسی استاندارد تبدیل می‌کنند.
4. **محدودسازی نرخ درخواست (Rate Limiting):**
   اندپوینت‌های ورود (`/auth/login`) و ارسال پیامک OTP دارای محدودیت فرکانس درخواست در لایه Throttle هستند.
5. **تفکیک کارکنان و پورتال مشتری:**
   میدل‌ویرهای `staff.only` و `portal.customer` روت‌های کارکنان و پورتال مشتری را به‌صورت متقابل مسدود می‌کنند؛ حساب پورتال به هیچ روت کارکنان دسترسی ندارد.

---

## 📦 ماژول‌ها و ساختار کدهای بک‌اند

```
app/
├── Exports/                     # خروجی اکسل و CSV مشتریان و دستگاه‌ها با تقویم شمسی
│   ├── CustomersExport.php
│   ├── CustomersTemplateExport.php
│   └── SalesExport.php
├── Imports/                     # درون‌ریزی اکسل مشتریان
│   └── CustomersImport.php
├── Http/
│   ├── Controllers/Api/V1/      # کنترلرهای نسخه ۱ RESTful
│   │   ├── AuthController.php   # ورود، پروفایل، خروج و ارسال/تایید OTP
│   │   ├── BackupController.php # خروجی دیتابیس (SQL Dump)، خروجی و بازیابی JSON مشتریان
│   │   ├── CustomerController.php # مدیریت مشتریان، ایمپورت اکسل، خروجی اکسل و سوابق
│   │   ├── CustomerPortalController.php # پورتال ایزوله مشتری
│   │   ├── DashboardController.php # آمار داشبورد و شاخص‌های کلیدی عملکرد
│   │   ├── InvoiceController.php  # صدور، مشاهده و ابطال فاکتور
│   │   ├── PartController.php   # کاتالوگ دستگاه‌ها، انبارداری و تخصیص به مشتری
│   │   ├── SalesController.php  # فروش، گزارش‌ها و خروجی اکسل
│   │   ├── SettingController.php# تنظیمات ملی‌پیامک و شرکتی
│   │   ├── SmsController.php    # ارسال پیامک الگو و گزارش‌گیری
│   │   ├── TicketController.php # تیکت‌ها، پاسخ‌ها و یادداشت‌ها
│   │   ├── TicketDepartmentController.php # دپارتمان‌ها و راهبرد تخصیص
│   │   └── UserController.php   # مدیریت کارمندان، نقش‌ها و ماتریس مجوزها
│   └── Middleware/
│       ├── AuthenticateFromCookie.php
│       ├── EnsureActiveUser.php
│       ├── EnsureCustomerPortalUser.php
│       ├── EnsureStaffUser.php
│       └── SecurityHeadersAndLockdown.php
├── Models/                      # مدل‌های Eloquent
│   ├── Customer.php             # پرونده مشتریان و اسکوپ دسترسی سازمانی (scopeVisibleTo)
│   ├── CustomerHistory.php      # تاریخچه اقدامات مشتریان
│   ├── CustomerPart.php         # تخصیص دستگاه به مشتری با سریال، فاکتور و گارانتی
│   ├── Invoice.php              # فاکتور فروش و شماره‌گذاری
│   ├── Part.php                 # کاتالوگ و موجودی انبار دستگاه‌ها
│   ├── PartInventoryLog.php     # سابقه تراکنش‌های ورود، خروج، تخصیص و برگشت انبار
│   ├── PartServiceHistory.php   # سوابق تعمیر و سرویس دوره‌ای
│   ├── Sale.php                 # فروش چندقلمه
│   ├── SaleItem.php             # اقلام فروش
│   ├── Setting.php              # تنظیمات سیستمی
│   ├── SmsLog.php               # تاریخچه پیامک‌های ملی‌پیامک
│   ├── Ticket.php               # تیکت و درخواست تعمیر
│   ├── TicketDepartment.php     # دپارتمان تیکت و راهبرد تخصیص
│   ├── TicketMessage.php        # پیام‌ها و یادداشت‌های تیکت
│   └── User.php                 # کاربران، نقش‌ها و مجوزهای سازمانی
├── Services/
│   ├── Customers/CustomerService.php # منطق تجاری مشتریان و تخصیص دستگاه
│   ├── Sales/                  # SaleService، InvoiceService و SalesReportService
│   ├── Sms/MelipayamakService.php    # وب‌سرویس پترن و خدماتی ملی‌پیامک
│   └── Tickets/TicketAssignmentService.php # تخصیص خودکار کارشناس تیکت
└── Support/
    └── JalaliDate.php           # مبدل دقیق و خالص تقویم میلادی به هجری شمسی
```

---

## 📡 مهم‌ترین اندپوینت‌های API (`/api/v1`)

### احراز هویت و کاربران
- `POST /api/v1/auth/login` — ورود با ایمیل یا شماره موبایل (پشتیبانی از اعداد فارسی).
- `GET /api/v1/auth/me` — دریافت اطلاعات کاربر وارد شده و فهرست مجوزها.
- `GET /api/v1/users` — فهرست کارمندان، نقش‌ها و سطوح دسترسی (نیاز به `users.manage`).
- `PUT /api/v1/users/{id}/permissions` — تخصیص مستقیم مجوزهای چک‌باکسی.
- `PATCH /api/v1/users/{id}/toggle-active` — فعال/غیرفعال‌سازی سریع کاربر.
- `POST /api/v1/auth/otp/send` و `POST /api/v1/auth/otp/verify` — ورود با رمز یکبارمصرف پیامکی.
- `POST /api/v1/auth/logout` و `PUT /api/v1/auth/me` — خروج و به‌روزرسانی پروفایل.
- `GET /api/v1/roles` و `GET /api/v1/permissions` — فهرست نقش‌ها و مجوزهای قابل تخصیص.
- `GET /api/v1/dashboard/stats` — آمار داشبورد شامل خلاصه فروش.

### مشتریان و پرونده‌ها
- `GET /api/v1/customers` — دریافت فهرست مشتریان با قابلیت صفحه‌بندی، فیلترهای چندمعیاره، مرتب‌سازی و تفکیک بر اساس دسترسی سازمانی کاربر.
- `POST /api/v1/customers` — ایجاد مشتری جدید (اعتبارسنجی شرطی حقیقی/حقوقی).
- `GET /api/v1/customers/{id}` — پرونده کامل مشتری، دستگاه‌های نصب‌شده، سوابق سرویس و تاریخچه اقدامات.
- `GET /api/v1/customers/export` — دانلود مستقیم خروجی `.xlsx` یا `.csv` (UTF-8 BOM با تاریخ شمسی).
- `POST /api/v1/customers/import` — ورود دسته‌ای مشتریان از فایل اکسل.
- `GET /api/v1/customers/template` — دانلود قالب نمونه فایل اکسل.
- `GET /api/v1/customers-creator-options` و `GET /api/v1/customers-staff-options` — گزینه‌های محدوده‌دار فیلتر ثبت‌کننده و کارکنان.
- `GET /api/v1/customers-lookup` — جستجوی سریع مشتریان.
- `PATCH /api/v1/customers/{id}/owner` — انتقال مالکیت مشتری.
- `POST /api/v1/customers/{id}/portal-access` — مدیریت دسترسی پورتال مشتری.

### کاتالوگ، انبارداری و تخصیص دستگاه‌ها
- `GET /api/v1/parts` — فهرست دستگاه‌ها با موجودی لحظه‌ای انبار.
- `POST /api/v1/parts/{id}/stock` — ثبت دستی ورود/خروج موجودی انبار با توضیحات.
- `GET /api/v1/inventory-logs` — تاریخچه کامل لاگ‌های تراکنش انبار.
- `GET /api/v1/inventory/summary` — خلاصه موجودی انبار و هشدارهای حداقل موجودی.
- `GET /api/v1/parts/inventory-logs` — گزارش گردش موجودی انبار.
- `POST /api/v1/customers/{id}/parts` — تخصیص دستگاه به مشتری (تعداد، مبلغ فاکتور، تاریخ نصب و شماره سریال اختیاری).
- `PUT /api/v1/customer-parts/{id}` — ویرایش اطلاعات تخصیص و تنظیم مجدد موجودی انبار.
- `DELETE /api/v1/customer-parts/{id}` — حذف تخصیص و بازگرداندن خودکار موجودی به انبار.
- `POST /api/v1/customer-parts/{id}/history` — ثبت سابقه سرویس یا تعمیر.

### پشتیبان‌گیری و بازیابی داده‌ها (Backup & Restore - v2.3.0)
- `GET /api/v1/backup/status` — وضعیت پایگاه‌داده، نام دیتابیس، حجم و تعداد رکوردها.
- `GET /api/v1/backup/database-dump` — دانلود مستقیم نسخه پشتیبان کامل SQL پایگاه‌داده تولیدشده با کد خالص PHP (در SQLite فایل کامل دیتابیس دانلود می‌شود).
- `GET /api/v1/backup/customers-json` — استخراج ساختاریافته پرونده‌های مشتریان و دستگاه‌ها به فرمت JSON.
- `POST /api/v1/backup/customers-restore-json` — بازیابی و بازگردانی هوشمند داده‌ها از فایل JSON با تراکنش امن دیتابیس.

### فروش، فاکتورها و گزارش‌ها (Sales & Invoices - v2.4.0)
- `GET /api/v1/sales` و `POST /api/v1/sales` — فهرست و ثبت فروش چندقلمه (نیاز به `sales.view` / `sales.create`).
- `GET /api/v1/sales/{id}`، `PUT /api/v1/sales/{id}` و `DELETE /api/v1/sales/{id}` — مشاهده، ویرایش و حذف فروش (حذف نیاز به `sales.manage`).
- `GET /api/v1/sales/summary` و `GET /api/v1/sales/charts` — شاخص‌های کلیدی و داده نمودارهای فروش.
- `GET /api/v1/sales/export` — خروجی اکسل فروش با تاریخ شمسی.
- `GET /api/v1/customers/{id}/sales` — فروش‌های یک مشتری (تب فروش در پرونده).
- `POST /api/v1/sales/{id}/invoice` — صدور فاکتور برای فروش؛ `GET /api/v1/invoices`، `GET /api/v1/invoices/{id}`، `PATCH /api/v1/invoices/{id}/void` و `GET /api/v1/invoices/summary` — فهرست، مشاهده، ابطال و خلاصه فاکتورها.

### تیکتینگ و پورتال مشتری (v2.3.0)
- `GET /api/v1/tickets`، `POST /api/v1/tickets`، `GET /api/v1/tickets/{id}` و `POST /api/v1/tickets/{id}/messages` — تیکت‌ها و پاسخ‌ها (مجوزهای `tickets.view` / `tickets.reply`).
- `GET /api/v1/ticket-departments` و روت‌های `GET/POST/PUT/DELETE /api/v1/settings/ticket-departments` — دپارتمان‌ها و پیکربندی راهبرد تخصیص.
- `GET /api/v1/portal/overview`، `GET /api/v1/portal/devices`، `GET /api/v1/portal/tickets` و `POST /api/v1/portal/tickets` — پورتال ایزوله مشتری (فقط حساب‌های `customer`).

### سامانه پیامک و تنظیمات
- `POST /api/v1/sms/send-pattern` — ارسال پیامک بر اساس الگوهای تاییدشده خدماتی ملی‌پیامک.
- `GET /api/v1/sms/logs` — تاریخچه و وضعیت تحویل پیامک‌ها.
- `GET/PUT /api/v1/settings/sms` — مشاهده و تنظیم پارامترهای وب‌سرویس ملی‌پیامک.
- `GET/PUT /api/v1/settings/sales` — درصد مالیات پیش‌فرض فروش و الگوی پیامک فروش.
- `GET /api/v1/settings/company` و `POST /api/v1/settings/company` — تنظیمات هویت شرکت و برندینگ.
- `POST /api/v1/settings/system/upgrade` — ارتقای خودکار ساختار دیتابیس و پاکسازی کش از پنل مدیریت.

---

## 🧪 تست‌های خودکار (Automated Testing)

مجموعه تست‌های PHPUnit شامل اعتبارسنجی ریاضی تاریخ شمسی، انبارداری تراکنشی، ماتریس دسترسی RBAC، مسدودسازی نفوذ، ماژول پشتیبان‌گیری، فروش و فاکتورها، تیکتینگ و پورتال مشتری، امنیت نشست و OTP و جلوگیری از ارتقای دسترسی است:

```bash
php artisan test
```

خروجی تست‌ها:
```text
   PASS  Tests\Unit\JalaliDateTest
   PASS  Tests\Feature\AuthOtpAndSessionSecurityTest
   PASS  Tests\Feature\BackupAndNullableSerialTest
   PASS  Tests\Feature\CustomerPortalIsolationAndRepairTest
   PASS  Tests\Feature\CustomerValidationAndExportTest
   PASS  Tests\Feature\DeviceInventoryAndAssignmentTest
   PASS  Tests\Feature\PrivilegeEscalationAndIntegrityTest
   PASS  Tests\Feature\RbacAndCustomerVisibilityTest
   PASS  Tests\Feature\SalesAndInvoicesTest
   PASS  Tests\Feature\SecurityHardeningAndAdminLockdownTest
   PASS  Tests\Feature\TicketingDepartmentsAndRoutingTest
   PASS  Tests\Feature\WarehouseThresholdAndOwnerTransferTest

   Tests: 44 passed (424 assertions)
```
