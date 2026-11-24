<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Support\SessionManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct(protected SessionManager $sessionManager)
    {
    }

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
        'tickets.view' => 'مشاهده تیکت‌ها و درخواست‌های پشتیبانی/تعمیر',
        'tickets.reply' => 'ثبت تیکت، پاسخگویی و یادداشت داخلی تیکت‌ها',
        'tickets.manage' => 'مدیریت کامل تیکت‌ها (تغییر کارشناس، دپارتمان و وضعیت)',
        'sales.view' => 'مشاهده فروش‌ها، نمودارها، فاکتورها و خروجی اکسل فروش',
        'sales.create' => 'ثبت فروش، ویرایش مبالغ و صدور فاکتور',
        'sales.manage' => 'مدیریت کامل فروش و مالی (لغو فروش و ابطال فاکتور)',
        'sms.send' => 'ارسال پیامک الگو',
        'sms.logs' => 'مشاهده سوابق پیامک',
        'users.manage' => 'مدیریت کارمندان، نقش‌ها و دسترسی‌ها',
        'users.sessions' => 'مشاهده نشست‌های فعال و خروج اجباری کاربران',
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
        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        if (!$callingUser || (!$callingUser->hasSafePermission('users.manage') && !$callingUser->hasSafePermission('users.sessions'))) {
            abort(403, 'شما دسترسی لازم برای مشاهده فهرست کارمندان را ندارید.');
        }

        $query = User::staffOnly()->latest();

        if (Schema::hasTable('personal_access_tokens')) {
            $query->withCount(['tokens as active_sessions_count' => function ($q) {
                $q->where(function ($exp) {
                    $exp->whereNull('expires_at')->orWhere('expires_at', '>', now());
                })->where('created_at', '>=', now()->subDays(30));
            }]);
        }

        if (!$callingUser->isAdministrator()) {
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
        $requestedType = $validated['user_type']
            ?? ($request->filled('role') ? (string) $request->input('role') : null)
            ?? User::ROLE_SALESPERSON;

        if (!$callingUser || !$callingUser->isAdministrator()) {
            if (in_array($requestedType, [User::ROLE_ADMINISTRATOR, User::ROLE_MANAGER, 'super_admin'], true)) {
                abort(403, 'فقط مدیر ارشد مجاز به تعریف حساب مدیر ارشد یا مدیر جدید است.');
            }
        }
        $resolvedType = $requestedType;

        $defaultScope = in_array($resolvedType, [User::ROLE_SALESPERSON, User::ROLE_INSTALLER], true) ? User::SCOPE_OWN : User::SCOPE_ALL;
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

    protected function isPrimaryAdmin(User $user): bool
    {
        return (int) $user->id === 1 || $user->email === 'admin@crm.local';
    }

    protected function ensureCanMutateTarget(?User $callingUser, User $target): void
    {
        if (!$callingUser) {
            abort(403, 'دسترسی غیرمجاز.');
        }

        if ($callingUser->isAdministrator()) {
            return;
        }

        if ($target->isAdministrator()) {
            abort(403, 'مدیران عادی امکان ویرایش حساب مدیر ارشد را ندارند.');
        }

        if ($target->user_type === User::ROLE_MANAGER && (int) $target->id !== (int) $callingUser->id) {
            abort(403, 'شما مجاز به ویرایش، تغییر رمز یا غیرفعال‌سازی حساب سایر مدیران سامانه نیستید.');
        }
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        if ($request->has('phone')) {
            $normPhone = trim((string) $this->normalizeDigits($request->input('phone')));
            $request->merge(['phone' => $normPhone !== '' ? $normPhone : null]);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
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

        if ($this->isPrimaryAdmin($user)) {
            if (($request->filled('user_type') && $validated['user_type'] !== User::ROLE_ADMINISTRATOR)
                || ($request->has('is_active') && !$request->boolean('is_active'))
                || ($request->filled('customer_scope') && $validated['customer_scope'] !== User::SCOPE_ALL)) {
                return response()->json([
                    'message' => 'تغییر سطح دسترسی، محدوده مشتریان یا غیرفعال‌سازی حساب مدیر ارشد اصلی سامانه مجاز نیست.',
                ], 422);
            }
        }

        if ((!$callingUser || !$callingUser->isAdministrator()) && $request->filled('user_type')) {
            if ($validated['user_type'] === User::ROLE_ADMINISTRATOR
                || ($validated['user_type'] === User::ROLE_MANAGER && $user->user_type !== User::ROLE_MANAGER)) {
                abort(403, 'فقط مدیر ارشد مجاز به ارتقای کاربران به سطح مدیریتی است.');
            }
        }

        $passwordChanged = !empty($validated['password']);
        $beforeAccessSnapshot = $this->snapshotUserAccess($user);

        DB::transaction(function () use ($request, $user, $validated, $callingUser) {
            if (array_key_exists('name', $validated)) {
                $user->name = $validated['name'];
            }
            if (array_key_exists('email', $validated)) {
                $user->email = $validated['email'];
            }
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
            if ($request->filled('user_type')) {
                $this->syncSpatieRole($user, $user->user_type ?: User::ROLE_MANAGER);
            }

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

        $freshUser = $user->fresh();
        $accessChanged = $beforeAccessSnapshot !== $this->snapshotUserAccess($freshUser);
        $forceLoggedOut = false;

        if (!$freshUser->is_active || $passwordChanged || $accessChanged) {
            $this->sessionManager->revokeAllSessions($freshUser);
            $forceLoggedOut = true;
        }

        $response = response()->json([
            'message' => $forceLoggedOut
                ? 'اطلاعات کارمند ویرایش شد و به دلیل تغییر رمز عبور یا سطح دسترسی، نشست‌های فعال ایشان خاتمه یافت.'
                : 'اطلاعات، نقش و دسترسی‌های کارمند با موفقیت ویرایش شد.',
            'force_logged_out' => $forceLoggedOut,
            'user' => $freshUser->serializeForApi(),
        ]);

        if ($forceLoggedOut && (int) $freshUser->id === (int) auth()->id()) {
            return $response->withCookie(cookie()->forget('crm_token', '/'));
        }

        return $response;
    }

    public function destroy(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'امکان حذف حساب کاربری خودتان وجود ندارد.',
            ], 422);
        }

        if ($this->isPrimaryAdmin($user)) {
            return response()->json([
                'message' => 'امکان حذف حساب مدیر اصلی سیستم وجود ندارد.',
            ], 422);
        }

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $userName = $user->name;
        DB::transaction(function () use ($user) {
            Customer::where('created_by_user_id', $user->id)->update([
                'created_by_user_id' => auth()->id(),
            ]);
            $user->tokens()->delete();
            $user->syncPermissions([]);
            $user->syncRoles([]);
            $user->delete();
        });

        return response()->json([
            'message' => "کاربر «{$userName}» با موفقیت حذف گردید و مشتریان ایشان به حساب شما منتقل شد.",
        ]);
    }

    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        if ($this->isPrimaryAdmin($user) && $request->filled('user_type') && $request->input('user_type') !== User::ROLE_ADMINISTRATOR) {
            return response()->json([
                'message' => 'تنزل سطح دسترسی حساب مدیر ارشد اصلی سامانه مجاز نیست.',
            ], 422);
        }

        if ((!$callingUser || !$callingUser->isAdministrator()) && $request->filled('user_type')) {
            if ($request->input('user_type') === User::ROLE_ADMINISTRATOR
                || ($request->input('user_type') === User::ROLE_MANAGER && $user->user_type !== User::ROLE_MANAGER)) {
                abort(403, 'فقط مدیر ارشد مجاز به اعطای نقش مدیریتی است.');
            }
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

        $beforeAccessSnapshot = $this->snapshotUserAccess($user);

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
            if ($request->filled('user_type')) {
                $this->syncSpatieRole($user, $user->user_type ?: User::ROLE_MANAGER);
            }

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

        $freshUser = $user->fresh();
        $accessChanged = $beforeAccessSnapshot !== $this->snapshotUserAccess($freshUser);
        $forceLoggedOut = false;

        if ($accessChanged) {
            $this->sessionManager->revokeAllSessions($freshUser);
            $forceLoggedOut = true;
        }

        $response = response()->json([
            'message' => $forceLoggedOut
                ? "نقش و مجوزهای «{$freshUser->name}» بروزرسانی شد و نشست‌های فعال ایشان جهت اعمال دسترسی جدید خاتمه یافت."
                : "نقش، محدوده مشتریان و مجوزهای «{$freshUser->name}» با موفقیت بروزرسانی شد.",
            'force_logged_out' => $forceLoggedOut,
            'permissions' => $freshUser->getAllPermissions()->pluck('name')->values()->all(),
            'user' => $freshUser->serializeForApi(),
        ]);

        if ($forceLoggedOut && (int) $freshUser->id === (int) auth()->id()) {
            return $response->withCookie(cookie()->forget('crm_token', '/'));
        }

        return $response;
    }

    /**
     * List active sessions for a specific user (requires `users.sessions` ACL).
     */
    public function sessions(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.sessions');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        $currentToken = $request->user()?->currentAccessToken();
        $currentTokenId = ($currentToken instanceof PersonalAccessToken && (int) $user->id === (int) $callingUser?->id)
            ? (int) $currentToken->id
            : null;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role_label' => $user->role_label,
                'user_type' => $user->user_type,
            ],
            'max_sessions' => SessionManager::MAX_ACTIVE_SESSIONS,
            'sessions' => $this->sessionManager->listUserSessions($user, $currentTokenId),
        ]);
    }

    /**
     * Force-logout a single session of a user (requires `users.sessions` ACL).
     */
    public function revokeSession(Request $request, User $user, int $tokenId): JsonResponse
    {
        $this->authorizePermission('users.sessions');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        $token = $user->tokens()->where('id', $tokenId)->first();
        if (!$token) {
            return response()->json([
                'message' => 'نشست انتخاب‌شده یافت نشد یا قبلاً حذف شده است.',
            ], 404);
        }

        $currentToken = $request->user()?->currentAccessToken();
        $revokedCurrent = $currentToken instanceof PersonalAccessToken
            && (int) $user->id === (int) $callingUser?->id
            && (int) $currentToken->id === (int) $token->id;

        $token->delete();

        $response = response()->json([
            'message' => "نشست انتخاب‌شده برای «{$user->name}» با موفقیت خاتمه یافت (خروج اجباری).",
            'revoked_current' => $revokedCurrent,
            'active_sessions_count' => $this->sessionManager->activeSessionCount($user),
        ]);

        return $revokedCurrent ? $response->withCookie(cookie()->forget('crm_token', '/')) : $response;
    }

    /**
     * Force-logout ALL active sessions of a user (requires `users.sessions` ACL).
     */
    public function revokeAllSessions(Request $request, User $user): JsonResponse
    {
        $this->authorizePermission('users.sessions');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        $revokedCurrent = (int) $user->id === (int) $callingUser?->id;
        $revokedCount = $this->sessionManager->revokeAllSessions($user);

        $response = response()->json([
            'message' => $revokedCount > 0
                ? "تمامی نشست‌های فعال «{$user->name}» ({$revokedCount} دستگاه) با موفقیت خاتمه یافت."
                : "هیچ نشست فعالی برای «{$user->name}» وجود نداشت.",
            'revoked_count' => $revokedCount,
            'revoked_current' => $revokedCurrent,
            'active_sessions_count' => 0,
        ]);

        return $revokedCurrent ? $response->withCookie(cookie()->forget('crm_token', '/')) : $response;
    }

    /**
     * Snapshot a user's role, scope, permissions, and customer grants for change detection.
     *
     * @return array<string, mixed>
     */
    protected function snapshotUserAccess(User $user): array
    {
        $directPerms = $user->getDirectPermissions()->pluck('name')->values()->all();
        sort($directPerms);

        $allPerms = $user->getAllPermissions()->pluck('name')->values()->all();
        sort($allPerms);

        $staffIds = Schema::hasTable('user_customer_staff_grants')
            ? $user->grantedStaff()->pluck('users.id')->map(fn ($id) => (int) $id)->values()->all()
            : [];
        sort($staffIds);

        $customerIds = Schema::hasTable('user_customer_grants')
            ? $user->grantedCustomers()->pluck('customers.id')->map(fn ($id) => (int) $id)->values()->all()
            : [];
        sort($customerIds);

        return [
            'user_type' => $user->user_type,
            'customer_scope' => $user->effectiveCustomerScope(),
            'direct_permissions' => $directPerms,
            'permissions' => $allPerms,
            'granted_staff_ids' => $staffIds,
            'granted_customer_ids' => $customerIds,
        ];
    }

    public function toggleActive(User $user): JsonResponse
    {
        $this->authorizePermission('users.manage');

        /** @var User|null $callingUser */
        $callingUser = auth()->user();
        $this->ensureCanMutateTarget($callingUser, $user);

        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'امکان تغییر وضعیت حساب کاربری خودتان وجود ندارد.',
            ], 422);
        }

        if ($this->isPrimaryAdmin($user)) {
            return response()->json([
                'message' => 'غیرفعال‌سازی حساب مدیر ارشد اصلی سامانه مجاز نیست.',
            ], 422);
        }

        $user->update(['is_active' => !$user->is_active]);

        if (!$user->is_active) {
            $user->tokens()->delete();
        }

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
