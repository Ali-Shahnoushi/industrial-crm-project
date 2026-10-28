<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;

class UserController extends Controller
{
    public const PERMISSION_LABELS = [
        'customers.view' => 'مشاهده مشتریان',
        'customers.create' => 'ایجاد مشتری',
        'customers.edit' => 'ویرایش مشتری',
        'customers.delete' => 'حذف مشتری',
        'customers.import' => 'ورود گروهی با اکسل',
        'customers.export' => 'خروجی اکسل مشتریان',
        'parts.view' => 'مشاهده قطعات',
        'parts.manage' => 'مدیریت و ثبت قطعات',
        'parts.assign' => 'تخصیص قطعه به مشتری',
        'parts.history' => 'ثبت سوابق خدمات قطعات',
        'sms.send' => 'ارسال پیامک الگو',
        'sms.logs' => 'مشاهده سوابق پیامک',
        'users.manage' => 'مدیریت کاربران و دسترسی‌ها',
        'settings.manage' => 'مدیریت تنظیمات سیستم',
    ];

    public function index(): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $users = User::latest()->get()->map(function ($u) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'avatar' => $u->avatar,
                'avatar_url' => $u->avatar_url,
                'is_active' => $u->is_active,
                'created_at' => $u->created_at?->format('Y-m-d H:i'),
                'permissions' => $u->getAllPermissions()->pluck('name')->values()->all(),
            ];
        });

        return response()->json($users);
    }

    public function show(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar' => $user->avatar,
            'avatar_url' => $user->avatar_url,
            'is_active' => $user->is_active,
            'created_at' => $user->created_at?->format('Y-m-d H:i'),
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone',
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'is_active' => 'nullable|boolean',
            'avatar' => 'nullable|image|max:3072',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ], [
            'name.required' => 'نام و نام خانوادگی کاربر الزامی است.',
            'email.required' => 'آدرس ایمیل الزامی است.',
            'email.email' => 'فرمت آدرس ایمیل معتبر نیست.',
            'email.unique' => 'این ایمیل قبلاً در سیستم ثبت شده است.',
            'phone.regex' => 'شماره موبایل باید با 09 شروع شده و ۱۱ رقم عددی باشد.',
            'phone.unique' => 'این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است.',
            'password.required' => 'کلمه عبور الزامی است.',
            'password.min' => 'کلمه عبور باید حداقل ۸ کاراکتر باشد.',
            'password.regex' => 'کلمه عبور باید حداقل شامل یک حرف انگلیسی و یک عدد باشد.',
            'avatar.image' => 'فایل آواتار باید یک تصویر معتبر باشد.',
            'avatar.max' => 'حداکثر حجم تصویر ۳ مگابایت است.',
        ]);

        $avatarPath = null;
        if ($request->hasFile('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'avatar' => $avatarPath,
            'password' => Hash::make($validated['password']),
            'is_active' => $request->boolean('is_active', true),
        ]);

        if (!empty($validated['permissions'])) {
            $user->syncPermissions($validated['permissions']);
        }

        return response()->json([
            'message' => 'کاربر جدید با دسترسی‌های تعیین‌شده با موفقیت ایجاد شد.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url,
                'is_active' => $user->is_active,
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            ],
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone,' . $user->id,
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'is_active' => 'nullable|boolean',
            'avatar' => 'nullable|image|max:3072',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
        ], [
            'name.required' => 'نام و نام خانوادگی کاربر الزامی است.',
            'email.required' => 'آدرس ایمیل الزامی است.',
            'email.email' => 'فرمت آدرس ایمیل معتبر نیست.',
            'email.unique' => 'این ایمیل قبلاً در سیستم ثبت شده است.',
            'phone.regex' => 'شماره موبایل باید با 09 شروع شده و ۱۱ رقم عددی باشد.',
            'phone.unique' => 'این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است.',
            'password.min' => 'کلمه عبور باید حداقل ۸ کاراکتر باشد.',
            'password.regex' => 'کلمه عبور باید حداقل شامل یک حرف انگلیسی و یک عدد باشد.',
            'avatar.image' => 'فایل آواتار باید یک تصویر معتبر باشد.',
            'avatar.max' => 'حداکثر حجم تصویر ۳ مگابایت است.',
        ]);

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        if ($request->has('is_active')) {
            // Prevent self-deactivation
            if ($user->id !== auth()->id()) {
                $user->is_active = $request->boolean('is_active');
            }
        }

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        if ($request->boolean('remove_avatar') || $request->input('remove_avatar') === '1') {
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = null;
        } elseif ($request->hasFile('avatar')) {
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $request->file('avatar')->store('avatars', 'public');
        }

        $user->save();

        if ($request->has('permissions') || $request->has('sync_permissions')) {
            $user->syncPermissions($validated['permissions'] ?? []);
        }

        return response()->json([
            'message' => 'اطلاعات کاربر با موفقیت ویرایش شد.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url,
                'is_active' => $user->is_active,
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            ],
        ]);
    }

    public function destroy(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'امکان حذف حساب کاربری خودتان وجود ندارد.',
            ], 422);
        }

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $userName = $user->name;
        $user->syncPermissions([]);
        $user->delete();

        return response()->json([
            'message' => "کاربر «{$userName}» با موفقیت حذف گردید.",
        ]);
    }

    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $validated = $request->validate([
            'permissions' => 'present|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $user->syncPermissions($validated['permissions']);

        return response()->json([
            'message' => "مجوزهای کاربر «{$user->name}» با موفقیت بروزرسانی شد.",
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
        ]);
    }

    public function toggleActive(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'امکان تغییر وضعیت حساب کاربری خودتان وجود ندارد.',
            ], 422);
        }

        $user->update(['is_active' => !$user->is_active]);

        return response()->json([
            'message' => $user->is_active ? 'کاربر فعال شد.' : 'کاربر غیرفعال شد.',
            'is_active' => $user->is_active,
        ]);
    }

    public function availablePermissions(): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $permissions = Permission::where('guard_name', 'web')
            ->get()
            ->map(function ($p) {
                return [
                    'name' => $p->name,
                    'label' => self::PERMISSION_LABELS[$p->name] ?? $p->name,
                ];
            });

        return response()->json($permissions);
    }

    protected function authorizePermission(string $permission): void
    {
        $user = auth()->user();
        if (!$user || !$user->hasPermissionTo($permission)) {
            abort(403, "شما دسترسی لازم ({$permission}) برای این عملیات را ندارید.");
        }
    }
}
