# 🚀 راهنمای استقرار Industrial CRM روی هاست cPanel — بدون SSH

> کل فرآیند فقط با **File Manager** مرورگر انجام می‌شود؛ نه SSH لازم است، نه Composer، نه Node.
> پکیج نصب شامل «نصب‌کننده تحت وب» است — درست مثل نصب وردپرس.

---

## 📦 پکیج شامل چیست؟

`cpanel-app.zip` (ساخته‌شده توسط `deploy/cpanel/build.sh` یا GitHub Actions):

| بخش | توضیح |
|---|---|
| برنامه Laravel 11 | با پوشه `vendor` کامل — بدون نیاز به composer روی هاست |
| فرانت‌اند React | بیلدشده و قرارگرفته در `public/` (index.html + assets) |
| `public/install.php` | 🔰 نصب‌کننده تحت وب: اتصال دیتابیس، ساخت `.env`، اجرای مایگریشن‌ها و داده اولیه |
| `public/update.php` | 🔄 اجرای مایگریشن‌های جدید هنگام به‌روزرسانی نسخه قبلی |
| `public/setup-check.php` | 🩺 بررسی سلامت محیط (بعد از نصب حذف شود) |
| `.env.cpanel.example` | قالب تنظیمات (برای روش نصب دستی) |
| `_cpanel-root-htaccess.txt` | برای وقتی که برنامه داخل `public_html` نصب می‌شود |

`crm-database.sql` (کنار زیپ در Release) فقط برای **روش نصب دستی** لازم است — با نصب‌کننده وب دیگر نیازی به آن نیست.

---

## ✅ پیش‌نیازهای هاست

1. **PHP نسخه 8.2+** (تست‌شده روی 8.4) — از **MultiPHP Manager**
2. **MySQL + phpMyAdmin** — تقریباً همه هاست‌های cPanel
3. افزونه‌های PHP (از **Select PHP Version → Extensions**):
   ضروری: `pdo_mysql` ، `mbstring` ، `openssl` ، `fileinfo` ، `curl` ، `tokenizer` ، `xml`
   پیشنهادی: `gd` ، `intl` ، `zip`
4. File Manager با قابلیت آپلود/Extract زیپ ~۲۰ مگابایتی

---

## 🗺️ انتخاب محل نصب

| | سناریو A (ترجیحی ⭐) | سناریو B |
|---|---|---|
| شرط | بتوانی **DocumentRoot** را عوض کنی (برای Subdomain / Addon Domain در بیشتر cPanelها ممکن است) | DocumentRoot قفل است روی `public_html` |
| محل نصب | خارج از `public_html` مثل `/home/USER/crm-app` | مستقیماً داخل `public_html` |

> 💡 ساده‌ترین راه برای سناریو A: یک **ساب‌دامنه** مثل `crm.yoursite.ir` بساز و DocumentRoot آن را مشخص کن.

---

## 🟢 روش ۱ — نصب با نصب‌کننده وب (پیشنهادی)

### گام ۱ — ساخت دیتابیس
cPanel → **MySQL® Database Wizard** → نام دیتابیس و کاربر + رمز قوی بساز → **ALL PRIVILEGES**.
*(فقط دیتابیس خالی لازم است — جدول‌ها را خود نصب‌کننده می‌سازد.)*

### گام ۲ — آپلود و استخراج
**سناریو A:** در File Manager یک پوشه `crm-app` بالای `public_html` بساز → `cpanel-app.zip` را آپلود و همان‌جا **Extract** کن → زیپ را حذف کن → در بخش Subdomains مقدار Document Root را روی `/home/USER/crm-app/public` بگذار.

**سناریو B:** زیپ را داخل `public_html` آپلود و Extract کن → زیپ را حذف کن → محتوای `_cpanel-root-htaccess.txt` را جایگزین `public_html/.htaccess` کن.

### گام ۳ — اجرای نصب‌کننده
در مرورگر باز کن: `https://دامنه/install.php`

1. جدول بررسی پیش‌نیازها را ببین (همه باید ✅ باشند)
2. فرم را پر کن:
   - **آدرس کامل سایت:** `https://crm.yoursite.ir`
   - **host / پورت:** `127.0.0.1` و `3306`
   - **نام دیتابیس / کاربر / رمز:** همان‌هایی که در گام ۱ ساختی (مثل `youruser_crmdb`)
3. دکمه **«شروع نصب»** را بزن → مایگریشن‌ها و داده اولیه اجرا می‌شود
4. `APP_KEY` یکتا تولید و `.env` ساخته می‌شود — و `install.php` خودش را حذف می‌کند ✅

### گام ۴ — اولین ورود
- آدرس سایت → ورود با `admin@crm.local` / `Admin@123456`
- تست کن: داشبورد، مشتریان (جستجوی «سارا»)، قطعات، پیامک، `/admin` (پنل Filament)، `/docs/api`

> ⚠️ **فوراً رمز ادمین را عوض کن** (پروفایل من → تغییر کلمه عبور).

---

## 🔵 روش ۲ — نصب دستی (بدون نصب‌کننده)

1. دیتابیس بساز (مثل گام ۱ بالا)
2. **phpMyAdmin** → دیتابیس را انتخاب → تب Import → فایل `crm-database.sql` → Go (باید ۲۲ جدول ساخته شود)
3. زیپ را طبق سناریو A یا B استخراج کن
4. در File Manager (با **Show Hidden Files**) فایل `.env.cpanel.example` را به `.env` تغییر نام بده و **Edit** کن:
   ```env
   APP_URL=https://crm.yoursite.ir
   DB_DATABASE=youruser_crmdb
   DB_USERNAME=youruser_crmuser
   DB_PASSWORD=رمز-دیتابیس
   ```
5. `https://دامنه/setup-check.php` را باز کن — همه باید سبز باشد (بعدش حذفش کن)

---

## 🔁 به‌روزرسانی نسخه نصب‌شده (خیلی مهم)

وقتی نسخه جدیدی از برنامه آمد (Release جدید در گیت‌هاب):

1. **بکاپ بگیر:** phpMyAdmin → Export + یک کپی از `.env` و پوشه `public/storage`
2. زیپ جدید را **روی نسخه قبلی** استخراج کن (Extract در همان محل نصب) — فایل‌ها جایگزین می‌شوند
   - ⚠️ نگران `.env` نباش: در زیپ دیتابیس-محور نیست و رونویسی نمی‌شود
   - ⚠️ فایل‌های آپلودشده (`public/storage`) و سوابق (`storage`) با extract از بین نمی‌روند
3. مقدار `APP_KEY` را از فایل `.env` کپی کن و این آدرس را باز کن:
   ```
   https://دامنه/update.php?key=APP_KEY
   ```
4. وضعیت مایگریشن‌ها را می‌بینی → دکمه **اجرای مایگریشن‌ها** را بزن
5. تمام — `update.php` بعد از اجرا خودش را حذف می‌کند

> اگر نسخه جدید **فقط تغییر فرانت/ظاهر** داشته باشد و مایگریشن جدیدی نباشد، مرحله ۳-۴ لازم نیست؛ کافی است استخراج کنی و `Ctrl+F5` بزنی.

---

## 🔐 چک‌لیست امنیتی بعد از نصب

- [ ] رمز `admin@crm.local` تغییر کرد
- [ ] `install.php` حذف شد (نصب‌کننده خودکار حذفش می‌کند — مطمئن شو)
- [ ] `setup-check.php` از پوشه `public` حذف شد
- [ ] `update.php` حذف شد (بعد از هر استفاده)
- [ ] SSL رایگان فعال شد: cPanel → **SSL/TLS Status** → **Run AutoSSL**
- [ ] `APP_URL` دقیقاً همان دامنه‌ای است که باز می‌کنی (www و بدون www یکی نیستند)
- [ ] بکاپ اولیه دیتابیس گرفته شد

---

## 🩹 عیب‌یابی رایج

| مشکل | علت | راه‌حل |
|---|---|---|
| نصب‌کننده: «اتصال ناموفق» | اطلاعات دیتابیس غلط / دیتابیس نساختی | مقادیر را با MySQL Databases در cPanel مقایسه کن (پیشوند حساب فراموش نشود: `youruser_...`) |
| نصب‌کننده: خطای مایگریشن | جدول تکراری از ایمپورت قبلی | جداول را از phpMyAdmin حذف و دوباره تلاش کن |
| صفحه 500 | خطای برنامه | `storage/logs/laravel.log` را از File Manager بخوان |
| «could not find driver» | `pdo_mysql` خاموش | Select PHP Version → Extensions |
| صفحه سفید | PHP < 8.2 | MultiPHP Manager → 8.2+ |
| بعد از لاگین بیرون می‌اندازد | `APP_URL` ناهماهنگ با دامنه باز‌شده | `.env` را اصلاح کن |
| آپلود آواتار/اکسل خطا | محدودیت PHP | MultiPHP INI Editor → `upload_max_filesize=12M` و `post_max_size=12M` |
| deep-link 404 (مثل /customers) | htaccess قدیمی | `deploy/cpanel/htaccess/public.htaccess` را در `public/.htaccess` بگذار |
| خطای 419/session | storage غیرقابل‌نوشتن | پوشه `storage` و `bootstrap/cache` → 775 |
| پیامک واقعی ارسال نمی‌شود | حالت Sandbox روشن | برنامه → تنظیمات → ملی‌پیامک → اطلاعات را وارد کن و Sandbox را خاموش کن |

---

## 🛠️ ساخت پکیج (توسعه‌دهنده)

### روش ۱ — خودکار با GitHub Actions (پیشنهادی)
هر بار تگ نسخه push کنی، پکیج ساخته و به Release پیوست می‌شود:
```bash
git add -A
git commit -m "your changes"
git push
git tag v1.0.1
git push origin v1.0.1
# → در صفحه GitHub → Releases فایل cpanel-app.zip و crm-database.sql ظاهر می‌شود
```
اجرای دستی هم از تب **Actions → Build cPanel Package → Run workflow** ممکن است.

### روش ۲ — لوکال (Linux / macOS / WSL)
```bash
bash deploy/cpanel/build.sh
# خروجی: cpanel-release/cpanel-app.zip
```
پیش‌نیاز: PHP 8.2+ و Composer و Node 18+ و `zip`.

### ساخت `crm-database.sql` لوکال (فقط برای روش نصب دستی)
```bash
cd backend
cp .env.example .env   # سپس DB_* را روی MySQL محلی تنظیم کن
php artisan key:generate
php artisan migrate:fresh --seed
mysqldump --add-drop-table -u USER -p DBNAME > ../cpanel-release/crm-database.sql
```

---

## 📁 نقشه فایل‌های استقرار (داخل ریپو)

```
deploy/cpanel/
├── README.md               ← همین راهنما
├── build.sh                ← اسکریپت ساخت پکیج (لوکال + GitHub Actions)
├── install.php             ← نصب‌کننده تحت وب (به public کپی می‌شود)
├── update.php              ← اجرای مایگریشن هنگام آپدیت (به public کپی می‌شود)
├── setup-check.php         ← بررسی سلامت محیط (به public کپی می‌شود)
├── env.cpanel.example      ← قالب .env production (APP_KEY موقع بیلد ساخته می‌شود)
└── htaccess/
    ├── public.htaccess     ← مسیریابی SPA + API داخل public/
    └── root.htaccess       ← هدایت همه به public/ (نصب داخل public_html)
```
