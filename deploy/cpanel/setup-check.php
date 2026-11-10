<?php
/**
 * ─────────────────────────────────────────────────────────────
 *  بررسی محیط سرور برای استقرار و عیب‌یابی CRM روی cPanel
 *  آدرس: https://دامنه-شما/setup-check.php
 * ─────────────────────────────────────────────────────────────
 */
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

if (!defined('CRM_SKIP_PSR_EXIT')) {
    define('CRM_SKIP_PSR_EXIT', true);
}
$baseDir = require __DIR__ . '/resolve-private.php'; // Laravel root
$envPath = $baseDir . '/.env';
$envExists = is_file($envPath);

function envValue(string $file, string $key): ?string
{
    if (!is_file($file)) return null;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*' . preg_quote($key, '/') . '\s*=\s*(.*)$/', $line, $m)) {
            $v = trim($m[1]);
            if (preg_match('/^(["\'])(.*)\1$/', $v, $q)) $v = $q[2];
            return $v;
        }
    }
    return null;
}

$requiredExtensions = ['pdo_mysql', 'mbstring', 'openssl', 'fileinfo', 'curl', 'tokenizer', 'xml', 'ctype', 'json'];
$recommendedExtensions = ['gd', 'intl', 'zip', 'bcmath'];

$db = [
    'host'     => envValue($envPath, 'DB_HOST') ?: '127.0.0.1',
    'port'     => envValue($envPath, 'DB_PORT') ?: '3306',
    'database' => envValue($envPath, 'DB_DATABASE') ?: '',
    'username' => envValue($envPath, 'DB_USERNAME') ?: '',
    'password' => (string) envValue($envPath, 'DB_PASSWORD'),
];

$dbStatus = '—';
$dbMessage = '';
if ($envExists && $db['database'] && $db['database'] !== 'cpuser_crmdb') {
    try {
        $pdo = new PDO(
            "mysql:host={$db['host']};port={$db['port']};dbname={$db['database']};charset=utf8mb4",
            $db['username'],
            $db['password'],
            [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $count = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = " . $pdo->quote($db['database']))->fetchColumn();
        $dbStatus = 'ok';
        $dbMessage = "اتصال موفق — تعداد جداول: {$count}";
    } catch (Throwable $e) {
        $dbStatus = 'fail';
        $dbMessage = $e->getMessage();
    }
} elseif ($envExists) {
    $dbStatus = 'warn';
    $dbMessage = 'هنوز مشخصات دیتابیس در .env تنظیم نشده است.';
}

function row(string $label, string $status, string $detail = ''): string
{
    $icon = $status === 'ok' ? '✅' : ($status === 'warn' ? '⚠️' : ($status === 'fail' ? '❌' : 'ℹ️'));
    $color = $status === 'ok' ? '#16a34a' : ($status === 'warn' ? '#d97706' : ($status === 'fail' ? '#dc2626' : '#6b7280'));
    return '<tr><td style="padding:10px 14px;border-bottom:1px solid #334155">' . htmlspecialchars($label) . '</td>'
        . '<td style="padding:10px 14px;border-bottom:1px solid #334155;color:' . $color . ';white-space:nowrap;font-weight:bold">' . $icon . ' ' . htmlspecialchars($status) . '</td>'
        . '<td style="padding:10px 14px;border-bottom:1px solid #334155;direction:ltr;text-align:left;font-size:12px;color:#94a3b8;font-family:monospace">' . htmlspecialchars($detail) . '</td></tr>';
}
?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بررسی محیط سرور — Industrial CRM</title>
<style>
body { font-family: Tahoma, Vazirmatn, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 32px 16px; }
.card { max-width: 820px; margin: auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
.hd { background: #090d16; color: #fff; padding: 20px 24px; border-bottom: 1px solid #334155; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { background: #090d16; padding: 12px 14px; text-align: right; color: #94a3b8; border-bottom: 1px solid #334155; }
.btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; }
</style>
</head>
<body>
<div class="card">
  <div class="hd">
    <b style="font-size:18px">🏭 بررسی وضعیت محیط سرور — Industrial CRM</b>
    <div style="font-size:12px;color:#94a3b8;margin-top:6px">پس از تکمیل عیب‌یابی و استقرار، این فایل (setup-check.php) را از پوشه public حذف کنید.</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>بررسی</th><th>وضعیت</th><th>جزئیات</th>
      </tr>
    </thead>
    <tbody>
      <?php
      echo row('نسخه PHP (حداقل 8.2 — پیشنهادی 8.4+)', version_compare(PHP_VERSION, '8.2.0', '>=') ? 'ok' : 'fail', PHP_VERSION);
      $nativePsr = extension_loaded('psr') || interface_exists('PsrExt\\Log\\LoggerInterface', false)
          || interface_exists('Psr\\Log\\LoggerInterface', false);
      echo row('عدم تداخل افزونه بومی psr/PsrExt', $nativePsr ? 'fail' : 'ok', $nativePsr
          ? 'افزونه psr را در Select PHP Version غیرفعال کنید؛ با Monolog تداخل دارد.' : 'بدون تداخل');
      foreach ($requiredExtensions as $ext) {
          echo row('افزونه PHP: ' . $ext, extension_loaded($ext) ? 'ok' : 'fail', extension_loaded($ext) ? 'فعال' : 'در MultiPHP / Select PHP Version فعال کنید');
      }
      foreach ($recommendedExtensions as $ext) {
          echo row('افزونه پیشنهادی: ' . $ext, extension_loaded($ext) ? 'ok' : 'warn', extension_loaded($ext) ? 'فعال' : 'اختیاری');
      }
      echo row('مسیر فایل‌های خصوصی (Private Directory)', is_dir($baseDir) ? 'ok' : 'fail', $baseDir);
      echo row('وجود پکیج‌های لاراول (vendor)', is_file($baseDir . '/vendor/autoload.php') ? 'ok' : 'fail', is_file($baseDir . '/vendor/autoload.php') ? 'کامل' : 'پوشه vendor یافت نشد');
      echo row('وجود فایل .env', $envExists ? 'ok' : 'warn', $envExists ? 'موجود' : 'یافت نشد');
      foreach (['storage', 'storage/app', 'storage/framework', 'storage/framework/sessions', 'storage/framework/cache', 'storage/framework/views', 'storage/logs', 'bootstrap/cache'] as $dir) {
          $p = $baseDir . '/' . $dir;
          echo row('دسترسی نوشتن: ' . $dir, (is_dir($p) && is_writable($p)) ? 'ok' : 'fail', $p);
      }
      echo row('اتصال دیتابیس MySQL', $dbStatus, $dbMessage);
      echo row('APP_KEY امنیتی', envValue($envPath, 'APP_KEY') ? 'ok' : 'warn', envValue($envPath, 'APP_KEY') ? 'تنظیم شده' : 'تنظیم نشده');
      ?>
    </tbody>
  </table>
  <div style="padding:16px 24px;background:#090d16;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #334155">
    <span>اگر همه موارد سبز هستند، محیط هاست شما کاملاً آماده است. 🎉</span>
    <a href="update.php" class="btn">ورود به فرم به‌روزرسانی (update.php) ←</a>
  </div>
</div>
</body>
</html>
