# نصب cPanel با مسیر عمومی و خصوصی مستقل — نسخه ۲.۳.۰

این بسته برای **Apache/LiteSpeed با mod_rewrite و AllowOverride** و PHP **8.4.1 یا بالاتر سازگار** طراحی شده است. پایگاه داده MySQL 8 / MariaDB سازگار با Laravel لازم است. روی هاست Node، Composer، SSH، Redis یا symlink لازم نیست؛ ساخت بسته باید روی رایانه توسعه‌دهنده یا GitHub Actions انجام شود.

> **پیش‌نیاز نسخه فعلی:** وابستگی‌های قفل‌شده `composer.lock` فعلی به **PHP >= 8.4.1** نیاز دارند. برای اجرای این نسخه روی هاست، PHP 8.4 به بالا را انتخاب کنید.

---

## 🛠️ ساخت روی کامپیوتر توسعه‌دهنده (دو روش)

### روش اول — مستقیم در PowerShell ویندوز (سریع و تک‌کلیکی):
اگر روی ویندوز خود ابزارهای PHP 8.4، Composer و Node را دارید (مثلاً با نرم‌افزار Laragon):
```powershell
powershell -ExecutionPolicy Bypass -File deploy/cpanel/build.ps1
```
این اسکریپت به صورت خودکار بیلد React را تهیه کرده، وابستگی‌های Composer تولید را نصب می‌کند و دو بسته `cpanel-public.zip` و `cpanel-private.zip` به همراه فایل `SHA256SUMS` را در پوشه `cpanel-release/` ایجاد می‌کند.

### روش دوم — با WSL 2 و لینوکس Ubuntu (یا در مک و لینوکس):
آموزش کامل نصب ابزارها در WSL، ساخت محلی دو ZIP، انتقال به ویندوز و آپلود مستقیم به هاست: [راهنمای ویندوز](WINDOWS-BUILD-GUIDE.fa.md).
```bash
bash deploy/cpanel/build.sh
```

---

## ۱. دریافت بسته آماده (خودکار در پوشه `cpanel-release/`)

با هر تغییر کد در شاخه اصلی یا انتشار نسخه، پایپ‌لاین **GitHub Actions (`cPanel package`)** به‌صورت کاملاً خودکار هر دو فایل **`cpanel-public.zip`** و **`cpanel-private.zip`** را ساخته، تمام تست‌های امنیتی و نصب را روی آن‌ها اجرا کرده و مستقیماً داخل پوشه **[`cpanel-release/`](../../cpanel-release)** در ریشه مخزن قرار می‌دهد.

خروجی‌ها در `cpanel-release/`:
- `cpanel-public.zip`: فایل‌های فرانت‌اند React، اسکریپت‌های وب و فایل‌های قابل انتشار در وب
- `cpanel-private.zip`: هسته Laravel، پوشه vendor، تنظیمات، مایگریشن‌ها و فایل‌های خصوصی برنامه

کنترل سلامت خروجی‌ها:
```bash
bash deploy/cpanel/verify-package.sh cpanel-release
(cd cpanel-release && sha256sum -c SHA256SUMS)
```

---

## ۲. مسیرها و استخراج در سرور cPanel

مثال برای نام کاربری cPanel برابر `diswebir`:

```text
/home/diswebir/part.disweb.ir/           ← محتویات cpanel-public.zip
    index.php, index.html, assets/, .htaccess,
    private-path.php, resolve-private.php, install.php, update.php, setup-check.php ...
/home/diswebir/laravel_project/crmp/     ← محتویات cpanel-private.zip
    app/, bootstrap/, config/, database/, routes/, storage/, vendor/ ...
```

در cPanel → Domains، Document Root دامنه را روی پوشه پابلیک قرار دهید. پوشه خصوصی نباید Document Root هیچ دامنه‌ای یا زیرمجموعه پوشه عمومی باشد.

در فایل عمومی `private-path.php`، مسیر مطلق پوشه خصوصی را مشخص کنید:
```php
<?php
return '/home/diswebir/laravel_project/crmp';
```
*(اسکریپت هوشمند `resolve-private.php` حتی بدون این فایل نیز به صورت خودکار ساختارهای رایج نظیر `laravel_project/crmp` و پوشه‌های مجاور را شناسایی می‌کند).*

---

## ۳. ویزارد نصب اولیه (`install.php`)

1. در MySQL Database Wizard یک دیتابیس **خالی** و یک کاربر با تمامی دسترسی‌ها (ALL PRIVILEGES) ایجاد کنید.
2. در Select PHP Version نسخه PHP 8.4 را انتخاب و افزونه‌های مورد نیاز (pdo_mysql, mbstring, intl, gd, zip, xml, curl) را فعال کنید.
3. در مرورگر آدرس `https://your-domain.com/install.php` را باز کنید.
4. پیش‌نیازها و مسیرها را بررسی کرده، آدرس دامنه، اتصال دیتابیس، ایمیل و رمز عبور اختصاصی مدیر ارشد را وارد نمایید.
5. ویزارد فایل `.env` و کلید اختصاصی `APP_KEY` را ایجاد کرده، جداول را می‌سازد و حساب مدیر ارشد را فعال می‌کند.
6. پس از موفقیت، قفل دائمی `storage/installed.lock` در مسیر خصوصی ایجاد می‌شود تا نصب‌کننده دیگر قابل اجرا نباشد. سپس فایل‌های `install.php` و `setup-check.php` را از هاست حذف کنید.

---

## ۴. ابزار بررسی سلامت هاست (`setup-check.php`)

پیش از نصب یا برای عیب‌یابی سرور، می‌توانید آدرس زیر را باز کنید:
```text
https://your-domain.com/setup-check.php
```
این صفحه وضعیت PHP 8.4، اکستنشن‌های فعال، دسترسی نوشتن پوشه storage و اتصال دیتابیس را ارزیابی و گزارش می‌دهد.

---

## ۵. ارتقا به نسخه‌های جدید (بدون نیاز به SSH)

هنگام به‌روزرسانی سامانه به نسخه ۲.۳.۰:
1. ابتدا از دیتابیس در `phpMyAdmin` خروجی بکاپ تهیه کنید.
2. فایل‌های `cpanel-private.zip` را در پوشه پرایوت و `cpanel-public.zip` را در پوشه پابلیک اکسترکت کنید.
   *(توجه: فایل `.env` و پوشه `storage/` شما دست‌نخورده باقی می‌مانند).*
3. در مرورگر آدرس زیر را باز کنید:
   ```text
   https://your-domain.com/update.php
   ```
4. با وارد کردن **رمز عبور کاربر مدیر ارشد سامانه** یا مقدار **`APP_KEY`** موجود در `.env`، دکمه ارتقا را بزنید.
5. مایگریشن‌های جدید، جدول لاگ انبار، ستون‌های دسترسی، پشتیبان‌گیری و رفع خطای سریال با موفقیت اجرا شده، کش‌ها پاکسازی شده و فایل `update.php` برای امنیت به صورت خودکار حذف می‌گردد.
6. همچنین می‌توانید پس از لاگین به سامانه با حساب مدیر ارشد، از منوی **تنظیمات سامانه** روی دکمه **«اجرای بروزرسانی خودکار پایگاه‌داده و پاکسازی کش»** کلیک کنید.

---

## ⚠️ خطای Monolog و PsrExt روی هاست

اگر لاگ سرور شامل خطای زیر بود:
`Declaration of Maatwebsite\Excel\Cache\MemoryCache::get(...) must be compatible with PsrExt\SimpleCache\CacheInterface::get(...)`
یا خطایی مشابه با `PsrExt`:

1. در cPanel به بخش **Select PHP Version** بروید.
2. روی تب **Extensions** کلیک کنید.
3. تیک اکستنشن **psr** را غیرفعال کرده و ذخیره نمایید.
4. پکیج‌های لاراول ۱۱ خود حاوی استانداردهای PSR هستند و این افزونه قدیمی C-level با PHP 8.4 ناسازگار است.
