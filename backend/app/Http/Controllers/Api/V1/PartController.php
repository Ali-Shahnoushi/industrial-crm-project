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

        if ($request->filled('q') || $request->filled('search')) {
            $term = trim((string) ($request->q ?? $request->search));
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $op) {
                $q->where('name', $op, "%{$term}%")
                    ->orWhere('code', $op, "%{$term}%")
                    ->orWhere('description', $op, "%{$term}%");
            });
        }

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        if ($request->boolean('low_stock_only', false)) {
            $query->where('is_active', true)
                ->where(function ($q) {
                    $q->where(function ($q1) {
                        $q1->where('min_stock', '>', 0)
                            ->whereColumn('stock_quantity', '<=', 'min_stock');
                    })->orWhere('stock_quantity', '<=', 0);
                });
        }

        $parts = $query->get();

        return response()->json($parts);
    }

    /**
     * Dedicated warehouse dashboard summary: KPIs, low-stock devices, and recent stock movements.
     */
    public function inventorySummary(): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $activeParts = Part::where('is_active', true)->orderBy('stock_quantity')->get();
        $lowStockItems = $activeParts->filter(fn (Part $p) => $p->is_low_stock)->values();

        return response()->json([
            'total_models' => Part::count(),
            'active_models' => $activeParts->count(),
            'total_units_in_stock' => (int) Part::sum('stock_quantity'),
            'out_of_stock_count' => $activeParts->where('stock_quantity', '<=', 0)->count(),
            'low_stock_count' => $lowStockItems->count(),
            'low_stock_parts' => $lowStockItems,
            'low_stock_items' => $lowStockItems,
            'recent_movements' => PartInventoryLog::with([
                'part:id,name,code,unit,stock_quantity,min_stock',
                'user:id,name,user_type',
                'customer:id,first_name,last_name,company_name,type',
            ])->latest()->limit(15)->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $this->normalizeNumericFields($request, ['periodic_service_months', 'stock_quantity', 'min_stock', 'unit_price']);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-zA-Z0-9\-_]+$/', 'unique:parts,code'],
            'periodic_service_months' => 'nullable|integer|min:1',
            'stock_quantity' => 'nullable|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:30',
            'unit_price' => 'nullable|numeric|min:0',
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
        $minStock = (int) ($validated['min_stock'] ?? 0);
        $unit = trim((string) ($validated['unit'] ?? '')) ?: 'دستگاه';
        $unitPrice = (int) round((float) ($validated['unit_price'] ?? 0));

        $part = DB::transaction(function () use ($validated, $initialStock, $minStock, $unit, $unitPrice, $request) {
            $created = Part::create([
                'name' => $validated['name'],
                'code' => $validated['code'],
                'periodic_service_months' => $validated['periodic_service_months'] ?? 12,
                'stock_quantity' => 0,
                'min_stock' => $minStock,
                'unit' => $unit,
                'unit_price' => $unitPrice,
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
            'data' => $part,
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

        $this->normalizeNumericFields($request, ['periodic_service_months', 'stock_quantity', 'min_stock', 'unit_price']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'code' => ['sometimes', 'string', 'max:50', 'regex:/^[a-zA-Z0-9\-_]+$/', "unique:parts,code,{$part->id}"],
            'periodic_service_months' => 'sometimes|nullable|integer|min:1',
            'stock_quantity' => 'nullable|integer|min:0',
            'min_stock' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:30',
            'unit_price' => 'sometimes|nullable|numeric|min:0',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'code.regex' => 'کد دستگاه (SKU) فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد.',
            'code.unique' => 'این کد دستگاه قبلاً در سیستم ثبت شده است.',
            'stock_quantity.min' => 'موجودی انبار نمی‌تواند منفی باشد.',
        ]);

        if (array_key_exists('unit', $validated)) {
            $validated['unit'] = trim((string) $validated['unit']) ?: 'دستگاه';
        }
        if (array_key_exists('min_stock', $validated)) {
            $validated['min_stock'] = (int) ($validated['min_stock'] ?? 0);
        }
        if (array_key_exists('unit_price', $validated)) {
            $validated['unit_price'] = (int) round((float) ($validated['unit_price'] ?? 0));
        }

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

        $freshPart = $part->fresh();
        return response()->json([
            'message' => 'مشخصات مدل دستگاه بروزرسانی شد.',
            'part' => $freshPart,
            'data' => $freshPart,
        ]);
    }

    public function destroy(Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        if ($part->customerParts()->exists() || $part->inventoryLogs()->exists()) {
            return response()->json([
                'message' => 'این دستگاه دارای سوابق تخصیص به مشتریان یا گردش انبار است و برای حفظ یکپارچگی کاردکس انبار قابل حذف مستقیم نیست (می‌توانید آن را غیرفعال کنید).',
            ], 422);
        }

        $part->delete();

        return response()->json([
            'message' => 'مدل دستگاه با موفقیت حذف شد.',
        ]);
    }

    /**
     * Manual warehouse stock entry / exit / physical count reconciliation for a device.
     */
    public function adjustStock(Request $request, Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $this->normalizeNumericFields($request, ['quantity']);
        $isExactAdjustment = (string) $request->input('type') === PartInventoryLog::TYPE_ADJUSTMENT;

        $validated = $request->validate([
            'type' => 'required|in:in,out_manual,return,adjustment',
            'quantity' => ['required', 'integer', $isExactAdjustment ? 'min:0' : 'min:1'],
            'description' => 'nullable|string|max:500',
            'customer_id' => 'nullable|exists:customers,id',
        ], [
            'type.required' => 'نوع عملیات انبار را مشخص کنید.',
            'quantity.required' => 'تعداد را وارد کنید.',
            'quantity.min' => $isExactAdjustment ? 'موجودی شمارش‌شده نمی‌تواند منفی باشد.' : 'تعداد باید حداقل ۱ عدد باشد.',
        ]);

        if (!empty($validated['customer_id'])) {
            $customer = Customer::findOrFail($validated['customer_id']);
            $this->authorizeCustomerAccess($customer);
        }

        $customerId = !empty($validated['customer_id']) ? (int) $validated['customer_id'] : null;

        $log = $isExactAdjustment
            ? $this->customerService->reconcileStock(
                $part,
                (int) $validated['quantity'],
                $validated['description'] ?? null,
                $request->user()->id,
                $customerId
            )
            : $this->customerService->adjustStock(
                $part,
                $validated['type'],
                (int) $validated['quantity'],
                $validated['description'] ?? null,
                $request->user()->id,
                $customerId
            );

        $actionTitle = match ($validated['type']) {
            PartInventoryLog::TYPE_OUT_MANUAL => 'خروج کالا از انبار',
            PartInventoryLog::TYPE_ADJUSTMENT => 'تنظیم موجودی (انبارگردانی)',
            default => 'ورود کالا به انبار',
        };

        $freshPart = $part->fresh();
        return response()->json([
            'message' => "{$actionTitle} برای دستگاه «{$part->name}» با موفقیت ثبت شد.",
            'log' => $log,
            'part' => $freshPart,
            'data' => $freshPart,
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
            $canSeeWarehouseGeneral = $user->hasSafePermission('parts.manage');
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

        if ($request->filled('type') && in_array($request->type, ['in', 'out_manual', 'out_assign', 'return', 'adjustment'], true)) {
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

        $this->normalizeNumericFields($request, [
            'quantity',
            'invoice_amount',
            'warranty_months',
            'unit_price',
            'discount_amount',
            'tax_percent',
            'paid_amount',
        ]);
        if ($request->exists('invoice_number')) {
            $invNo = trim((string) $this->normalizeDigits((string) $request->input('invoice_number', '')));
            $request->merge(['invoice_number' => $invNo !== '' ? $invNo : null]);
        }

        $validated = $request->validate([
            'part_id' => 'required|exists:parts,id',
            'serial_number' => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9\-_\/]+$/', 'unique:customer_parts,serial_number'],
            'quantity' => 'nullable|integer|min:1',
            'invoice_amount' => 'nullable|numeric|min:0',
            'invoice_number' => 'nullable|string|max:100',
            'installation_date' => 'nullable|date',
            'warranty_months' => 'nullable|integer|min:0|max:240',
            'warranty_expire_date' => 'nullable|date',
            'status' => 'nullable|in:active,under_repair,replaced,retired',
            'notes' => 'nullable|string',
            'unit_price' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'tax_percent' => 'nullable|numeric|min:0|max:100',
            'sale_status' => 'nullable|in:draft,confirmed,cancelled',
            'payment_status' => 'nullable|in:unpaid,partial,paid',
            'paid_amount' => 'nullable|numeric|min:0',
            'send_sms' => 'nullable|boolean',
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
            $validated['serial_number'] ?? null,
            $validated,
            $request->user()->id
        );

        return response()->json([
            'message' => "دستگاه «{$part->name}» (تعداد: {$customerPart->quantity} عدد) با موفقیت به مشتری تخصیص داده شد و از موجودی انبار کسر گردید.",
            'customer_part' => $customerPart,
            'sale' => $customerPart->saleItem?->sale?->load(['customer', 'seller', 'items.part', 'activeInvoice']),
            'data' => $customerPart,
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

        $this->normalizeNumericFields($request, ['quantity', 'invoice_amount', 'warranty_months']);
        if ($request->exists('invoice_number')) {
            $invNo = trim((string) $this->normalizeDigits((string) $request->input('invoice_number', '')));
            $request->merge(['invoice_number' => $invNo !== '' ? $invNo : null]);
        }

        $validated = $request->validate([
            'part_id' => 'sometimes|required|exists:parts,id',
            'serial_number' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
                'regex:/^[a-zA-Z0-9\-_\/]+$/',
                "unique:customer_parts,serial_number,{$customerPart->id}",
            ],
            'quantity' => 'sometimes|required|integer|min:1',
            'invoice_amount' => 'nullable|numeric|min:0',
            'invoice_number' => 'nullable|string|max:100',
            'installation_date' => 'nullable|date',
            'warranty_months' => 'nullable|integer|min:0|max:240',
            'warranty_expire_date' => 'nullable|date',
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
            'data' => $updated,
        ]);
    }

    public function updateAssignmentForCustomer(Request $request, Customer $customer, CustomerPart $customerPart): JsonResponse
    {
        if ((int) $customerPart->customer_id !== (int) $customer->id) {
            abort(404);
        }
        return $this->updateAssignment($request, $customerPart);
    }

    public function deleteAssignmentForCustomer(Request $request, Customer $customer, CustomerPart $customerPart): JsonResponse
    {
        if ((int) $customerPart->customer_id !== (int) $customer->id) {
            abort(404);
        }
        return $this->deleteAssignment($request, $customerPart);
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
