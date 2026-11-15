<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\CustomersExport;
use App\Exports\CustomersSummarySheet;
use App\Exports\CustomersTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\CustomersImport;
use App\Models\Customer;
use App\Models\User;
use App\Services\Customers\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

class CustomerController extends Controller
{
    public function __construct(protected CustomerService $customerService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $query = Customer::accessibleBy($request->user())
            ->with(['creator:id,name', 'salesManager:id,name', 'portalUser:id,customer_id,name,email,is_active'])
            ->withCount('customerParts')
            ->withSum('customerParts as total_devices_qty', 'quantity');

        if ($request->filled('customer_type') && in_array($request->customer_type, ['potential', 'effective'], true)) {
            $query->where('customer_type', $request->customer_type);
        }

        if ($request->filled('type') && in_array($request->type, ['company', 'individual'], true)) {
            $query->where('type', $request->type);
        }

        if ($request->filled('province')) {
            $query->where('province', $request->province);
        }

        if ($request->filled('city')) {
            $query->where('city', $this->likeOp(), '%' . trim((string) $request->city) . '%');
        }

        if ($request->filled('has_devices')) {
            if (in_array($request->has_devices, ['yes', '1', 'true'], true)) {
                $query->has('customerParts');
            } elseif (in_array($request->has_devices, ['no', '0', 'false'], true)) {
                $query->doesntHave('customerParts');
            }
        }

        $creatorId = $request->input('created_by_user_id', $request->input('creator_id'));
        if ($creatorId !== null && $creatorId !== '') {
            $query->where('created_by_user_id', (int) $creatorId);
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();
            $fullNameExpr = DB::connection()->getDriverName() === 'sqlite'
                ? "(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))"
                : "CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))";

            $query->where(function ($q) use ($term, $normTerm, $op, $fullNameExpr) {
                $q->where('first_name', $op, "%{$term}%")
                    ->orWhere('last_name', $op, "%{$term}%")
                    ->orWhere('company_name', $op, "%{$term}%")
                    ->orWhere('mobile', $op, "%{$normTerm}%")
                    ->orWhere('phone', $op, "%{$normTerm}%")
                    ->orWhere('national_code', $op, "%{$normTerm}%")
                    ->orWhere('city', $op, "%{$term}%")
                    ->orWhere('province', $op, "%{$term}%")
                    ->orWhereRaw("{$fullNameExpr} {$op} ?", ["%{$term}%"])
                    ->orWhereHas('creator', fn ($cq) => $cq->where('name', $op, "%{$term}%"));
            });
        }

        $sortBy = $request->input('sort_by');
        $sortDir = strtolower((string) $request->input('sort_direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        if ($sortBy === 'name') {
            $query->orderBy(DB::raw("COALESCE(company_name, last_name, first_name)"), $sortDir);
        } elseif ($sortBy === 'customer_type') {
            $query->orderBy('customer_type', $sortDir);
        } elseif ($sortBy === 'contact' || $sortBy === 'mobile') {
            $query->orderBy('mobile', $sortDir);
        } elseif ($sortBy === 'city') {
            $query->orderBy('province', $sortDir)->orderBy('city', $sortDir);
        } elseif ($sortBy === 'devices') {
            $query->orderBy('total_devices_qty', $sortDir);
        } elseif ($sortBy === 'created_at') {
            $query->orderBy('created_at', $sortDir);
        } else {
            $query->latest();
        }

        $perPage = max(1, min(200, (int) $request->input('per_page', 15)));
        $customers = $query->paginate($perPage);

        return response()->json($customers);
    }

    /**
     * Lightweight customer options list for ACL exception assignment in User Management.
     */
    public function lookup(Request $request): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $query = Customer::with('creator:id,name')
            ->accessibleBy($request->user())
            ->latest();

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $normTerm, $op) {
                $q->where('first_name', $op, "%{$term}%")
                    ->orWhere('last_name', $op, "%{$term}%")
                    ->orWhere('company_name', $op, "%{$term}%")
                    ->orWhere('mobile', $op, "%{$normTerm}%");
            });
        }

        $items = $query->limit(300)->get()->map(function (Customer $c) {
            return [
                'id' => $c->id,
                'display_name' => $c->display_name,
                'type' => $c->type,
                'mobile' => $c->mobile,
                'creator_name' => $c->creator?->name,
            ];
        });

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.create');

        $this->prepareCustomerInput($request);

        $personType = $request->input('type', 'individual');
        $nationalCodeRule = $personType === 'company'
            ? 'nullable|string|regex:/^\d{11}$/'
            : 'nullable|string|regex:/^\d{10}$/';

        $validated = $request->validate([
            'customer_type' => 'nullable|in:potential,effective',
            'type' => 'required|in:individual,company',
            'first_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'last_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'company_name' => $personType === 'company' ? 'required|string|max:150' : 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['nullable', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{7,10}$/'],
            'email' => 'nullable|email|max:150',
            'province' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
        ], [
            'first_name.required' => 'وارد کردن نام برای شخصیت حقیقی الزامی است.',
            'last_name.required' => 'وارد کردن نام خانوادگی برای شخصیت حقیقی الزامی است.',
            'company_name.required' => 'وارد کردن نام شرکت برای شخصیت حقوقی الزامی است.',
            'national_code.regex' => $personType === 'company'
                ? 'شناسه ملی شخص حقوقی باید دقیقاً ۱۱ رقم عددی باشد.'
                : 'کد ملی شخص حقیقی باید دقیقاً ۱۰ رقم عددی باشد.',
            'mobile.regex' => 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.',
            'phone.regex' => 'شماره تلفن ثابت باید با 0 شروع شده و ۸ تا ۱۱ رقم عددی باشد (مانند 02188776655).',
        ]);

        $validated['customer_type'] = $validated['customer_type'] ?? 'potential';
        $validated['created_by_user_id'] = $request->user()->id;

        $customer = DB::transaction(function () use ($validated, $request) {
            $created = Customer::create($validated);

            $created->histories()->create([
                'user_id' => $request->user()->id,
                'action' => 'created',
                'description' => "مشتری جدید («{$created->display_name}») در سامانه ثبت شد.",
            ]);

            return $created->load('creator:id,name');
        });

        return response()->json([
            'message' => 'مشتری با موفقیت ثبت شد.',
            'customer' => $customer,
            'data' => $customer,
        ], 201);
    }

    public function show(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.view');
        $this->authorizeCustomerAccess($customer);

        /** @var User|null $user */
        $user = $request->user();
        $canViewSmsLogs = $user && $user->hasSafePermission('sms.logs');
        $canViewTickets = $user && $user->hasSafePermission('tickets.view');

        $relations = [
            'creator:id,name,email,phone,user_type,avatar',
            'salesManager:id,name,email,phone,user_type,avatar',
            'portalUser:id,customer_id,name,email,phone,is_active,created_at',
            'customerParts.part',
            'customerParts.serviceHistories.performedBy',
            'histories.user',
        ];
        if ($canViewSmsLogs) {
            $relations[] = 'smsLogs';
        }
        if ($canViewTickets && \Illuminate\Support\Facades\Schema::hasTable('tickets')) {
            $relations[] = 'tickets.department:id,name';
            $relations[] = 'tickets.assignee:id,name,user_type';
            $relations[] = 'tickets.customerPart.part:id,name,code';
        }

        $customer->load($relations);
        $payload = $customer->toArray();
        if (!$canViewSmsLogs) {
            unset($payload['sms_logs']);
        }
        if (!$canViewTickets) {
            unset($payload['tickets']);
        }

        return response()->json($payload);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.edit');
        $this->authorizeCustomerAccess($customer);

        $this->prepareCustomerInput($request);

        $personType = $request->input('type', $customer->type);
        $isChangingType = $request->has('type') && $personType !== $customer->type;
        if ($isChangingType && !$request->exists('national_code') && !empty($customer->national_code)) {
            $request->merge(['national_code' => $customer->national_code]);
        }

        $nationalCodeRule = $personType === 'company'
            ? 'nullable|string|regex:/^\d{11}$/'
            : 'nullable|string|regex:/^\d{10}$/';

        $validated = $request->validate([
            'customer_type' => 'sometimes|in:potential,effective',
            'type' => 'sometimes|in:individual,company',
            'first_name' => $personType === 'company' ? 'nullable|string|max:100' : 'sometimes|required|string|max:100',
            'last_name' => $personType === 'company' ? 'nullable|string|max:100' : 'sometimes|required|string|max:100',
            'company_name' => $personType === 'company' ? 'sometimes|required|string|max:150' : 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['nullable', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{7,10}$/'],
            'email' => 'nullable|email|max:150',
            'province' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
        ], [
            'first_name.required' => 'وارد کردن نام برای شخصیت حقیقی الزامی است.',
            'last_name.required' => 'وارد کردن نام خانوادگی برای شخصیت حقیقی الزامی است.',
            'company_name.required' => 'وارد کردن نام شرکت برای شخصیت حقوقی الزامی است.',
            'national_code.regex' => $personType === 'company'
                ? 'شناسه ملی شخص حقوقی باید دقیقاً ۱۱ رقم عددی باشد.'
                : 'کد ملی شخص حقیقی باید دقیقاً ۱۰ رقم عددی باشد.',
            'mobile.regex' => 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.',
            'phone.regex' => 'شماره تلفن ثابت باید با 0 شروع شده و ۸ تا ۱۱ رقم عددی باشد (مانند 02188776655).',
        ]);

        DB::transaction(function () use ($customer, $validated, $request) {
            $customer->update($validated);

            $customer->histories()->create([
                'user_id' => $request->user()->id,
                'action' => 'updated',
                'description' => 'مشخصات پرونده مشتری ویرایش شد.',
            ]);
        });

        $fresh = $customer->fresh('creator:id,name');
        return response()->json([
            'message' => 'اطلاعات مشتری بروزرسانی شد.',
            'customer' => $fresh,
            'data' => $fresh,
        ]);
    }

    /**
     * List staff members eligible to appear in the customer list "کارشناس" filter.
     */
    public function creatorOptions(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        /** @var User $user */
        $user = $request->user();

        $creatorIds = Customer::accessibleBy($user)
            ->whereNotNull('created_by_user_id')
            ->distinct()
            ->pluck('created_by_user_id')
            ->all();

        if (!$user->hasRestrictedCustomerScope()) {
            $activeStaffIds = User::staffOnly()
                ->where('is_active', true)
                ->pluck('id')
                ->all();
            $creatorIds = array_merge($creatorIds, $activeStaffIds);
        } else {
            $creatorIds[] = $user->id;
            if (\Illuminate\Support\Facades\Schema::hasTable('user_customer_staff_grants')) {
                $creatorIds = array_merge($creatorIds, $user->grantedStaff()->pluck('users.id')->all());
            }
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $creatorIds))));

        $staff = empty($ids)
            ? collect()
            : User::whereIn('id', $ids)
                ->select(['id', 'name', 'email', 'user_type'])
                ->orderBy('name')
                ->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'user_type' => $u->user_type,
                    'role_label' => $u->role_label,
                ]);

        return response()->json(['data' => $staff]);
    }

    /**
     * List active staff options for customer owner reassignment (Administrators & full-scope Managers).
     */
    public function staffOptions(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.edit');

        /** @var User|null $user */
        $user = $request->user();
        if (!$user || (!$user->isAdministrator() && !($user->user_type === User::ROLE_MANAGER && !$user->hasRestrictedCustomerScope()))) {
            abort(403, 'فقط مدیر ارشد و مدیران با دسترسی کامل مجاز به تغییر کارشناس مسئول هستند.');
        }

        $staff = User::staffOnly()
            ->where('is_active', true)
            ->select(['id', 'name', 'email', 'phone', 'user_type'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'user_type' => $u->user_type,
                'role_label' => $u->role_label,
            ]);

        return response()->json(['data' => $staff]);
    }

    /**
     * Reassign a customer's responsible staff owner (`created_by_user_id`) and write an `owner_changed` audit log.
     */
    public function updateOwner(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.edit');

        /** @var User|null $actingUser */
        $actingUser = $request->user();
        if (!$actingUser || (!$actingUser->isAdministrator() && !($actingUser->user_type === User::ROLE_MANAGER && !$actingUser->hasRestrictedCustomerScope()))) {
            abort(403, 'فقط مدیر ارشد و مدیران با دسترسی کامل مجاز به تغییر کارشناس مسئول پرونده هستند.');
        }

        if (!$request->filled('owner_user_id') && $request->filled('created_by_user_id')) {
            $request->merge(['owner_user_id' => $request->input('created_by_user_id')]);
        }

        $validated = $request->validate([
            'owner_user_id' => ['required', 'integer', 'exists:users,id'],
            'sales_manager_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        /** @var User $newOwner */
        $newOwner = User::findOrFail($validated['owner_user_id']);
        if (!$newOwner->is_active || $newOwner->isCustomerPortalUser()) {
            return response()->json([
                'message' => 'کاربر انتخاب‌شده غیرفعال یا غیرمجاز است و امکان انتقال پرونده به ایشان وجود ندارد.',
            ], 422);
        }

        if (array_key_exists('sales_manager_user_id', $validated)) {
            if (!empty($validated['sales_manager_user_id'])) {
                $sm = User::findOrFail($validated['sales_manager_user_id']);
                if (!$sm->is_active || $sm->isCustomerPortalUser()) {
                    return response()->json(['message' => 'مدیر فروش انتخاب‌شده معتبر یا فعال نیست.'], 422);
                }
            }
            $customer->update(['sales_manager_user_id' => $validated['sales_manager_user_id']]);
        }

        $oldOwnerId = $customer->created_by_user_id;
        $oldOwnerName = $customer->creator?->name ?? 'بدون کارشناس';

        if ((int) $oldOwnerId !== (int) $newOwner->id) {
            DB::transaction(function () use ($customer, $newOwner, $oldOwnerId, $oldOwnerName, $actingUser) {
                $customer->update(['created_by_user_id' => $newOwner->id]);

                $customer->histories()->create([
                    'user_id' => $actingUser->id,
                    'action' => 'owner_changed',
                    'description' => "کارشناس مسئول پرونده از «{$oldOwnerName}» به «{$newOwner->name}» تغییر یافت.",
                    'metadata' => [
                        'old_owner_id' => $oldOwnerId,
                        'old_owner_name' => $oldOwnerName,
                        'new_owner_id' => $newOwner->id,
                        'new_owner_name' => $newOwner->name,
                    ],
                ]);
            });
        }

        $fresh = $customer->fresh(['creator:id,name,email,phone,user_type', 'salesManager:id,name,email,phone,user_type']);
        return response()->json([
            'message' => "کارشناس مسئول پرونده به «{$newOwner->name}» تغییر یافت.",
            'customer' => $fresh,
            'data' => $fresh,
        ]);
    }

    /**
     * Enable, disable, or reset credentials for a Customer's isolated Portal account (`/portal`),
     * plus optionally assign a dedicated project Sales Manager (`sales_manager_user_id`).
     */
    public function managePortalAccess(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.edit');
        $this->authorizeCustomerAccess($customer);

        if ($request->has('login_phone')) {
            $normPhone = trim((string) $this->normalizeDigits((string) $request->input('login_phone', '')));
            $request->merge(['login_phone' => $normPhone !== '' ? $normPhone : null]);
        }

        $existingPortalUser = User::where('customer_id', $customer->id)->first();
        $enabling = $request->boolean('portal_enabled', true);

        $validated = $request->validate([
            'portal_enabled' => ['required', 'boolean'],
            'password' => array_filter([
                ($enabling && !$existingPortalUser) ? 'required' : 'nullable',
                'string',
                'min:8',
                'regex:/[A-Za-z]/',
                'regex:/[0-9]/',
            ]),
            'login_email' => [
                'nullable',
                'email',
                'max:150',
                'unique:users,email,' . ($existingPortalUser?->id ?? 'NULL'),
            ],
            'login_phone' => [
                'nullable',
                'string',
                'regex:/^09\d{9}$/',
                'unique:users,phone,' . ($existingPortalUser?->id ?? 'NULL'),
            ],
            'sales_manager_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ], [
            'password.required' => 'برای فعال‌سازی اولیه پنل کاربری مشتری، تعیین رمز عبور الزامی است.',
            'password.min' => 'رمز عبور پنل مشتری باید حداقل ۸ کاراکتر باشد.',
            'password.regex' => 'رمز عبور پنل مشتری باید شامل حداقل یک حرف انگلیسی و یک عدد باشد.',
            'login_email.unique' => 'این ایمیل قبلاً برای حساب کاربری دیگری ثبت شده است.',
            'login_phone.unique' => 'این شماره همراه قبلاً به حساب کاربری دیگری اختصاص یافته است.',
        ]);

        if (array_key_exists('sales_manager_user_id', $validated) && !empty($validated['sales_manager_user_id'])) {
            $sm = User::findOrFail($validated['sales_manager_user_id']);
            if (!$sm->is_active || $sm->isCustomerPortalUser()) {
                return response()->json([
                    'message' => 'مدیر فروش انتخاب‌شده معتبر یا فعال نیست.',
                ], 422);
            }
        }

        DB::transaction(function () use ($customer, $existingPortalUser, $enabling, $validated, $request) {
            $customerUpdates = ['portal_enabled' => $enabling];
            if (array_key_exists('sales_manager_user_id', $validated)) {
                $customerUpdates['sales_manager_user_id'] = $validated['sales_manager_user_id'];
            }
            $customer->update($customerUpdates);

            if ($enabling) {
                $resolvedPhone = $validated['login_phone'] ?? $existingPortalUser?->phone ?? $customer->mobile;
                if ($resolvedPhone) {
                    $conflictPhone = User::where('phone', $resolvedPhone)
                        ->when($existingPortalUser, fn ($q) => $q->where('id', '!=', $existingPortalUser->id))
                        ->exists();
                    if ($conflictPhone) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'login_phone' => ['شماره موبایل مشتری قبلاً روی حساب کاربری دیگری ثبت شده است؛ لطفاً شماره اختصاصی وارد کنید.'],
                        ]);
                    }
                }

                $fallbackEmail = "customer.{$customer->id}@portal.local";
                $candidateEmail = $validated['login_email']
                    ?? $existingPortalUser?->email
                    ?? ($customer->email && !User::where('email', $customer->email)->when($existingPortalUser, fn ($q) => $q->where('id', '!=', $existingPortalUser->id))->exists()
                        ? $customer->email
                        : $fallbackEmail);

                if ($existingPortalUser) {
                    $existingPortalUser->name = $customer->display_name;
                    $existingPortalUser->email = $candidateEmail;
                    $existingPortalUser->phone = $resolvedPhone;
                    $existingPortalUser->is_active = true;
                    $existingPortalUser->user_type = User::ROLE_CUSTOMER;
                    if (!empty($validated['password'])) {
                        $existingPortalUser->password = \Illuminate\Support\Facades\Hash::make($validated['password']);
                        $existingPortalUser->tokens()->delete();
                    }
                    $existingPortalUser->save();
                } else {
                    User::create([
                        'name' => $customer->display_name,
                        'email' => $candidateEmail,
                        'phone' => $resolvedPhone,
                        'password' => \Illuminate\Support\Facades\Hash::make($validated['password']),
                        'is_active' => true,
                        'user_type' => User::ROLE_CUSTOMER,
                        'customer_scope' => User::SCOPE_OWN,
                        'customer_id' => $customer->id,
                    ]);
                }

                $customer->histories()->create([
                    'user_id' => $request->user()?->id,
                    'action' => 'updated',
                    'description' => 'دسترسی پنل کاربری اختصاصی مشتری فعال / بروزرسانی شد.',
                ]);
            } elseif ($existingPortalUser) {
                $existingPortalUser->is_active = false;
                $existingPortalUser->save();
                $existingPortalUser->tokens()->delete();

                $customer->histories()->create([
                    'user_id' => $request->user()?->id,
                    'action' => 'updated',
                    'description' => 'دسترسی پنل کاربری مشتری غیرفعال شد و نشست‌های فعال باطل گردید.',
                ]);
            }
        });

        $fresh = $customer->fresh([
            'creator:id,name,email,phone,user_type,avatar',
            'salesManager:id,name,email,phone,user_type,avatar',
            'portalUser:id,customer_id,name,email,phone,is_active,created_at',
        ]);

        return response()->json([
            'message' => $enabling
                ? 'پنل کاربری اختصاصی مشتری با موفقیت فعال و تنظیم شد.'
                : 'دسترسی پنل کاربری مشتری غیرفعال شد.',
            'customer' => $fresh,
            'data' => $fresh,
        ]);
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.delete');
        $this->authorizeCustomerAccess($customer);

        $name = $customer->display_name;
        $this->customerService->deleteCustomer($customer, $request->user()?->id);

        return response()->json([
            'message' => "مشتری «{$name}» حذف شد و موجودی دستگاه‌های تخصیص‌یافته به انبار بازگشت.",
        ]);
    }

    /**
     * Import customers from Excel (.xlsx, .xls, .csv)
     */
    public function import(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.import');

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,txt|max:10240',
        ]);

        $import = new CustomersImport($request->user());
        Excel::import($import, $request->file('file'));

        return response()->json([
            'message' => "عملیات ورود با موفقیت انجام شد. {$import->getImportedCount()} مشتری ثبت/بروزرسانی شد.",
            'imported_count' => $import->getImportedCount(),
            'created' => $import->getCreatedCount(),
            'updated' => $import->getUpdatedCount(),
            'skipped' => $import->getSkippedCount(),
            'errors' => $import->getErrors(),
        ]);
    }

    /**
     * Export customers & assigned devices to Excel (.xlsx) or UTF-8 BOM CSV (.csv)
     */
    public function export(Request $request)
    {
        $this->authorizePermission('customers.export');

        $type = $request->query('customer_type');
        $format = strtolower((string) $request->query('format', 'xlsx'));
        $export = new CustomersExport($type, $request->user());

        if ($format === 'csv') {
            $fileName = 'customers-' . now()->format('Y-m-d') . '.csv';
            $customers = $export->collection();

            return response()->streamDownload(function () use ($customers) {
                $handle = fopen('php://output', 'w');
                // Write UTF-8 BOM explicitly so Excel on Windows/macOS renders Persian characters cleanly
                fwrite($handle, "\xEF\xBB\xBF");
                fputcsv($handle, CustomersSummarySheet::sheetHeadings());
                foreach ($customers as $customer) {
                    fputcsv($handle, CustomersSummarySheet::mapCustomerRow($customer));
                }
                fclose($handle);
            }, $fileName, [
                'Content-Type' => 'text/csv; charset=UTF-8',
            ]);
        }

        $fileName = 'customers-' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download($export, $fileName, ExcelFormat::XLSX);
    }

    /**
     * Download sample Excel template (.xlsx) — requires authentication & customers.import permission.
     */
    public function template()
    {
        $this->authorizePermission('customers.import');

        return Excel::download(new CustomersTemplateExport(), 'customers-sample-template.xlsx');
    }

    /**
     * Normalizes Persian/Arabic numerals and converts empty strings to null.
     */
    protected function prepareCustomerInput(Request $request): void
    {
        $merged = [];

        foreach (['national_code', 'mobile', 'phone'] as $numField) {
            if ($request->exists($numField)) {
                $raw = $this->normalizeDigits((string) $request->input($numField, ''));
                $cleaned = preg_replace('/[^\d]/', '', (string) $raw);
                $merged[$numField] = $cleaned !== '' ? $cleaned : null;
            }
        }

        foreach (['first_name', 'last_name', 'company_name', 'email', 'province', 'city', 'address', 'notes'] as $textField) {
            if ($request->exists($textField)) {
                $val = trim((string) $request->input($textField, ''));
                $merged[$textField] = $val !== '' ? $val : null;
            }
        }

        if (!empty($merged)) {
            $request->merge($merged);
        }
    }
}
