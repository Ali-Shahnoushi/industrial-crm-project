# نتیجه آزمون اسکریپت ساخت

تاریخ: ۲۰۲۶-۱۱-۰۴

## اجرای واقعی موفق

https://github.com/diswebir/industrial-crm-project/actions/runs/41890513016

تمام stepهای این اجرا موفق‌اند: PHP syntax، ۱۰ تست رگرسیون آفلاین، build واقعی با Composer و npm، ساخت و اعتبارسنجی ZIPها، تست بسته استخراج‌شده با SQLite و MySQL 8، و آپلود artifact خروجی.

در هر smoke test، فایل‌های عمومی و خصوصی در دو مسیر جدا (دارای فاصله) استخراج می‌شوند، migrate دوبار اجرا می‌شود، نوع مدیر و ۱۴ مجوز و تصادفی بودن رمز اولیه نصب بررسی می‌شود و نوشتن روی دیسک public و مسیر واقعی آپلود کنترل می‌شود.

## مشکلات برطرف‌شده

- mismatch نسخه PHP 8.2 با lock نیازمند 8.4.1؛ preflight و installer/diagnostic و CI هماهنگ شدند.
- دستکاری vendor/.env و build فرانت‌اند در سورس؛ همه عملیات ساخت به workspace موقت منتقل شد.
- خروجی نسبی و مسیر دارای فاصله؛ مسیر قبل از تغییر cwd به مسیر مطلق تبدیل می‌شود.
- ورود داده runtime، آپلودها، auth.json، vendor قدیمی یا کش تنظیمات محلی به بسته؛ از فهرست صریح سورس و ساخت تازه vendor/assets استفاده می‌شود.
- ادامه بدون ابزار/افزونه موردنیاز؛ خطای روشن قبل از شروع build.
- خطاهای مبهم Composer؛ quiet حذف شده و مرحله خطا مشخص است.
- خروجی ناقص یا کهنه؛ قبل از انتشار هر دو ZIP تست می‌شوند و SHA256SUMS و build-info تولید می‌شود.
- بیلد هم‌زمان و پاک‌سازی؛ lock مشترک خروجی و cleanup در خطا/interrupt.

## اجرای مجدد

```bash
python3 -m unittest discover -s deploy/cpanel/tests -v
bash deploy/cpanel/build.sh
bash deploy/cpanel/verify-package.sh cpanel-release
(cd cpanel-release && sha256sum -c SHA256SUMS)
bash deploy/cpanel/tests/smoke-package.sh cpanel-release
```

دستور آخر به PHP سازگار و pdo_sqlite نیاز دارد و دیتابیس موقت ایجاد می‌کند. تست MySQL در CI روی سرویس disposable انجام می‌شود؛ روی دیتابیس عملیاتی اجرا نکنید.

## محدودیت‌ها

اجرای مستقیم روی ویندوز/WSL کاربر، Apache/LiteSpeed cPanel، ویزارد مرورگری، کل CRUDها و سرویس پیامک واقعی در این اجرا بررسی نشده‌اند. تست‌های آفلاین از doubles برای PHP/Composer/npm استفاده می‌کنند و جای تست واقعی CI را نمی‌گیرند. امکان دانلود لاگ کامل CI از sandbox به علت محدودیت دامنه شبکه نبود؛ نتیجه موفق stepها از GitHub CLI دریافت شد.
