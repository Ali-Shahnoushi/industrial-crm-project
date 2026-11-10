<?php
/**
 * Industrial CRM — Smart Private Path Resolver for cPanel and Multi-environment deployments.
 * Shared by index.php, update.php, install.php, and cPanel maintenance tools.
 * Never uses raw client/request input for security.
 */

// ۱. بررسی زودهنگام تداخل افزونه بومی psr سرور (قبل از لود شدن vendor)
// نکته: install.php و setup-check.php خودشان جدول بررسی پیش‌نیازها را رندر می‌کنند (CRM_SKIP_PSR_EXIT)
if (!defined('CRM_SKIP_PSR_EXIT') && (extension_loaded('psr') || interface_exists('PsrExt\\SimpleCache\\CacheInterface', false) || interface_exists('PsrExt\\Log\\LoggerInterface', false))) {
    http_response_code(500);
    $isApi = (!empty($_SERVER['REQUEST_URI']) && str_contains($_SERVER['REQUEST_URI'], '/api/'))
        || (!empty($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json'));
    
    if ($isApi) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'message' => 'خطای سرور: افزونه بومی psr روی هاست فعال است و با PHP 8.4 تداخل دارد. لطفاً از cPanel بخش Select PHP Version افزونه psr را غیرفعال کنید.',
            'error_code' => 'NATIVE_PSR_EXTENSION_CONFLICT'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!doctype html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>تداخل افزونه سرور psr — Industrial CRM</title>
        <style>
            body { font-family: Tahoma, Vazirmatn, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 16px; line-height: 1.6; margin: 0; }
            .box { max-width: 760px; margin: auto; background: #1e293b; border: 1px solid #ef4444; border-radius: 16px; padding: 26px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #f87171; margin-top: 0; font-size: 20px; }
            .step { background: #090d16; border-right: 4px solid #38bdf8; padding: 14px 18px; border-radius: 8px; margin: 16px 0; font-size: 14px; }
            ol { margin: 10px 0; padding-right: 20px; }
            li { margin-bottom: 8px; }
            b { color: #38bdf8; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>⚠️ تداخل افزونه بومی psr روی سرور (PHP Native Extension Conflict)</h2>
            <p>علت خطای ۵۰۰ یا سفید شدن صفحه: افزونه C-level به نام <b>psr</b> روی نسخه PHP هاست شما فعال است که با پکیج‌های PHP 8.4 لاراول (از جمله Maatwebsite Excel و Monolog) تداخل ساختاری دارد.</p>
            <div class="step">
                <b>💡 راه حل فوری در کمتر از ۳۰ ثانیه:</b>
                <ol>
                    <li>وارد کنترل پنل <b>cPanel</b> هاست خود شوید.</li>
                    <li>به بخش <b>Select PHP Version</b> (یا PHP Selector) بروید.</li>
                    <li>تب <b>Extensions</b> را انتخاب کنید.</li>
                    <li>در لیست ماژول‌ها، تیک افزونه <b>psr</b> را بردارید (غیرفعال کنید).</li>
                    <li>این صفحه را مجدداً رفرش کنید. تمام خطاها برطرف می‌شوند.</li>
                </ol>
            </div>
            <p style="font-size: 13px; color: #94a3b8;">
                نکته: پکیج‌های داخلی لاراول نیازی به افزونه psr ندارند و خودشان استاندارد PSR را به طور مستقل اجرا می‌کنند.
            </p>
        </div>
    </body>
    </html>
    <?php
    exit;
}

function _resolveLaravelPrivateDir(): string
{
    $candidates = [];

    // 1. Path from private-path.php (if exists)
    $configPath = __DIR__ . '/private-path.php';
    $raw = null;
    if (is_file($configPath)) {
        try {
            $raw = require $configPath;
        } catch (\Throwable $t) {
            $raw = null;
        }
        if (is_string($raw) && trim($raw) !== '') {
            $trimmed = trim($raw);
            $candidates[] = $trimmed;
            // If user entered relative path or omitted /home/user prefix:
            $candidates[] = __DIR__ . '/' . ltrim($trimmed, '/\\');
            $candidates[] = dirname(__DIR__) . '/' . ltrim($trimmed, '/\\');
            if (!empty($_SERVER['DOCUMENT_ROOT'])) {
                $candidates[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/' . ltrim($trimmed, '/\\');
                $candidates[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')) . '/' . ltrim($trimmed, '/\\');
            }
            if (!empty($_SERVER['HOME'])) {
                $candidates[] = rtrim($_SERVER['HOME'], '/\\') . '/' . ltrim($trimmed, '/\\');
            }
        }
    }

    // 2. Standard directory structures on cPanel and local environments
    $candidates[] = dirname(__DIR__); // Local laravel root
    $candidates[] = dirname(__DIR__) . '/laravel_project/crmpart'; // Exact cPanel path for diswebir!
    $candidates[] = dirname(__DIR__) . '/laravel_project/crmp';
    $candidates[] = dirname(dirname(__DIR__)) . '/laravel_project/crmpart';
    $candidates[] = dirname(dirname(__DIR__)) . '/laravel_project/crmp';
    $candidates[] = dirname(__DIR__) . '/crmpart';
    $candidates[] = dirname(__DIR__) . '/crmp';
    $candidates[] = dirname(__DIR__) . '/crm_core';
    $candidates[] = dirname(__DIR__) . '/crm_private';
    $candidates[] = dirname(__DIR__) . '/backend';
    $candidates[] = dirname(__DIR__) . '/private';
    
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
        $homeDir = dirname($docRoot);
        $candidates[] = $homeDir . '/laravel_project/crmpart';
        $candidates[] = $homeDir . '/laravel_project/crmp';
        $candidates[] = $homeDir . '/crmpart';
        $candidates[] = $homeDir . '/crmp';
        $candidates[] = $homeDir . '/crm_core';
        $candidates[] = $homeDir . '/crm_private';
        $candidates[] = $docRoot . '/../laravel_project/crmpart';
        $candidates[] = $docRoot . '/../laravel_project/crmp';
    }

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || $candidate === '') continue;
        $real = realpath($candidate);
        if ($real && is_file($real . '/bootstrap/app.php')) {
            return $real;
        }
    }

    // If still not found, render an informative diagnostic card rather than a blank 503
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!doctype html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>خطای پیکربندی مسیر خصوصی لاراول</title>
        <style>
            body { font-family: Tahoma, Vazirmatn, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; line-height: 1.6; margin: 0; }
            .box { max-width: 760px; margin: auto; background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 26px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
            h2 { color: #f87171; margin-top: 0; font-size: 20px; }
            code { background: #090d16; color: #38bdf8; padding: 3px 8px; border-radius: 6px; font-family: monospace; direction: ltr; display: inline-block; }
            pre { background: #090d16; color: #a5f3fc; padding: 14px; border-radius: 8px; direction: ltr; text-align: left; overflow: auto; font-size: 13px; }
            .tip { background: #1e3a8a; border-right: 4px solid #60a5fa; padding: 12px; border-radius: 6px; margin: 15px 0; font-size: 13px; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>⚠️ مسیر فایل‌های هسته لاراول (Private Path) پیدا نشد</h2>
            <p>سامانه نتوانست فایل <code>bootstrap/app.php</code> را در مسیر‌های تعریف‌شده پیدا کند.</p>
            <div class="tip">
                <b>مسیر پوشه عمومی فعلی شما (Public Directory):</b><br>
                <code><?= htmlspecialchars(__DIR__) ?></code>
            </div>
            <p>لطفاً فایل <code>private-path.php</code> را در همین پوشه عمومی باز کنید و مسیر کامل پوشه فایل‌های خصوصی لاراول را در آن قرار دهید:</p>
            <pre>&lt;?php
return '<?= htmlspecialchars(dirname(__DIR__) . '/laravel_project/crmpart') ?>';</pre>
            <p style="font-size: 13px; color: #94a3b8;">
                مقدار خوانده‌شده از فایل private-path.php: <code><?= htmlspecialchars((string)($raw ?? 'تنظیم نشده یا نامعتبر')) ?></code>
            </p>
        </div>
    </body>
    </html>
    <?php
    exit;
}

$privatePath = _resolveLaravelPrivateDir();
$_SERVER['APP_PUBLIC_PATH'] = __DIR__;
return $privatePath;
