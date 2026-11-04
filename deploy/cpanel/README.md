# نصب cPanel با مسیر عمومی و خصوصی مستقل

این بسته برای **Apache/LiteSpeed با mod_rewrite و AllowOverride** و PHP **8.2 یا بالاتر** طراحی شده است. MySQL 8 / MariaDB سازگار با Laravel لازم است. روی هاست Node، Composer، SSH، Redis یا symlink لازم نیست؛ ساخت بسته باید روی رایانه توسعه‌دهنده یا GitHub Actions انجام شود.

> **اصلاح پیش‌نیاز نسخه فعلی:** حداقل 8.2 مربوط به تعریف کلی پروژه است؛ `composer.lock` فعلی وابستگی‌هایی با نیاز **PHP >= 8.4.1** دارد. برای ساخت و اجرای همین lock از PHP 8.4 به‌روز روی ماشین ساخت و هاست استفاده کنید؛ `--ignore-platform-reqs` راه‌حل نیست.

## ساخت روی کامپیوتر ویندوزی

آموزش کامل نصب ابزارها در WSL، ساخت محلی دو ZIP، انتقال به ویندوز و آپلود مستقیم به هاست: [راهنمای ویندوز](WINDOWS-BUILD-GUIDE.fa.md).

## ۱. دریافت بسته

در GitHub بخش Actions، workflow به نام **cPanel package** را با Run workflow اجرا کنید. پس از موفقیت artifact به نام `cpanel-package` را دانلود کنید. این workflow با تگ `v*` نیز اجرا می‌شود؛ فایل‌ها artifact هستند، نه پیوست خودکار Release.

یا روی ماشین دارای PHP و افزونه‌های موردنیاز، Composer، Node 22.12+، npm و zip:

```bash
bash deploy/cpanel/build.sh
```

خروجی‌ها در `cpanel-release/`:
- `cpanel-public.zip`: فقط فایل‌های قابل انتشار در وب
- `cpanel-private.zip`: Laravel، vendor، تنظیمات، دیتابیس و فایل‌های خصوصی

ساخت بسته محیط توسعه را هم تغییر می‌دهد (`composer --no-dev` و build فرانت‌اند)؛ ترجیحاً در checkout تمیز یا CI اجرا کنید.

## ۲. مسیرها و استخراج

مثال برای نام کاربری cPanel برابر `alice`:

```text
/home/alice/xx.example.com/              ← محتویات cpanel-public.zip
    index.php, index.html, assets/, .htaccess,
    private-path.php, resolve-private.php, install.php, storage/ ...
/home/alice/private_pro/project1/myc/     ← محتویات cpanel-private.zip
    app/, bootstrap/, config/, database/, routes/, storage/, vendor/ ...
```

در cPanel → Domains، Document Root دامنه `xx.example.com` را روی `/home/alice/xx.example.com` بگذارید. پوشه خصوصی نباید Document Root هیچ دامنه‌ای یا زیرمجموعه پوشه عمومی باشد. `.htaccess` خصوصی نیز دسترسی وب را مسدود می‌کند، اما جای جداسازی واقعی مسیر را نمی‌گیرد.

در فایل عمومی `private-path.php`، **مسیر مطلق واقعی سرور** را بنویسید:

```php
<?php
return '/home/alice/private_pro/project1/myc';
```

مسیر `/private_pro/project1/myc` معمولاً منظور مسیر داخل home حساب است، نه ریشه سیستم‌عامل؛ مسیر واقعی را در File Manager بررسی کنید. مسیر خصوصی از ورودی درخواست وب خوانده نمی‌شود. برای جابه‌جایی بعدی همین فایل و مقدار `APP_PUBLIC_PATH` در `.env` را اصلاح کنید؛ کش config قبلی را حذف کنید.

فایل‌های مخفی را با Show Hidden Files نمایش دهید. پوشه‌ها معمولاً 755 و فایل‌ها 644؛ `storage/` و `bootstrap/cache/` خصوصی و `storage/` عمومی باید توسط PHP قابل نوشتن باشند. هرگز 777 ندهید. محدودیت `open_basedir` هاست باید هر دو مسیر را مجاز کند.

## ۳. ویزارد نصب

1. پیش از انتشار، SSL/AutoSSL را فعال کنید و از **Directory Privacy** یا محدودیت IP موقت برای حفاظت پوشه نصب استفاده کنید؛ نصب‌کننده عمومیِ راه‌اندازی‌نشده نباید در اختیار دیگران باشد.
2. در MySQL Database Wizard دیتابیس **خالی** و کاربر با ALL PRIVILEGES بسازید. نام‌ها معمولاً پیشوند نام حساب دارند.
3. در Select PHP Version افزونه‌های نمایش‌داده‌شده در ویزارد (از جمله pdo_mysql، mbstring، intl، gd، zip، XML و curl) را فعال کنید.
4. `https://xx.example.com/install.php` را باز کنید. پیش‌نیازها و مسیرها را بررسی کنید، آدرس ریشه دامنه، اتصال دیتابیس و ایمیل، موبایل و رمز اختصاصی مدیر (حداقل ۱۲ کاراکتر) را بدهید.
5. ویزارد `.env` و کلید اختصاصی، جداول و مدیر را می‌سازد. داده نمایشی وارد نمی‌شود. برای این روش رمز عمومی `Admin@123456` قابل استفاده نیست.
6. پس از موفقیت، قفل دائمی `storage/installed.lock` در مسیر خصوصی ساخته می‌شود؛ نصب‌کننده حتی اگر دوباره آپلود شود اجرا نمی‌شود. `install.php` و `setup-check.php` را از پوشه عمومی حذف کنید و `update.php` را نیز تا زمان نیاز حذف کنید.

مسیر public در اجرای وب و CLI یکسان تنظیم می‌شود؛ آپلود عمومی مستقیم به `xx.example.com/storage` می‌رود و نیازی به `storage:link` نیست. **فایل‌های حساس را روی دیسک public ذخیره نکنید**؛ دیسک local در storage/app/private خصوصی باقی می‌ماند.

نصب از ریشه دامنه/ساب‌دامنه پشتیبانی می‌شود؛ نصب زیر URL مثل `/crm` در این نسخه پشتیبانی نمی‌شود.

## ۴. آزمون پس از نصب

- `/login` و refresh مستقیم `/customers` باید SPA را برگردانند.
- `/up` باید پاسخ سلامت Laravel باشد، نه HTML فرانت‌اند.
- ورود با مدیر انتخاب‌شده، خروج، ثبت مشتری و قطعه، تخصیص، تاریخچه، اکسل و آپلود لوگو/آواتار را امتحان کنید.
- `/admin` و فایل‌های Filament باید بارگذاری شوند.
- `/.env` و `/private-path.php` و `/resolve-private.php` نباید اطلاعات بدهند.
- بارگذاری PHP در `/storage` باید مسدود باشد.
- پیامک ابتدا در حالت Sandbox است؛ **قبل از استفاده واقعی از ورود پیامکی Sandbox را خاموش کنید** و ارسال/خطای سرویس را با حساب واقعی آزمایش کنید.

## ۵. ارتقا

از دیتابیس، `.env`، `storage/` خصوصی، `storage/` عمومی و `private-path.php` بکاپ بگیرید. هنگام جایگزینی فایل‌های نسخه جدید این موارد و قفل نصب را حفظ کنید؛ فایل `private-path.php` بسته جدید را روی تنظیم واقعی سرور overwrite نکنید. فایل‌های cache قبلی `bootstrap/cache/config.php`، `events.php` و `routes*.php` را قبل از اجرا حذف کنید. `update.php` را موقتاً آپلود، با HTTPS باز و APP_KEY را **فقط داخل فرم POST** وارد کنید، نه URL. پس از ارتقا آن را حذف کنید. ارتقا rollback خودکار ندارد و نباید `migrate:fresh` یا seed نمایشی اجرا شود.

## محدودیت تأیید

بیلد فرانت‌اند جای آزمون هاست واقعی نیست. workflow شامل بررسی syntax PHP، ساخت بسته و اجرای مایگریشن MySQL دوبار است؛ آزمون کامل مرورگری و سرویس ملی‌پیامک روی هاست مقصد همچنان لازم است. گزارش بررسی در `deploy/cpanel/AUDIT.md` است.
