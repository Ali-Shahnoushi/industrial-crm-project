<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function getSmsSettings(): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $username = Setting::get('melipayamak_username') ?: env('MELIPAYAMAK_USERNAME', '');
        $password = Setting::get('melipayamak_password') ?: env('MELIPAYAMAK_PASSWORD', '');
        $fromNumber = Setting::get('melipayamak_from') ?: env('MELIPAYAMAK_FROM', '');
        $sandbox = Setting::get('melipayamak_sandbox', 'true') === 'true';

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

    protected function authorizePermission(string $permission): void
    {
        $user = auth()->user();
        if (!$user || !$user->hasPermissionTo($permission)) {
            abort(403, "شما دسترسی لازم ({$permission}) برای این عملیات را ندارید.");
        }
    }
}
