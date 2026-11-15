<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\User;
use App\Services\Sales\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InvoiceController extends Controller
{
    public function __construct(protected InvoiceService $invoiceService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');

        /** @var User $user */
        $user = $request->user();

        $query = Invoice::with([
            'sale' => fn ($q) => $q->with([
                'customer:id,first_name,last_name,company_name,type,mobile,phone,province,city,address,national_code',
                'seller:id,name',
                'items.part:id,name,code,unit',
            ]),
            'creator:id,name',
        ])->accessibleBy($user);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('issued_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('issued_at', '<=', $request->input('to'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->input('q'));
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();

            $query->where(function ($sub) use ($term, $normTerm, $op) {
                $sub->where('number', $op, "%{$normTerm}%")
                    ->orWhereHas('sale.customer', function ($cq) use ($term, $normTerm, $op) {
                        $cq->where('first_name', $op, "%{$term}%")
                            ->orWhere('last_name', $op, "%{$term}%")
                            ->orWhere('company_name', $op, "%{$term}%")
                            ->orWhere('mobile', $op, "%{$normTerm}%");
                    });
            });
        }

        $query->orderByDesc('issued_at')->orderByDesc('id');
        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        return response()->json($query->paginate($perPage));
    }

    public function summary(Request $request): JsonResponse
    {
        $this->authorizePermission('sales.view');
        /** @var User $user */
        $user = $request->user();

        $issuedCount = Invoice::accessibleBy($user)->where('status', Invoice::STATUS_ISSUED)->count();
        $paidCount = Invoice::accessibleBy($user)->where('status', Invoice::STATUS_PAID)->count();
        $voidCount = Invoice::accessibleBy($user)->where('status', Invoice::STATUS_VOID)->count();

        $uninvoicedSalesCount = Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereDoesntHave('activeInvoice')
            ->count();

        $uninvoicedSalesTotal = (int) Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereDoesntHave('activeInvoice')
            ->sum('total');

        $totalInvoicedAmount = (int) Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereHas('activeInvoice')
            ->sum('total');

        return response()->json([
            'issued_count' => $issuedCount,
            'paid_count' => $paidCount,
            'void_count' => $voidCount,
            'uninvoiced_sales_count' => $uninvoicedSalesCount,
            'uninvoiced_sales_total' => $uninvoicedSalesTotal,
            'total_invoiced_amount' => $totalInvoicedAmount,
        ]);
    }

    public function generate(Request $request, Sale $sale): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasSafePermission('sales.manage') && !$actor->hasSafePermission('sales.create')) {
            abort(403, 'شما دسترسی لازم برای صدور فاکتور را ندارید.');
        }

        if ($sale->customer) {
            $this->authorizeCustomerAccess($sale->customer);
        }

        $validated = $request->validate([
            'due_at' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
        ]);

        $invoice = $this->invoiceService->generateForSale(
            $sale,
            $actor,
            $validated['due_at'] ?? null,
            $validated['notes'] ?? null
        );

        return response()->json([
            'message' => "فاکتور رسمی شماره {$invoice->number} با موفقیت صادر شد.",
            'invoice' => $invoice,
            'data' => $invoice,
        ], 201);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizePermission('sales.view');

        $invoice->load([
            'sale' => fn ($q) => $q->with([
                'customer',
                'seller:id,name,email,phone',
                'items.part:id,name,code,unit',
                'items.customerPart:id,serial_number,warranty_expire_date',
            ]),
            'creator:id,name',
        ]);

        if ($invoice->sale?->customer) {
            $this->authorizeCustomerAccess($invoice->sale->customer);
        }

        $companyName = Setting::get('company_name') ?: null;
        $companyLogoPath = Setting::get('company_logo');
        $companyLogoUrl = ($companyLogoPath && Storage::disk('public')->exists($companyLogoPath))
            ? '/storage/' . ltrim($companyLogoPath, '/')
            : null;

        return response()->json([
            'invoice' => $invoice,
            'company' => [
                'name' => $companyName,
                'logo_url' => $companyLogoUrl,
            ],
        ]);
    }

    public function void(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizePermission('sales.manage');

        $invoice->loadMissing('sale.customer');
        if ($invoice->sale?->customer) {
            $this->authorizeCustomerAccess($invoice->sale->customer);
        }

        $voided = $this->invoiceService->voidInvoice($invoice, $request->user());

        return response()->json([
            'message' => "فاکتور شماره {$voided->number} باطل شد.",
            'invoice' => $voided,
        ]);
    }
}
