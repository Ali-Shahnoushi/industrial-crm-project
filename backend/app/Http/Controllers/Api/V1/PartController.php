<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\PartInventoryLog;
use App\Services\Customers\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartController extends Controller
{
    public function __construct(protected CustomerService $customerService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $query = Part::withCount('customerParts')
            ->withSum('customerParts as assigned_quantity_sum', 'quantity')
            ->latest();

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $op) {
                $q->where('name', $op, "%{$term}%")
                    ->orWhere('code', $op, "%{$term}%")
                    ->orWhere('description', $op, "%{$term}%");
            });
        }

        $parts = $query->get();

        return response()->json($parts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $this->normalizeNumericFields($request, ['periodic_service_months', 'stock_quantity']);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-zA-Z0-9\-_]+$/', 'unique:parts,code'],
            'periodic_service_months' => 'required|integer|min:1',
            'stock_quantity' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'name.required' => 'وارد کردن نام مدل دستگاه الزامی است.',
            'code.required' => 'وارد کردن کد فنی دستگاه الزامی است.',
            'code.regex' => 'کد دستگاه (SKU) فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد.',
            'code.unique' => 'این کد دستگاه قبلاً در سیستم ثبت شده است.',
            'stock_quantity.min' => 'موجودی اولیه نمی‌تواند منفی باشد.',
        ]);

        $initialStock = (int) ($validated['stock_quantity'] ?? 0);

        $part = DB::transaction(function () use ($validated, $initialStock, $request) {
            $created = Part::create([
                'name' => $validated['name'],
                'code' => $validated['code'],
                'periodic_service_months' => $validated['periodic_service_months'],
                'stock_quantity' => 0,
                'description' => $validated['description'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            if ($initialStock > 0) {
                $this->customerService->adjustStock(
                    $created,
                    PartInventoryLog::TYPE_IN,
                    $initialStock,
                    'ثبت موجودی اولیه هنگام تعریف دستگاه در کاتالوگ',
                    $request->user()->id
                );
                $created->refresh();
            }

            return $created;
        });

        return response()->json([
            'message' => 'مدل دستگاه با موفقیت در کاتالوگ ثبت شد.',
            'part' => $part,
        ], 201);
    }

    public function show(Request $request, Part $part): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $user = $request->user();
        $part->load([
            'customerParts' => function ($q) use ($user) {
                $q->whereHas('customer', fn ($cq) => $cq->accessibleBy($user))
                    ->with('customer:id,first_name,last_name,company_name,type,mobile');
            },
        ]);

        return response()->json($part);
    }

    public function update(Request $request, Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $this->normalizeNumericFields($request, ['periodic_service_months', 'stock_quantity']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'code' => ['sometimes', 'string', 'max:50', 'regex:/^[a-zA-Z0-9\-_]+$/', "unique:parts,code,{$part->id}"],
            'periodic_service_months' => 'sometimes|integer|min:1',
            'stock_quantity' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'code.regex' => 'کد دستگاه (SKU) فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد.',
            'code.unique' => 'این کد دستگاه قبلاً در سیستم ثبت شده است.',
            'stock_quantity.min' => 'موجودی انبار نمی‌تواند منفی باشد.',
        ]);

        DB::transaction(function () use ($part, $validated, $request) {
            $newStock = array_key_exists('stock_quantity', $validated) && $validated['stock_quantity'] !== null
                ? (int) $validated['stock_quantity']
                : null;
            unset($validated['stock_quantity']);

            $part->update($validated);

            if ($newStock !== null) {
                $lockedPart = Part::whereKey($part->id)->lockForUpdate()->firstOrFail();
                $diff = $newStock - (int) $lockedPart->stock_quantity;
                if ($diff > 0) {
                    $this->customerService->adjustStock(
                        $lockedPart,
                        PartInventoryLog::TYPE_IN,
                        $diff,
                        'اصلاح و افزایش موجودی از طریق ویرایش دستگاه',
                        $request->user()->id
                    );
                } elseif ($diff < 0) {
                    $this->customerService->adjustStock(
                        $lockedPart,
                        PartInventoryLog::TYPE_OUT_MANUAL,
                        abs($diff),
                        'اصلاح و کاهش موجودی از طریق ویرایش دستگاه',
                        $request->user()->id
                    );
                }
            }
        });

        return response()->json([
            'message' => 'مشخصات مدل دستگاه بروزرسانی شد.',
            'part' => $part->fresh(),
        ]);
    }

    public function destroy(Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        if ($part->customerParts()->exists()) {
            return response()->json([
                'message' => 'این دستگاه به مشتریان تخصیص داده شده و امکان حذف مستقیم آن وجود ندارد.',
            ], 422);
        }

        $part->delete();

        return response()->json([
            'message' => 'مدل دستگاه با موفقیت حذف شد.',
        ]);
    }

    /**
     * Manual warehouse stock entry / exit for a device.
     */
    public function adjustStock(Request $request, Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $this->normalizeNumericFields($request, ['quantity']);

        $validated = $request->validate([
            'type' => 'required|in:in,out_manual,return',
            'quantity' => 'required|integer|min:1',
            'description' => 'nullable|string|max:500',
            'customer_id' => 'nullable|exists:customers,id',
        ], [
            'type.required' => 'نوع عملیات انبار را مشخص کنید.',
            'quantity.required' => 'تعداد را وارد کنید.',
            'quantity.min' => 'تعداد باید حداقل ۱ عدد باشد.',
        ]);

        if (!empty($validated['customer_id'])) {
            $customer = Customer::findOrFail($validated['customer_id']);
            $this->authorizeCustomerAccess($customer);
        }

        $log = $this->customerService->adjustStock(
            $part,
            $validated['type'],
            (int) $validated['quantity'],
            $validated['description'] ?? null,
            $request->user()->id,
            !empty($validated['customer_id']) ? (int) $validated['customer_id'] : null
        );

        $actionTitle = $validated['type'] === PartInventoryLog::TYPE_OUT_MANUAL ? 'خروج کالا از انبار' : 'ورود کالا به انبار';

        return response()->json([
            'message' => "{$actionTitle} برای دستگاه «{$part->name}» با موفقیت ثبت شد.",
            'log' => $log,
            'part' => $part->fresh(),
        ], 201);
    }

    /**
     * List warehouse inventory audit logs (in, out_manual, out_assign, return) with staff and customer links.
     */
    public function inventoryLogs(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $user = $request->user();

        $query = PartInventoryLog::with([
            'part:id,name,code,stock_quantity',
            'user:id,name,email,user_type',
            'customer:id,first_name,last_name,company_name,type,created_by_user_id',
        ])->latest();

        // Enforce row-level customer visibility for restricted users (e.g. Salesperson)
        if ($user && $user->hasRestrictedCustomerScope()) {
            $canSeeWarehouseGeneral = $user->hasPermissionTo('parts.manage');
            $query->where(function ($sub) use ($user, $canSeeWarehouseGeneral) {
                $sub->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
                if ($canSeeWarehouseGeneral) {
                    $sub->orWhereNull('customer_id');
                }
            });
        }

        if ($request->filled('part_id')) {
            $query->where('part_id', (int) $request->input('part_id'));
        }

        if ($request->filled('type') && in_array($request->type, ['in', 'out_manual', 'out_assign', 'return'], true)) {
            $query->where('type', $request->type);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->input('customer_id'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $op) {
                $q->where('description', $op, "%{$term}%")
                    ->orWhereHas('part', function ($pq) use ($term, $op) {
                        $pq->where('name', $op, "%{$term}%")
                            ->orWhere('code', $op, "%{$term}%");
                    })
                    ->orWhereHas('user', function ($uq) use ($term, $op) {
                        $uq->where('name', $op, "%{$term}%");
                    })
                    ->orWhereHas('customer', function ($cq) use ($term, $op) {
                        $cq->where('first_name', $op, "%{$term}%")
                            ->orWhere('last_name', $op, "%{$term}%")
                            ->orWhere('company_name', $op, "%{$term}%");
                    });
            });
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 20)));
        $logs = $query->paginate($perPage);

        return response()->json($logs);
    }

    /**
     * Assign a physical device to a customer (with quantity, invoice amount, optional invoice number).
     * Deducts stock atomically and transitions 'potential' customer to 'effective'.
     */
    public function assign(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('parts.assign');
        $this->authorizeCustomerAccess($customer);

        $this->normalizeNumericFields($request, ['quantity', 'invoice_amount']);
        if ($request->exists('invoice_number')) {
            $invNo = trim((string) $this->normalizeDigits((string) $request->input('invoice_number', '')));
            $request->merge(['invoice_number' => $invNo !== '' ? $invNo : null]);
        }

        $validated = $request->validate([
            'part_id' => 'required|exists:parts,id',
            'serial_number' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9\-_\/]+$/', 'unique:customer_parts,serial_number'],
            'quantity' => 'required|integer|min:1',
            'invoice_amount' => 'nullable|numeric|min:0',
            'invoice_number' => 'nullable|string|max:100',
            'installation_date' => 'nullable|date',
            'status' => 'nullable|in:active,under_repair,replaced,retired',
            'notes' => 'nullable|string',
        ], [
            'part_id.required' => 'انتخاب مدل دستگاه الزامی است.',
            'serial_number.required' => 'وارد کردن شماره سریال یا کد یکتای دستگاه الزامی است.',
            'serial_number.regex' => 'شماره سریال فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد.',
            'serial_number.unique' => 'این شماره سریال قبلاً به مشتری دیگری تخصیص داده شده است.',
            'quantity.required' => 'تعداد دستگاه را وارد کنید.',
            'quantity.min' => 'تعداد دستگاه باید حداقل ۱ عدد باشد.',
            'invoice_amount.numeric' => 'مبلغ فاکتور باید عددی معتبر باشد.',
            'invoice_amount.min' => 'مبلغ فاکتور نمی‌تواند منفی باشد.',
        ]);

        $part = Part::findOrFail($validated['part_id']);

        $customerPart = $this->customerService->assignPart(
            $customer,
            $part,
            $validated['serial_number'],
            $validated,
            $request->user()->id
        );

        return response()->json([
            'message' => "دستگاه «{$part->name}» (تعداد: {$customerPart->quantity} عدد) با موفقیت به مشتری تخصیص داده شد و از موجودی انبار کسر گردید.",
            'customer_part' => $customerPart,
            'customer_type' => $customer->fresh()->customer_type,
        ], 201);
    }

    /**
     * Edit an assigned device record on a customer profile (Task 3 & Task 4).
     */
    public function updateAssignment(Request $request, CustomerPart $customerPart): JsonResponse
    {
        $this->authorizePermission('parts.assign');
        $customer = Customer::findOrFail($customerPart->customer_id);
        $this->authorizeCustomerAccess($customer);

        $this->normalizeNumericFields($request, ['quantity', 'invoice_amount']);
        if ($request->exists('invoice_number')) {
            $invNo = trim((string) $this->normalizeDigits((string) $request->input('invoice_number', '')));
            $request->merge(['invoice_number' => $invNo !== '' ? $invNo : null]);
        }

        $validated = $request->validate([
            'part_id' => 'sometimes|required|exists:parts,id',
            'serial_number' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                'regex:/^[a-zA-Z0-9\-_\/]+$/',
                "unique:customer_parts,serial_number,{$customerPart->id}",
            ],
            'quantity' => 'sometimes|required|integer|min:1',
            'invoice_amount' => 'nullable|numeric|min:0',
            'invoice_number' => 'nullable|string|max:100',
            'installation_date' => 'nullable|date',
            'status' => 'nullable|in:active,under_repair,replaced,retired',
            'notes' => 'nullable|string',
        ], [
            'serial_number.regex' => 'شماره سریال فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد.',
            'serial_number.unique' => 'این شماره سریال قبلاً به دستگاه دیگری اختصاص داده شده است.',
            'quantity.min' => 'تعداد دستگاه باید حداقل ۱ عدد باشد.',
            'invoice_amount.min' => 'مبلغ فاکتور نمی‌تواند منفی باشد.',
        ]);

        $updated = $this->customerService->updateAssignedPart(
            $customerPart,
            $validated,
            $request->user()->id
        );

        return response()->json([
            'message' => 'اطلاعات دستگاه تخصیص‌یافته با موفقیت بروزرسانی شد.',
            'customer_part' => $updated,
        ]);
    }

    /**
     * Delete an assigned device record from a customer profile and restore warehouse stock (Task 3 & Task 4).
     */
    public function deleteAssignment(Request $request, CustomerPart $customerPart): JsonResponse
    {
        $this->authorizePermission('parts.assign');
        $customer = Customer::findOrFail($customerPart->customer_id);
        $this->authorizeCustomerAccess($customer);

        $this->customerService->deleteAssignedPart($customerPart, $request->user()->id);

        return response()->json([
            'message' => 'تخصیص دستگاه حذف شد و تعداد آن به موجودی انبار بازگردانده شد.',
        ]);
    }

    /**
     * Record service or repair history for an assigned customer device.
     */
    public function addServiceHistory(Request $request, CustomerPart $customerPart): JsonResponse
    {
        $this->authorizePermission('parts.history');
        $customer = Customer::findOrFail($customerPart->customer_id);
        $this->authorizeCustomerAccess($customer);

        $this->normalizeNumericFields($request, ['cost']);

        $validated = $request->validate([
            'service_date' => 'required|date',
            'service_type' => 'required|in:periodic,repair,overhaul',
            'description' => 'required|string',
            'cost' => 'nullable|numeric|min:0',
        ]);

        $history = $this->customerService->recordServiceHistory(
            $customerPart,
            $validated,
            $request->user()->id
        );

        return response()->json([
            'message' => 'سابقه سرویس/تعمیر دستگاه با موفقیت ثبت شد.',
            'history' => $history->load('performedBy'),
        ], 201);
    }

    protected function normalizeNumericFields(Request $request, array $fields): void
    {
        $merged = [];
        foreach ($fields as $field) {
            if ($request->exists($field)) {
                $val = $request->input($field);
                if ($val === null || $val === '') {
                    $merged[$field] = null;
                } else {
                    $normalized = $this->normalizeDigits((string) $val);
                    $cleaned = str_replace([',', '٬', ' '], '', (string) $normalized);
                    $merged[$field] = $cleaned !== '' ? $cleaned : null;
                }
            }
        }
        if (!empty($merged)) {
            $request->merge($merged);
        }
    }
}
