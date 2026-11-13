<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\SalesExport;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\User;
use App\Services\Sales\SaleService;
use App\Services\Sales\SalesReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SalesController extends Controller
{
    public function __construct(
        protected SaleService $saleService,
        protected SalesReportService $reportService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');

        /** @var User $user */
        $user = $request->user();

        $query = Sale::with(['customer', 'seller:id,name,email,user_type,avatar', 'items.part:id,name,code,unit,unit_price', 'items.customerPart:id,serial_number,invoice_number', 'activeInvoice'])
            ->accessibleBy($user);

        if ($request->input('status') === Sale::STATUS_CANCELLED) {
            $query->withTrashed()->where('status', Sale::STATUS_CANCELLED);
        } elseif ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->input('payment_status'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->input('customer_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('sale_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('sale_date', '<=', $request->input('to'));
        }

        if ($request->boolean('uninvoiced_only', false)) {
            $query->where('status', '!=', Sale::STATUS_CANCELLED)
                ->whereDoesntHave('activeInvoice');
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->input('q'));
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();

            $query->where(function ($sub) use ($term, $normTerm, $op) {
                if (ctype_digit($normTerm)) {
                    $sub->orWhere('id', (int) $normTerm);
                }
                $sub->orWhere('notes', $op, "%{$term}%")
                    ->orWhereHas('customer', function ($cq) use ($term, $normTerm, $op) {
                        $cq->where('first_name', $op, "%{$term}%")
                            ->orWhere('last_name', $op, "%{$term}%")
                            ->orWhere('company_name', $op, "%{$term}%")
                            ->orWhere('mobile', $op, "%{$normTerm}%");
                    })
                    ->orWhereHas('items.part', function ($pq) use ($term, $normTerm, $op) {
                        $pq->where('name', $op, "%{$term}%")
                            ->orWhere('code', $op, "%{$normTerm}%");
                    })
                    ->orWhereHas('activeInvoice', function ($iq) use ($normTerm, $op) {
                        $iq->where('number', $op, "%{$normTerm}%");
                    });
            });
        }

        $allowedSorts = ['id', 'sale_date', 'total', 'paid_amount', 'status', 'payment_status', 'created_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true)
            ? $request->input('sort_by')
            : 'sale_date';
        $sortDir = strtolower((string) $request->input('sort_direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortBy, $sortDir)->orderByDesc('id');

        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.create');

        $this->normalizeNumericFields($request, [
            'quantity',
            'unit_price',
            'discount_amount',
            'tax_percent',
            'paid_amount',
        ]);

        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'part_id' => 'required|exists:parts,id',
            'quantity' => 'required|integer|min:1',
            'serial_number' => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9\-_\/]+$/', 'unique:customer_parts,serial_number'],
            'unit_price' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'tax_percent' => 'nullable|numeric|min:0|max:100',
            'sale_date' => 'nullable|date',
            'status' => 'nullable|in:draft,confirmed',
            'payment_status' => 'nullable|in:unpaid,partial,paid',
            'paid_amount' => 'nullable|numeric|min:0',
            'user_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
            'send_sms' => 'nullable|boolean',
        ], [
            'customer_id.required' => 'انتخاب مشتری الزامی است.',
            'part_id.required' => 'انتخاب مدل دستگاه الزامی است.',
            'quantity.min' => 'تعداد باید حداقل ۱ باشد.',
            'serial_number.unique' => 'این شماره سریال قبلاً ثبت شده است.',
        ]);

        $customer = Customer::findOrFail($validated['customer_id']);
        $this->authorizeCustomerAccess($customer);

        /** @var User $actor */
        $actor = $request->user();
        if (!empty($validated['user_id']) && (int) $validated['user_id'] !== (int) $actor->id && !$actor->hasSafePermission('sales.manage')) {
            $validated['user_id'] = $actor->id;
        }

        $sale = $this->saleService->createManualSale($validated, $actor);

        return response()->json([
            'message' => 'رکورد فروش با موفقیت ثبت و از موجودی انبار کسر شد.',
            'sale' => $sale,
            'data' => $sale,
        ], 201);
    }

    public function show(Request $request, int $saleId): JsonResponse
    {
        $this->authorizePermission('sales.view');

        $sale = Sale::withTrashed()
            ->with([
                'customer',
                'seller:id,name,email,phone,user_type,avatar',
                'items.part:id,name,code,unit,unit_price',
                'items.customerPart:id,serial_number,installation_date,warranty_expire_date,status,invoice_number',
                'activeInvoice',
                'invoices.creator:id,name',
            ])
            ->findOrFail($saleId);

        if ($sale->customer) {
            $this->authorizeCustomerAccess($sale->customer);
        }

        return response()->json($sale);
    }

    public function update(Request $request, Sale $sale): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasSafePermission('sales.manage') && !$actor->hasSafePermission('sales.create')) {
            abort(403, 'شما دسترسی لازم برای ویرایش فروش را ندارید.');
        }

        if ($sale->customer) {
            $this->authorizeCustomerAccess($sale->customer);
        }

        $this->normalizeNumericFields($request, [
            'unit_price',
            'item_discount_amount',
            'discount_amount',
            'tax_percent',
            'paid_amount',
        ]);

        $validated = $request->validate([
            'sale_date' => 'sometimes|date',
            'status' => 'sometimes|in:draft,confirmed',
            'payment_status' => 'sometimes|in:unpaid,partial,paid',
            'unit_price' => 'sometimes|nullable|numeric|min:0',
            'item_discount_amount' => 'sometimes|nullable|numeric|min:0',
            'discount_amount' => 'sometimes|nullable|numeric|min:0',
            'tax_percent' => 'sometimes|nullable|numeric|min:0|max:100',
            'paid_amount' => 'sometimes|nullable|numeric|min:0',
            'user_id' => 'sometimes|nullable|exists:users,id',
            'notes' => 'sometimes|nullable|string',
            'send_sms' => 'sometimes|boolean',
            'items' => 'sometimes|array',
            'items.*.id' => 'required_with:items|integer',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.discount_amount' => 'nullable|numeric|min:0',
        ], [
            'tax_percent.max' => 'درصد مالیات نمی‌تواند بیشتر از ۱۰۰ باشد.',
        ]);

        if (!empty($validated['user_id']) && !$actor->hasSafePermission('sales.manage')) {
            unset($validated['user_id']);
        }

        $updated = $this->saleService->updateSale($sale, $validated, $actor);

        return response()->json([
            'message' => 'اطلاعات فروش با موفقیت بروزرسانی شد.',
            'sale' => $updated,
            'data' => $updated,
        ]);
    }

    public function destroy(Request $request, Sale $sale): JsonResponse
    {
        $this->authorizePermission('sales.manage');
        if ($sale->customer) {
            $this->authorizeCustomerAccess($sale->customer);
        }

        $this->saleService->cancelSale($sale, $request->user());

        return response()->json([
            'message' => 'رکورد فروش لغو شد و از محاسبات آماری کنار گذاشته شد.',
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');

        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        return response()->json(
            $this->reportService->summary(
                $request->user(),
                $validated['from'] ?? null,
                $validated['to'] ?? null
            )
        );
    }

    public function charts(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');

        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'granularity' => 'nullable|in:day,week,month',
        ]);

        return response()->json(
            $this->reportService->charts(
                $request->user(),
                $validated['from'] ?? null,
                $validated['to'] ?? null,
                $validated['granularity'] ?? 'month'
            )
        );
    }

    public function export(Request $request): BinaryFileResponse
    {
        $this->authorizePermission('sales.view');

        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'status' => 'nullable|in:draft,confirmed,cancelled',
            'payment_status' => 'nullable|in:unpaid,partial,paid',
            'user_id' => 'nullable|integer',
            'customer_id' => 'nullable|integer',
        ]);

        $fromLabel = $validated['from'] ?? 'all';
        $toLabel = $validated['to'] ?? now()->toDateString();
        $filename = "sales-{$fromLabel}-to-{$toLabel}.xlsx";

        return Excel::download(
            new SalesExport(
                $request->user(),
                $validated['from'] ?? null,
                $validated['to'] ?? null,
                $validated['status'] ?? null,
                $validated['payment_status'] ?? null,
                isset($validated['user_id']) ? (int) $validated['user_id'] : null,
                isset($validated['customer_id']) ? (int) $validated['customer_id'] : null
            ),
            $filename
        );
    }

    public function customerSales(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('sales.view');
        $this->authorizeCustomerAccess($customer);

        if (!Schema::hasTable('sales')) {
            return response()->json([]);
        }

        $sales = Sale::with(['seller:id,name', 'items.part:id,name,code,unit', 'activeInvoice'])
            ->where('customer_id', $customer->id)
            ->orderByDesc('sale_date')
            ->orderByDesc('id')
            ->get();

        return response()->json($sales);
    }

    public function sellerOptions(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');

        /** @var User $user */
        $user = $request->user();
        $query = User::staffOnly()->where('is_active', true)->orderBy('name');

        if ($user->hasRestrictedCustomerScope()) {
            $allowedIds = [$user->id];
            if (Schema::hasTable('user_customer_staff_grants')) {
                $allowedIds = array_merge($allowedIds, $user->grantedStaff()->pluck('users.id')->all());
            }
            $query->whereIn('id', array_unique($allowedIds));
        }

        return response()->json($query->get(['id', 'name', 'user_type']));
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
