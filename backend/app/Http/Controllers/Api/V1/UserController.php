<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public const PERMISSION_LABELS = [
        'customers.view' => 'مشاهده مشتریان',
        'customers.create' => 'ایجاد مشتری',
        'customers.edit' => 'ویرایش مشتری',
        'customers.delete' => 'حذف مشتری',
        'customers.import' => 'ورود گروهی مشتریان با اکسل',
        'customers.export' => 'خروجی اکسل مشتریان و دستگاه‌ها',
        'parts.view' => 'مشاهده کاتالوگ دستگاه‌ها و موجودی انبار',
        'parts.manage' => 'تعریف دستگاه و ثبت ورود/خروج انبار',
        'parts.assign' => 'تخصیص، ویرایش و حذف دستگاه مشتری',
        'parts.history' => 'ثبت سوابق نصب، سرویس و تعمیرات دستگاه‌ها',
        'sms.send' => 'ارسال پیامک الگو',
        'sms.logs' => 'مشاهده سوابق پیامک',
        'users.manage' => 'مدیریت کارمندان، نقش‌ها و دسترسی‌ها',
        'settings.manage' => 'مدیریت تنظیمات سیستم',
    ];

    public function availableRoles(): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $callingUser = auth()->user();
        $isAdmin = $callingUser && $callingUser->isAdministrator();

        $roles = [
            [
                'key' => User::ROLE_SALESPERSON,
                'label' => 'کارمند فروش (Salesperson)',
                'description' => 'ثبت مشتری جدید و فروش/تخصیص دستگاه؛ به صورت پیش‌فرض فقط مشتریان ثبت‌شده توسط خودش را می‌بیند.',
                'default_customer_scope' => User::SCOPE_OWN,
                'default_permissions' => User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_SALESPERSON],
            ],
            [
                'key' => User::ROLE_INSTALLER,
                'label' => 'نصاب (Installer)',
                'description' => 'مشاهده دستگاه‌های مشتریان، ثبت تحویل/نصب و ثبت سوابق سرویس و تعمیرات فنی.',
                'default_customer_scope' => User::SCOPE_ALL,
                'default_permissions' => User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_INSTALLER],
            ],
            [
                'key' => User::ROLE_MANAGER,
                'label' => 'مدیر / سرپرست (Manager)',
                'description' => 'کاربر مدیریتی و عملیاتی با دسترسی گسترده به مشتریان، انبار دستگاه‌ها و گزارش‌ها.',
                'default_customer_scope' => User::SCOPE_ALL,
                'default_permissions' => User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_MANAGER],
            ],
        ];

        if ($isAdmin) {
            $roles[] = [
                'key' => User::ROLE_ADMINISTRATOR,
                'label' => 'مدیر ارشد (Administrator)',
                'description' => 'دسترسی کامل به کل سامانه، مدیریت کارمندان، تنظیمات برندینگ و ارتقای سیستم.',
                'default_customer_scope' => User::SCOPE_ALL,
                'default_permissions' => User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_ADMINISTRATOR],
            ];
        }

        return response()->json($roles);
    }

    public function index(): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $callingUser = auth()->user();
        $query = User::latest();

        if ($callingUser && !$callingUser->isAdministrator()) {
            $query->where(function ($q) {
                $q->where('user_type', '!=', User::ROLE_ADMINISTRATOR)
                    ->orWhereNull('user_type');
            });
        }

        $users = $query->get()->map(fn (User $u) => $u->serializeForApi());

        return response()->json($users);
    }

    public function show(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $callingUser = auth()->user();
        if ($user->isAdministrator() && (!$callingUser || !$callingUser->isAdministrator())) {
            abort(403, 'مدیران عادی دسترسی به اطلاعات حساب مدیر ارشد را ندارند.');
        }

        return response()->json($user->serializeForApi());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('users.manage');

        if ($request->has('phone')) {
            $normPhone = trim((string) $this->normalizeDigits($request->input('phone')));
            $request->merge(['phone' => $normPhone !== '' ? $normPhone : null]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone',
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'is_active' => 'nullable|boolean',
            'avatar' => 'nullable|image|max:3072',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
            'user_type' => 'nullable|in:administrator,manager,salesperson,installer',
            'customer_scope' => 'nullable|in:own,selected,all',
            'granted_staff_ids' => 'nullable|array',
            'granted_staff_ids.*' => 'integer|exists:users,id',
            'granted_customer_ids' => 'nullable|array',
            'granted_customer_ids.*' => 'integer|exists:customers,id',
        ], [
            'name.required' => 'نام و نام خانوادگی کارمند الزامی است.',
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

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $requestedType = $validated['user_type'] ?? User::ROLE_SALESPERSON;
        if ($requestedType === User::ROLE_ADMINISTRATOR && (!$callingUser || !$callingUser->isAdministrator())) {
            $resolvedType = User::ROLE_MANAGER;
        } else {
            $resolvedType = $requestedType;
        }

        $defaultScope = $resolvedType === User::ROLE_SALESPERSON ? User::SCOPE_OWN : User::SCOPE_ALL;
        $resolvedScope = $resolvedType === User::ROLE_ADMINISTRATOR
            ? User::SCOPE_ALL
            : ($validated['customer_scope'] ?? $defaultScope);

        if ($callingUser && $callingUser->hasRestrictedCustomerScope() && $resolvedScope === User::SCOPE_ALL) {
            $resolvedScope = User::SCOPE_OWN;
        }

        $avatarPath = null;
        if ($request->hasFile('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        $user = DB::transaction(function () use ($validated, $request, $avatarPath, $resolvedType, $resolvedScope, $callingUser) {
            $created = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'avatar' => $avatarPath,
                'password' => Hash::make($validated['password']),
                'is_active' => $request->boolean('is_active', true),
                'user_type' => $resolvedType,
                'customer_scope' => $resolvedScope,
            ]);

            $this->syncSpatieRole($created, $resolvedType);

            $requestedPerms = $validated['permissions'] ?? (User::ROLE_DEFAULT_PERMISSIONS[$resolvedType] ?? []);
            if ($callingUser && !$callingUser->isAdministrator()) {
                $callerPerms = $callingUser->getAllPermissions()->pluck('name')->all();
                $requestedPerms = array_values(array_intersect($requestedPerms, $callerPerms));
            }
            $created->syncPermissions($requestedPerms);

            $this->syncCustomerGrants(
                $created,
                $resolvedScope,
                $validated['granted_staff_ids'] ?? [],
                $validated['granted_customer_ids'] ?? []
            );

            return $created;
        });

        return response()->json([
            'message' => 'کارمند جدید با نقش و سطح دسترسی تعیین‌شده با موفقیت ایجاد شد.',
            'user' => $user->serializeForApi(),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        if ($user->isAdministrator() && (!$callingUser || !$callingUser->isAdministrator())) {
            abort(403, 'مدیران عادی امکان ویرایش حساب مدیر ارشد را ندارند.');
        }

        if ($request->has('phone')) {
            $normPhone = trim((string) $this->normalizeDigits($request->input('phone')));
            $request->merge(['phone' => $normPhone !== '' ? $normPhone : null]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone,' . $user->id,
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'is_active' => 'nullable|boolean',
            'avatar' => 'nullable|image|max:3072',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string|exists:permissions,name',
            'user_type' => 'nullable|in:administrator,manager,salesperson,installer',
            'customer_scope' => 'nullable|in:own,selected,all',
            'granted_staff_ids' => 'nullable|array',
            'granted_staff_ids.*' => 'integer|exists:users,id',
            'granted_customer_ids' => 'nullable|array',
            'granted_customer_ids.*' => 'integer|exists:customers,id',
        ], [
            'name.required' => 'نام و نام خانوادگی کارمند الزامی است.',
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

        DB::transaction(function () use ($request, $user, $validated, $callingUser) {
            $user->name = $validated['name'];
            $user->email = $validated['email'];
            if (array_key_exists('phone', $validated)) {
                $user->phone = $validated['phone'];
            }

            if ($request->has('is_active') && $user->id !== auth()->id()) {
                $user->is_active = $request->boolean('is_active');
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

            if ($request->has('user_type') && !empty($validated['user_type'])) {
                $requestedType = $validated['user_type'];
                if ($user->email === 'admin@crm.local') {
                    $user->user_type = User::ROLE_ADMINISTRATOR;
                } elseif ($requestedType === User::ROLE_ADMINISTRATOR && (!$callingUser || !$callingUser->isAdministrator())) {
                    // Non-admins cannot promote to administrator
                } else {
                    $user->user_type = $requestedType;
                }
            }

            if ($user->isAdministrator()) {
                $user->customer_scope = User::SCOPE_ALL;
            } elseif ($request->has('customer_scope') && !empty($validated['customer_scope'])) {
                $requestedScope = $validated['customer_scope'];
                if ($callingUser && $callingUser->hasRestrictedCustomerScope() && $requestedScope === User::SCOPE_ALL) {
                    $requestedScope = User::SCOPE_OWN;
                }
                $user->customer_scope = $requestedScope;
            }

            $user->save();
            $this->syncSpatieRole($user, $user->user_type ?: User::ROLE_MANAGER);

            if ($request->has('permissions') || $request->has('sync_permissions')) {
                $requestedPerms = $validated['permissions'] ?? [];
                if ($callingUser && !$callingUser->isAdministrator()) {
                    $callerPerms = $callingUser->getAllPermissions()->pluck('name')->all();
                    $targetExistingPerms = $user->getAllPermissions()->pluck('name')->all();

                    $preservedPerms = array_diff($targetExistingPerms, $callerPerms);
                    $grantedInScope = array_intersect($requestedPerms, $callerPerms);

                    $finalPerms = array_values(array_unique(array_merge($preservedPerms, $grantedInScope)));
                    $user->syncPermissions($finalPerms);
                } else {
                    $user->syncPermissions($requestedPerms);
                }
            }

            if (
                $request->has('sync_customer_grants') ||
                $request->has('granted_staff_ids') ||
                $request->has('granted_customer_ids') ||
                $request->has('customer_scope')
            ) {
                $staffIds = $request->has('granted_staff_ids') || $request->has('sync_customer_grants')
                    ? ($validated['granted_staff_ids'] ?? [])
                    : $user->grantedStaff()->pluck('users.id')->all();

                $customerIds = $request->has('granted_customer_ids') || $request->has('sync_customer_grants')
                    ? ($validated['granted_customer_ids'] ?? [])
                    : $user->grantedCustomers()->pluck('customers.id')->all();

                $this->syncCustomerGrants($user, $user->effectiveCustomerScope(), $staffIds, $customerIds);
            }
        });

        return response()->json([
            'message' => 'اطلاعات، نقش و دسترسی‌های کارمند با موفقیت ویرایش شد.',
            'user' => $user->fresh()->serializeForApi(),
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

        if ($user->email === 'admin@crm.local') {
            return response()->json([
                'message' => 'امکان حذف حساب مدیر اصلی سیستم وجود ندارد.',
            ], 422);
        }

        $callingUser = auth()->user();
        if ($user->isAdministrator() && (!$callingUser || !$callingUser->isAdministrator())) {
            return response()->json([
                'message' => 'مدیران عادی امکان حذف حساب مدیر ارشد را ندارند.',
            ], 403);
        }

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $userName = $user->name;
        $user->syncPermissions([]);
        $user->syncRoles([]);
        $user->delete();

        return response()->json([
            'message' => "کاربر «{$userName}» با موفقیت حذف گردید.",
        ]);
    }

    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        if ($user->isAdministrator() && (!$callingUser || !$callingUser->isAdministrator())) {
            abort(403, 'مدیران عادی امکان تغییر دسترسی‌های مدیر ارشد را ندارند.');
        }

        $validated = $request->validate([
            'permissions' => 'present|array',
            'permissions.*' => 'string|exists:permissions,name',
            'user_type' => 'nullable|in:administrator,manager,salesperson,installer',
            'customer_scope' => 'nullable|in:own,selected,all',
            'granted_staff_ids' => 'nullable|array',
            'granted_staff_ids.*' => 'integer|exists:users,id',
            'granted_customer_ids' => 'nullable|array',
            'granted_customer_ids.*' => 'integer|exists:customers,id',
        ]);

        DB::transaction(function () use ($request, $user, $validated, $callingUser) {
            if ($request->filled('user_type')) {
                $requestedType = $validated['user_type'];
                if ($user->email === 'admin@crm.local') {
                    $user->user_type = User::ROLE_ADMINISTRATOR;
                } elseif ($requestedType !== User::ROLE_ADMINISTRATOR || ($callingUser && $callingUser->isAdministrator())) {
                    $user->user_type = $requestedType;
                }
            }

            if ($user->isAdministrator()) {
                $user->customer_scope = User::SCOPE_ALL;
            } elseif ($request->filled('customer_scope')) {
                $requestedScope = $validated['customer_scope'];
                if ($callingUser && $callingUser->hasRestrictedCustomerScope() && $requestedScope === User::SCOPE_ALL) {
                    $requestedScope = User::SCOPE_OWN;
                }
                $user->customer_scope = $requestedScope;
            }

            $user->save();
            $this->syncSpatieRole($user, $user->user_type ?: User::ROLE_MANAGER);

            $requestedPerms = $validated['permissions'];
            if ($callingUser && !$callingUser->isAdministrator()) {
                $callerPerms = $callingUser->getAllPermissions()->pluck('name')->all();
                $targetExistingPerms = $user->getAllPermissions()->pluck('name')->all();

                $preservedPerms = array_diff($targetExistingPerms, $callerPerms);
                $grantedInScope = array_intersect($requestedPerms, $callerPerms);

                $finalPerms = array_values(array_unique(array_merge($preservedPerms, $grantedInScope)));
                $user->syncPermissions($finalPerms);
            } else {
                $user->syncPermissions($requestedPerms);
            }

            if ($request->has('granted_staff_ids') || $request->has('granted_customer_ids') || $request->has('customer_scope')) {
                $staffIds = $request->has('granted_staff_ids')
                    ? ($validated['granted_staff_ids'] ?? [])
                    : $user->grantedStaff()->pluck('users.id')->all();

                $customerIds = $request->has('granted_customer_ids')
                    ? ($validated['granted_customer_ids'] ?? [])
                    : $user->grantedCustomers()->pluck('customers.id')->all();

                $this->syncCustomerGrants($user, $user->effectiveCustomerScope(), $staffIds, $customerIds);
            }
        });

        return response()->json([
            'message' => "نقش، محدوده مشتریان و مجوزهای «{$user->name}» با موفقیت بروزرسانی شد.",
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'user' => $user->fresh()->serializeForApi(),
        ]);
    }

    public function toggleActive(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $callingUser = auth()->user();
        if ($user->isAdministrator() && (!$callingUser || !$callingUser->isAdministrator())) {
            return response()->json([
                'message' => 'مدیران عادی امکان تغییر وضعیت حساب مدیر ارشد را ندارند.',
            ], 403);
        }

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

        $callingUser = auth()->user();
        $query = Permission::where('guard_name', 'web');

        if ($callingUser && !$callingUser->isAdministrator()) {
            $callerPerms = $callingUser->getAllPermissions()->pluck('name')->all();
            $query->whereIn('name', $callerPerms);
        }

        $permissions = $query
            ->get()
            ->map(function ($p) {
                return [
                    'name' => $p->name,
                    'label' => self::PERMISSION_LABELS[$p->name] ?? $p->name,
                ];
            });

        return response()->json($permissions);
    }

    protected function syncSpatieRole(User $user, string $roleName): void
    {
        if (!Schema::hasTable('roles')) {
            return;
        }

        $role = Role::firstOrCreate([
            'name' => $roleName,
            'guard_name' => 'web',
        ]);

        $user->syncRoles([$role]);
    }

    protected function syncCustomerGrants(User $user, string $scope, array $staffIds, array $customerIds): void
    {
        if (!Schema::hasTable('user_customer_staff_grants') || !Schema::hasTable('user_customer_grants')) {
            return;
        }

        if ($scope === User::SCOPE_ALL) {
            $user->grantedStaff()->sync([]);
            $user->grantedCustomers()->sync([]);
            return;
        }

        $cleanStaffIds = array_values(array_unique(array_filter(
            array_map('intval', $staffIds),
            fn (int $id) => $id > 0 && $id !== (int) $user->id
        )));

        $cleanCustomerIds = array_values(array_unique(array_filter(
            array_map('intval', $customerIds),
            fn (int $id) => $id > 0
        )));

        $user->grantedStaff()->sync($cleanStaffIds);
        $user->grantedCustomers()->sync($cleanCustomerIds);
    }
}
