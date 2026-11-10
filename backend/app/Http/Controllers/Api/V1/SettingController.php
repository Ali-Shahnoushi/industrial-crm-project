<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\PermissionRegistrar;

class SettingController extends Controller
{
    public function getSmsSettings(): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $username = Setting::get('melipayamak_username') ?: env('MELIPAYAMAK_USERNAME', '');
        $password = Setting::get('melipayamak_password') ?: env('MELIPAYAMAK_PASSWORD', '');
        $fromNumber = Setting::get('melipayamak_from') ?: env('MELIPAYAMAK_FROM', '');
        $rawSandbox = Setting::get('melipayamak_sandbox');
        $sandbox = $rawSandbox !== null
            ? filter_var($rawSandbox, FILTER_VALIDATE_BOOLEAN)
            : filter_var(env('MELIPAYAMAK_SANDBOX', true), FILTER_VALIDATE_BOOLEAN);

        return response()->json([
            'melipayamak_username' => $username,
            'melipayamak_has_password' => !empty($password),
            'melipayamak_from' => $fromNumber,
            'melipayamak_sandbox' => $sandbox,
        ]);
    }

    public function updateSmsSettings(Request $request): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $validated = $request->validate([
            'melipayamak_username' => 'nullable|string|max:100',
            'melipayamak_password' => 'nullable|string|max:100',
            'melipayamak_from' => 'nullable|string|max:50',
            'melipayamak_sandbox' => 'required|boolean',
        ]);

        if (isset($validated['melipayamak_username'])) {
            Setting::set('melipayamak_username', $validated['melipayamak_username']);
        }

        if (!empty($validated['melipayamak_password'])) {
            Setting::set('melipayamak_password', $validated['melipayamak_password'], true);
        }

        if (isset($validated['melipayamak_from'])) {
            Setting::set('melipayamak_from', $validated['melipayamak_from']);
        }

        Setting::set('melipayamak_sandbox', $validated['melipayamak_sandbox'] ? 'true' : 'false');

        return response()->json([
            'message' => 'تنظیمات سامانه ملی‌پیامک با موفقیت ذخیره شد.',
        ]);
    }

    public function getCompanySettings(): JsonResponse
    {
        $companyName = Setting::get('company_name');
        $companyLogoPath = Setting::get('company_logo');
        $companyLogoUrl = null;

        if ($companyLogoPath && Storage::disk('public')->exists($companyLogoPath)) {
            $companyLogoUrl = '/storage/' . ltrim($companyLogoPath, '/');
        }

        return response()->json([
            'company_name' => $companyName ?: null,
            'company_logo_url' => $companyLogoUrl,
            'app_version' => config('app.version', '2.3.0'),
        ]);
    }

    public function updateCompanySettings(Request $request): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $callingUser = auth()->user();
        if (!$callingUser || !$callingUser->isAdministrator()) {
            abort(403, 'فقط مدیران ارشد می‌توانند تنظیمات شرکت را ویرایش کنند.');
        }

        $validated = $request->validate([
            'company_name' => 'nullable|string|max:100',
            'company_logo' => 'nullable|image|max:2048',
        ]);

        if (array_key_exists('company_name', $validated)) {
            Setting::set('company_name', $validated['company_name'] ?? '');
        }

        if ($request->input('remove_logo') === '1') {
            $existingLogo = Setting::get('company_logo');
            if ($existingLogo && Storage::disk('public')->exists($existingLogo)) {
                Storage::disk('public')->delete($existingLogo);
            }
            Setting::set('company_logo', '');
        } elseif ($request->hasFile('company_logo')) {
            $existingLogo = Setting::get('company_logo');
            if ($existingLogo && Storage::disk('public')->exists($existingLogo)) {
                Storage::disk('public')->delete($existingLogo);
            }
            $logoPath = $request->file('company_logo')->store('logos', 'public');
            Setting::set('company_logo', $logoPath);
        }

        $companyLogoPath = Setting::get('company_logo');
        $companyLogoUrl = null;
        if ($companyLogoPath && Storage::disk('public')->exists($companyLogoPath)) {
            $companyLogoUrl = '/storage/' . ltrim($companyLogoPath, '/');
        }

        return response()->json([
            'message' => 'تنظیمات برندینگ شرکت با موفقیت ذخیره شد.',
            'company_name' => Setting::get('company_name') ?: null,
            'company_logo_url' => $companyLogoUrl,
            'app_version' => config('app.version', '2.3.0'),
        ]);
    }

    /**
     * Run safe pending database migrations & clear caches directly from Web UI (cPanel no-SSH helper).
     */
    public function upgradeSystem(): JsonResponse
    {
        $callingUser = auth()->user();
        if (!$callingUser || !$callingUser->isAdministrator()) {
            abort(403, 'فقط مدیر ارشد سامانه مجاز به اجرای عملیات ارتقای پایگاه داده است.');
        }

        Artisan::call('migrate', ['--force' => true]);
        $migrateOutput = trim(Artisan::output());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Setting::set('app_version', config('app.version', '2.3.0'));
        Artisan::call('optimize:clear');

        return response()->json([
            'message' => 'ارتقای ساختار پایگاه داده (Zero Data Loss) و پاکسازی کش سامانه با موفقیت انجام شد.',
            'version' => config('app.version', '2.3.0'),
            'output' => $migrateOutput,
        ]);
    }
}
