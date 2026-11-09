# سند تعریف اهداف مهندسی و استراتژی تست (Goal & TDD Specification — نسخه `2.1.0`)

این سند پیش از پیاده‌سازی تغییرات نسخه **`2.1.0`**، اهداف دقیق (Goals)، معیارهای پذیرش (Acceptance Criteria)، مدل تهدید و هاردنینگ امنیتی، و ماتریس تست‌های خودکار (Test-First / TDD) را مشخص می‌کند.

---

## ۱. اهداف کلیدی نسخه `2.1.0` (Engineering Goals)

### Goal 1 — شمسی‌سازی کامل تاریخ‌ها در خروجی‌های اکسل و CSV (`CustomersExport`)
- **مسئله:** تاریخ‌های خروجی اکسل (`.xlsx`) و فایل `.csv` در سمت سرور به صورت میلادی (`YYYY/MM/DD`) چاپ می‌شدند.
- **هدف:** پیاده‌سازی مبدل دقیق و بدون وابستگی خارجی `App\Support\JalaliDate` (پشتیبانی کامل از سال‌های کبیسه شمسی و میلادی) و تبدیل ستون‌های «تاریخ ثبت»، «تاریخ تحویل / نصب» و «پایان گارانتی» در هر دو شیت خروجی اکسل و فایل CSV به فرمت استاندارد شمسی (`1405/08/18` و `1405/08/18 14:35`).
- **معیار پذیرش:** تست واحد `JalaliDateTest` روی مرزهای کبیسه و نوروز (`1403/12/30`، `1404/12/29`، `1405/01/01`) و تست یکپارچگی خروجی CSV/Excel بدون وجود تاریخ میلادی `2026/`.

### Goal 2 — پوشش تست خودکار منطق تجاری و امنیتی در PHPUnit + اجرای خودکار در CI
- **مسئله:** پوشه `backend/tests/` صرفاً شامل تست نمونه پیش‌فرض لاراول بود و سناریوهای حساس مالی/انباری و دسترسی‌ها در CI تست واحد و فیچر نداشتند.
- **هدف:** نگارش مجموعه تست‌های خودکار PHPUnit (Unit + Feature) با دیتابیس ایزوله `RefreshDatabase` و اتصال مستقیم آن به پایپ‌لاین GitHub Actions (`.github/workflows/cpanel.yml`).
- **معیار پذیرش:** عبور ۱۰۰٪ تست‌های زیر در هر Pull Request:
  1. `JalaliDateTest`: صحت ریاضی تبدیل تاریخ میلادی به جلالی.
  2. `RbacAndCustomerVisibilityTest`: تفکیک ۴ نقش (`administrator`, `manager`, `salesperson`, `installer`)، محدوده‌های `own` / `selected` / `all`، اشتراک‌گذاری همکاران و مشتریان خاص، و جلوگیری از دسترسی غیرمجاز (`403`).
  3. `DeviceInventoryAndAssignmentTest`: صحت تراکنش‌های انبار (`in`, `out_manual`, `out_assign`, `return`)، جلوگیری از منفی شدن موجودی، تبدیل خودکار مشتری `potential` به `effective`، و بازگشت دقیق موجودی در ویرایش یا حذف تخصیص.
  4. `CustomerValidationAndExportTest`: اعتبارسنجی شرطی مشتری حقیقی و حقوقی، اختیاری بودن موبایل، نرمال‌سازی اعداد فارسی (`۰-۹`)، محافظت از بازنویسی مشتریان سایر کارمندان در ایمپورت اکسل، و خروجی UTF-8 BOM CSV با تاریخ شمسی.
  5. `SecurityHardeningAndAdminLockdownTest`: مسدودسازی کامل مسیرهای پنل حذف‌شده فیلامنت و Livewire، بررسی هدرهای امنیتی پاسخ و کنترل حساب‌های غیرفعال.

### Goal 3 — حذف کامل پنل فرعی Filament (`/admin`) و هاردنینگ امنیتی چندلایه (Defense-in-Depth)
- **چرا پنل فرعی Filament نیاز نیست؟**
  پنل اصلی React SPA تمام عملیات مدیریتی، کاربری، انبارداری، مشتریان، پیامک و تنظیمات سیستم را پوشش می‌دهد. وجود پنل موازی Filament در `/admin` به همراه `/livewire/update` سطح حمله (Attack Surface) مضاعفی ایجاد می‌کرد.
- **هدف و لایه‌های هاردنینگ:**
  1. **حذف کامل کدهای پنل:** حذف دایرکتوری‌های `backend/app/Filament/` و `backend/app/Providers/Filament/`، حذف `AdminPanelProvider` از `backend/bootstrap/providers.php`، حذف اینترفیس `FilamentUser` از مدل `User` و حذف اسکریپت `@php artisan filament:upgrade` از `composer.json`.
  2. **قفل‌گذاری سطح اپلیکیشن (`SecurityHeadersAndLockdown` Middleware):** مسدودسازی قطعی (`404 Not Found`) هرگونه درخواست به مسیرهای `/admin*`، `/livewire*` و `/filament*` (حتی با نشست ادمین) و همچنین مسدودسازی مستندات OpenAPI (`/docs*`) در محیط `production`، به همراه تزریق هدرهای امنیتی استاندارد (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Permitted-Cross-Domain-Policies: none`).
  3. **قفل‌گذاری سطح وب‌سرور و پروکسی (`.htaccess`, `nginx.conf`, `vite.config.ts`):** مسدودسازی مستقیم `/admin`، `/livewire` و `/filament` در Apache/LiteSpeed و Nginx و حذف کامل استت‌های عمومی Filament از بسته انتشار `cpanel-public.zip` به همراه کنترل خودکار عدم وجود آن‌ها در `verify-package.sh`.

### Goal 4 — پاکسازی کامل کدهای مرده فرانت‌اند (Dead Code Elimination) و رفع هشدارهای لینت
- **مسئله:** ۱۴ فایل نمایشی/دموی قدیمی از قالب اولیه (مانند `Tickets.tsx`, `Chat.tsx`, `Calendar.tsx`, `Pipeline.tsx`, `Sales.tsx`, `Tasks.tsx`, `useData.ts`) در سورس وجود داشتند که در `App.tsx` هیچ مسیری نداشتند و موجب ۵۰ هشدار لینت و یک درخواست شبکه ناموفق (`GET /api/v1/notifications`) در منوی اعلان‌ها می‌شدند.
- **هدف:**
  1. اتصال `NotificationsMenu.tsx` به داده‌های واقعی فعالیت‌های اخیر سامانه (`dashboardApi.getStats`) با ذخیره وضعیت مطالعه‌شده در مرورگر (حذف کامل درخواست خطادار `/api/v1/notifications`).
  2. حذف تمامی فایل‌های مرده و غیرقابل‌دسترس از درخت ایمپورت `main.tsx`.
  3. اصلاح الگوهای کامپوننت‌های فعال تا اجرای `npm run lint` با **۰ خطا (0 Errors) و ۰ هشدار (0 Warnings)** به پایان برسد.

### Goal 5 — رفع هشدار منسوخ شدن Node 20 در GitHub Actions CI
- **هدف:** ارتقای اکشن‌های `actions/checkout`، `actions/setup-node` و `actions/upload-artifact` به نسخه رسمی **`@v7`** مبتنی بر Node 24 و افزودن گام اجرای خودکار تست‌های PHPUnit به پایپ‌لاین CI.

### Goal 6 — ارتقای نسخه سامانه به `2.1.0`
- **هدف:** یکپارچه‌سازی شماره نسخه **`2.1.0`** در `backend/config/app.php`، `backend/config/scramble.php`، `frontend/package.json`، `SystemSettingsPage.tsx`، `deploy/cpanel/update.php` و `CHANGELOG.md`.
