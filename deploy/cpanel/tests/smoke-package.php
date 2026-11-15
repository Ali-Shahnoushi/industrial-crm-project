<?php
// Run ONLY against a disposable database via smoke-package.sh.
declare(strict_types=1);
[$script, $private, $public] = $argv;
require $private.'/vendor/autoload.php';
$app = require $private.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function check(bool $condition, string $message): void
{
    if (!$condition) {
        // Terminate explicitly: after $kernel->bootstrap() Laravel's exception
        // handler renders uncaught exceptions and the process exits 0, so
        // throwing here could never fail the smoke gate (or CI).
        fwrite(STDERR, "SMOKE FAIL: $message\n");
        exit(1);
    }
    echo "PASS: $message\n";
}

// Any unexpected exception/error below (e.g. firstOrFail() on a missing
// admin row) would otherwise be swallowed by Laravel's handler with exit 0,
// so the whole body runs inside try/catch as a second line of defence.
try {
check($app->publicPath() === $public, 'Separate public_path resolves before config load');
check(config('filesystems.disks.public.root') === $public.'/storage', 'Upload disk points to the external public directory');
foreach ([1, 2] as $attempt) {
    $code = Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    echo Illuminate\Support\Facades\Artisan::output();
    check($code === 0, "Migration run $attempt succeeds");
}
$admin = App\Models\User::where('email', 'admin@crm.local')->firstOrFail();
check($admin->isAdministrator(), 'Migrated administrator has administrator type');
check(!Illuminate\Support\Facades\Hash::check('Admin@123456', $admin->password), 'Installer migration does not expose the demo password');
$totalPerms = Spatie\Permission\Models\Permission::count();
check($totalPerms === 20 && $admin->getAllPermissions()->count() === $totalPerms, 'Administrator has all 20 direct permissions');
check(Illuminate\Support\Facades\Artisan::call('route:list', ['--except-vendor' => true]) === 0, 'Packaged application routes load');
check(Illuminate\Support\Facades\Storage::disk('public')->put('smoke.txt', 'upload test'), 'Public disk accepts an upload');
check(is_file($public.'/storage/smoke.txt'), 'Upload lands in external document root');
Illuminate\Support\Facades\Storage::disk('public')->delete('smoke.txt');
echo "Packaged Laravel smoke test passed.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'SMOKE FAIL (unexpected): '.get_class($e).': '.$e->getMessage()."\n");
    exit(1);
}
