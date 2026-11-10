<?php
/**
 * ═════════════════════════════════════════════════════════════════════
 *  🔄 Industrial CRM — به‌روزرسانی هوشمند دیتابیس بدون نیاز به SSH
 *
 *  این فایل برای به‌روزرسانی امن دیتابیس به نسخه ۲.۰.۰ در cPanel طراحی شده است.
 *  امنیت: دسترسی فقط با داشتن APP_KEY فایل .env سرور یا رمز عبور مدیر سیستم امکان‌پذیر است.
 * ═════════════════════════════════════════════════════════════════════
 */
declare(strict_types=1);

// فعال‌سازی کامل نمایش و مدیریت خطا جهت جلوگیری مطلق از صفحه سفید (WSOD)
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Referrer-Policy: no-referrer');

function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function renderCard(string $title, string $body, string $badge = 'نسخه ۲.۳.۰'): string
{
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . e($title) . ' — سامانه CRM صنعتی</title>'
        . '<style>'
        . 'body{font-family:Tahoma,Vazirmatn,system-ui,sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:24px 16px;line-height:1.6}'
        . '.card{max-width:760px;margin:auto;background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.5)}'
        . '.hd{background:#090d16;padding:20px 24px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}'
        . '.hd h1{margin:0;font-size:18px;color:#fff;display:flex;align-items:center;gap:8px}'
        . '.badge{background:#2563eb;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-family:monospace}'
        . '.bd{padding:24px}'
        . '.note{background:#1e3a8a33;border:1px solid #3b82f644;border-right:4px solid #3b82f6;border-radius:10px;padding:14px;font-size:13px;margin:16px 0;color:#93c5fd}'
        . '.warn{background:#78350f33;border:1px solid #f59e0b44;border-right:4px solid #f59e0b;border-radius:10px;padding:14px;font-size:13px;margin:16px 0;color:#fde68a}'
        . '.err{background:#7f1d1d33;border:1px solid #ef444444;border-right:4px solid #ef4444;border-radius:10px;padding:14px;font-size:13px;margin:16px 0;color:#fca5a5}'
        . '.succ{background:#064e3b33;border:1px solid #10b98144;border-right:4px solid #10b981;border-radius:10px;padding:14px;font-size:13px;margin:16px 0;color:#6ee7b7}'
        . 'pre{background:#090d16;color:#38bdf8;padding:14px;border-radius:10px;overflow:auto;direction:ltr;text-align:left;font-size:12px;line-height:1.5;max-height:350px;border:1px solid #1e293b}'
        . 'label{display:block;margin-bottom:8px;font-weight:bold;font-size:13px;color:#cbd5e1}'
        . 'input[type="text"],input[type="password"]{width:100%;padding:11px 14px;border:1px solid #475569;border-radius:10px;box-sizing:border-box;direction:ltr;text-align:left;font-family:monospace;background:#090d16;color:#fff;font-size:14px;margin-bottom:16px}'
        . 'input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.25)}'
        . 'button,.btn{display:inline-block;background:#2563eb;color:#fff;border:0;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;text-decoration:none;transition:all .15s}'
        . 'button:hover,.btn:hover{background:#1d4ed8}'
        . '.btn-success{background:#16a34a}.btn-success:hover{background:#15803d}'
        . '.btn-danger{background:#dc2626}.btn-danger:hover{background:#b91c1c}'
        . 'table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}'
        . 'th,td{padding:10px 12px;border-bottom:1px solid #334155;text-align:right}'
        . 'th{background:#090d16;color:#94a3b8}'
        . '</style></head><body>'
        . '<div class="card">'
        . '<div class="hd"><h1><span>🔄</span> به‌روزرسانی سامانه CRM به ' . e($badge) . '</h1><span class="badge">' . e($badge) . '</span></div>'
        . '<div class="bd">' . $body . '</div>'
        . '</div></body></html>';
}

// ثبت مدیریت خطای جامع برای جلوگیری از هرگونه صفحه سفید
set_exception_handler(function (\Throwable $ex) {
    http_response_code(500);
    $details = "نوع خطا: " . get_class($ex) . "\n"
        . "پیام: " . $ex->getMessage() . "\n"
        . "فایل: " . $ex->getFile() . " (خط " . $ex->getLine() . ")\n\n"
        . "Trace:\n" . $ex->getTraceAsString();
    
    echo renderCard('خطا در اجرای اسکریپت',
        '<div class="err"><b>❌ در حین پردازش به‌روزرسانی خطایی رخ داد:</b><br>' . e($ex->getMessage()) . '</div>'
        . '<div class="note">💡 <b>راهنمایی عیب‌یابی:</b><br>'
        . '۱. بررسی کنید مسیر فایل‌های خصوصی در فایل <code>private-path.php</code> صحیح باشد.<br>'
        . '۲. اطلاعات اتصال دیتابیس در فایل <code>.env</code> را بررسی کنید.<br>'
        . '۳. دسترسی نوشتن پوشه <code>storage/</code> را روی 755 بررسی کنید.</div>'
        . '<pre>' . e($details) . '</pre>');
    exit;
});

/* ─── ۱. پیدا کردن مسیر خصوصی لاراول ─── */
$resolveScript = __DIR__ . '/resolve-private.php';
if (!is_file($resolveScript)) {
    http_response_code(500);
    echo renderCard('خطای ساختاری', '<div class="err">فایل <code>resolve-private.php</code> در پوشه عمومی یافت نشد. لطفاً بسته عمومی را کامل آپلود کنید.</div>');
    exit;
}

$baseDir = require $resolveScript;
$envPath = $baseDir . '/.env';

function envValue(string $file, string $key): ?string
{
    if (!is_file($file)) return null;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*' . preg_quote($key, '/') . '\s*=\s*(.*)$/', $line, $m)) {
            $v = trim($m[1]);
            if (preg_match('/^(["\'])(.*)\1$/', $v, $q)) {
                $v = $q[2];
                if ($q[1] === '"') {
                    $v = strtr($v, ['\\\\' => '\\', '\\"' => '"', '\\$' => '$']);
                }
            }
            return $v;
        }
    }
    return null;
}

/* ─── ۲. پاکسازی کامل کش‌های قدیمی (شامل packages.php و services.php نسخه‌های قبلی) قبل از بارگذاری لاراول ─── */
foreach (glob($baseDir . '/bootstrap/cache/*.php') ?: [] as $staleCache) {
    @unlink($staleCache);
}
foreach (glob($baseDir . '/storage/framework/views/*.php') ?: [] as $staleView) {
    @unlink($staleView);
}

/* ─── ۳. بارگذاری هسته لاراول ─── */
if (!is_file($baseDir . '/vendor/autoload.php')) {
    http_response_code(500);
    echo renderCard('خطای بارگذاری پکیج‌ها',
        '<div class="err">پوشه <code>vendor</code> در مسیر خصوصی یافت نشد.<br>مسیر خصوصی بررسی‌شده: <code>' . e($baseDir) . '</code></div>'
        . '<div class="note">فایل‌های پکیج cpanel-private.zip باید در مسیر <code>' . e($baseDir) . '</code> استخراج شوند.</div>');
    exit;
}

$updateExceptionHandler = function (\Throwable $ex) {
    http_response_code(500);
    $details = "نوع خطا: " . get_class($ex) . "\n"
        . "پیام: " . $ex->getMessage() . "\n"
        . "فایل: " . $ex->getFile() . " (خط " . $ex->getLine() . ")\n\n"
        . "Trace:\n" . $ex->getTraceAsString();

    echo renderCard('خطا در اجرای اسکریپت',
        '<div class="err"><b>❌ در حین پردازش به‌روزرسانی خطایی رخ داد:</b><br>' . e($ex->getMessage()) . '</div>'
        . '<div class="note">💡 <b>راهنمایی عیب‌یابی:</b><br>'
        . '۱. بررسی کنید فایل‌های قدیمی <code>bootstrap/cache/*.php</code> پاک شده باشند.<br>'
        . '۲. اطلاعات اتصال دیتابیس در فایل <code>.env</code> را بررسی کنید.<br>'
        . '۳. دسترسی نوشتن پوشه‌های <code>storage/</code> و <code>bootstrap/cache/</code> را روی 755 بررسی کنید.</div>'
        . '<pre>' . e($details) . '</pre>');
    exit;
};

try {
    require_once $baseDir . '/vendor/autoload.php';
    $app = require_once $baseDir . '/bootstrap/app.php';
    $kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
    // بازگردانی مدیریت خطای اختصاصی update.php پس از اجرای HandleExceptions لاراول
    set_exception_handler($updateExceptionHandler);
} catch (\Throwable $bootEx) {
    $updateExceptionHandler($bootEx);
}

$serverAppKey = (string) envValue($envPath, 'APP_KEY');
if ($serverAppKey === '' || $serverAppKey === 'base64:') {
    echo renderCard('برنامه نصب نشده است',
        '<div class="warn">فایل <code>.env</code> یا مقدار <code>APP_KEY</code> هنوز تنظیم نشده است.<br>'
        . 'اگر این نصب جدید است، ابتدا <code>install.php</code> را اجرا کنید.</div>');
    exit;
}

/* ─── ۴. اعتبارسنجی احراز هویت ─── */
$authSecret = isset($_POST['secret']) ? trim((string)$_POST['secret']) : '';
$isAuthorized = false;

if ($authSecret !== '') {
    // ۱. بررسی تطابق با APP_KEY موجود در .env
    if (hash_equals($serverAppKey, $authSecret) || hash_equals(str_replace('base64:', '', $serverAppKey), $authSecret)) {
        $isAuthorized = true;
    } else {
        // ۲. یا تطابق با رمز عبور کاربر مدیر ارشد در دیتابیس (سازگار با دیتابیس‌های v1.x قبل از ایجاد ستون user_type)
        try {
            $hasUserType = \Illuminate\Support\Facades\Schema::hasColumn('users', 'user_type');
            $candidates = $hasUserType
                ? \App\Models\User::where('user_type', 'administrator')
                    ->orWhere('email', 'admin@crm.local')
                    ->orWhere('id', 1)
                    ->get()
                : \App\Models\User::orderBy('id')->limit(10)->get();

            foreach ($candidates as $candidate) {
                if (\Illuminate\Support\Facades\Hash::check($authSecret, $candidate->password)) {
                    $isAuthorized = true;
                    break;
                }
            }
        } catch (\Throwable $t) {
            // ignore
        }
    }
}

/* ─── ۵. پردازش درخواست GET (نمایش وضعیت و فرم تایید) ─── */
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($requestMethod !== 'POST' || !$isAuthorized) {
    $authError = '';
    if ($requestMethod === 'POST' && !$isAuthorized) {
        $authError = '<div class="err">❌ کلید امنیتی یا رمز عبور مدیر واردشده صحیح نیست.</div>';
    }

    $dbStatusHtml = '';
    $pendingCount = 0;
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        \Illuminate\Support\Facades\Artisan::call('migrate:status');
        $statusOutput = \Illuminate\Support\Facades\Artisan::output();
        $pendingCount = substr_count(strtolower($statusOutput), 'pending');
        
        $dbStatusHtml = '<div class="succ">✅ اتصال به دیتابیس برقرار است. (' . ($pendingCount > 0 ? "تعداد {$pendingCount} مایگریشن جدید در انتظار اجراست." : "تمام جداول دیتابیس به‌روز هستند.") . ')</div>'
            . '<details style="margin: 12px 0;"><summary style="cursor:pointer;color:#38bdf8;font-size:13px;font-weight:bold">مشاهده جزئیات وضعیت جدول‌های دیتابیس</summary>'
            . '<pre style="margin-top:8px">' . e($statusOutput) . '</pre></details>';
    } catch (\Throwable $dbe) {
        $dbStatusHtml = '<div class="err">⚠️ خطا در اتصال به دیتابیس: ' . e($dbe->getMessage()) . '</div>';
    }

    $body = $authError
        . '<div class="note">این ابزار تغییرات دیتابیس نسخه ۲.۳.۰ (مدیریت انبار، تیکتینگ، پنل مشتری، فیلد سریال اختیاری و ۱۷ سطح دسترسی) را بدون از دست رفتن داده‌های قبلی بر روی دیتابیس اعمال می‌کند.</div>'
        . $dbStatusHtml
        . '<form method="post" style="margin-top:20px">'
        . '<label for="secret">کلید امنیتی (APP_KEY موجود در .env یا رمز عبور مدیر سیستم):</label>'
        . '<input type="password" id="secret" name="secret" placeholder="مقدار APP_KEY یا رمز عبور ادمین" required autocomplete="off">'
        . '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">'
        . '<button type="submit" class="btn btn-success">▶ شروع اجرای مایگریشن‌ها و به‌روزرسانی دیتابیس</button>'
        . '<a href="' . e((string)envValue($envPath, 'APP_URL') ?: '/') . '" style="color:#94a3b8;font-size:13px;text-decoration:none">← بازگشت به صفحه ورود</a>'
        . '</div>'
        . '</form>'
        . '<div class="warn" style="margin-top:24px">💡 <b>پیشنهاد:</b> جهت احتیاط بیشتر، قبل از ارتقا یک خروجی (Export) سریع از phpMyAdmin بگیرید.</div>';

    echo renderCard('فرم به‌روزرسانی سامانه', $body);
    exit;
}

/* ─── ۶. پردازش POST: اجرای migrate و به‌روزرسانی ─── */
$migrationLog = '';
try {
    // ۱. اجرای مایگریشن‌ها با فلگ force
    $exitCode = \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    $migrationLog .= \Illuminate\Support\Facades\Artisan::output();

    if ($exitCode !== 0) {
        throw new \RuntimeException("اجرای مایگریشن با خطای شماره {$exitCode} متوقف شد.");
    }

    // ۲. پاکسازی کش‌های لاراول
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    $migrationLog .= "\n" . \Illuminate\Support\Facades\Artisan::output();

    // ۳. اطمینان از همگام‌سازی دسترسی‌های مدیر ارشد
    try {
        $admin = \App\Models\User::where('user_type', 'administrator')
            ->orWhere('email', 'admin@crm.local')
            ->first();
        if ($admin) {
            $admin->is_active = true;
            $admin->user_type = 'administrator';
            $admin->save();
            if (class_exists(\Spatie\Permission\Models\Permission::class)) {
                $allPerms = \Spatie\Permission\Models\Permission::all();
                $admin->syncPermissions($allPerms);
                $migrationLog .= "\nمدیر ارشد و مجوزهای سیستمی با موفقیت همگام‌سازی شدند.";
            }
        }
    } catch (\Throwable $syncEx) {
        $migrationLog .= "\nهشدار در همگام‌سازی دسترسی‌ها: " . $syncEx->getMessage();
    }

} catch (\Throwable $migEx) {
    http_response_code(500);
    echo renderCard('خطا در به‌روزرسانی',
        '<div class="err">❌ اجرای عملیات به‌روزرسانی دیتابیس با خطا مواجه شد:<br>' . e($migEx->getMessage()) . '</div>'
        . '<pre>' . e($migrationLog . "\n" . $migEx->getTraceAsString()) . '</pre>'
        . '<p><a href="update.php" class="btn">← تلاش مجدد</a></p>');
    exit;
}

// تلاش برای حذف خودکار فایل پس از ارتقای موفق
$selfDeleted = @unlink(__FILE__);

$appUrl = (string)envValue($envPath, 'APP_URL') ?: '/';

$body = '<div class="succ">🎉 <b>به‌روزرسانی با موفقیت کامل شد!</b><br>دیتابیس سامانه و تمام جداول به نسخه ۲.۳.۰ ارتقا یافتند و داده‌های پیشین حفظ شدند.</div>'
    . '<h3 style="margin-top:20px;color:#cbd5e1;font-size:14px">گزارش عملیات انجام‌شده:</h3>'
    . '<pre>' . e(trim($migrationLog)) . '</pre>'
    . '<div class="note">'
    . ($selfDeleted ? '✅ فایل <code>update.php</code> برای حفظ امنیت به صورت خودکار حذف شد.' : '⚠️ فایل <code>update.php</code> به صورت خودکار حذف نشد. لطفاً جهت امنیت این فایل را دستی از پوشه عمومی حذف کنید.')
    . '</div>'
    . '<div style="text-align:center;margin-top:24px">'
    . '<a href="' . e($appUrl) . '" class="btn btn-success" style="font-size:16px;padding:12px 36px">ورود به سامانه CRM صنعتی ←</a>'
    . '</div>';

echo renderCard('به‌روزرسانی موفق ✅', $body);
