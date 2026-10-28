<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Services\Customers\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartController extends Controller
{
    public function __construct(protected CustomerService $customerService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $query = Part::withCount('customerParts')->latest();

        if ($request->filled('q')) {
            $term = trim($request->q);
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                    ->orWhere('code', 'ilike', "%{$term}%")
                    ->orWhere('description', 'ilike', "%{$term}%");
            });
        }

        $parts = $query->get();

        return response()->json($parts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-zA-Z0-9]+$/', 'unique:parts,code'],
            'periodic_service_months' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'code.regex' => 'کد قطعه (SKU) فقط می‌تواند شامل حروف انگلیسی و اعداد باشد.',
            'code.unique' => 'این کد قطعه قبلاً در سیستم ثبت شده است.',
        ]);

        $part = Part::create($validated);

        return response()->json([
            'message' => 'مدل قطعه با موفقیت در کاتالوگ ثبت شد.',
            'part' => $part,
        ], 201);
    }

    public function show(Part $part): JsonResponse
    {
        $this->authorizePermission('parts.view');

        $part->load(['customerParts.customer']);

        return response()->json($part);
    }

    public function update(Request $request, Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'code' => ['sometimes', 'string', 'max:50', 'regex:/^[a-zA-Z0-9]+$/', "unique:parts,code,{$part->id}"],
            'periodic_service_months' => 'sometimes|integer|min:1',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'code.regex' => 'کد قطعه (SKU) فقط می‌تواند شامل حروف انگلیسی و اعداد باشد.',
            'code.unique' => 'این کد قطعه قبلاً در سیستم ثبت شده است.',
        ]);

        $part->update($validated);

        return response()->json([
            'message' => 'مشخصات مدل قطعه بروزرسانی شد.',
            'part' => $part,
        ]);
    }

    public function destroy(Part $part): JsonResponse
    {
        $this->authorizePermission('parts.manage');

        if ($part->customerParts()->exists()) {
            return response()->json([
                'message' => 'این قطعه به مشتریان تخصیص داده شده و امکان حذف مستقیم آن وجود ندارد.',
            ], 422);
        }

        $part->delete();

        return response()->json([
            'message' => 'مدل قطعه با موفقیت حذف شد.',
        ]);
    }

    /**
     * Assign a physical part with unique serial number to a customer.
     * Automatically transitions customer from 'potential' to 'effective'.
     */
    public function assign(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('parts.assign');

        $validated = $request->validate([
            'part_id' => 'required|exists:parts,id',
            'serial_number' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9]+$/', 'unique:customer_parts,serial_number'],
            'installation_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ], [
            'serial_number.regex' => 'شماره سریال فقط می‌تواند شامل حروف انگلیسی و اعداد باشد.',
            'serial_number.unique' => 'این شماره سریال قبلاً به مشتری دیگری تخصیص داده شده است.',
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
            'message' => "قطعه «{$part->name}» با شماره سریال {$customerPart->serial_number} به مشتری تخصیص داده شد.",
            'customer_part' => $customerPart,
            'customer_type' => $customer->fresh()->customer_type,
        ], 201);
    }

    /**
     * Record past service or repair record for a customer part.
     */
    public function addServiceHistory(Request $request, CustomerPart $customerPart): JsonResponse
    {
        $this->authorizePermission('parts.history');

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
            'message' => 'سابقه سرویس/تعمیر با موفقیت ثبت شد.',
            'history' => $history->load('performedBy'),
        ], 201);
    }

    protected function authorizePermission(string $permission): void
    {
        $user = auth()->user();
        if (!$user || !$user->hasPermissionTo($permission)) {
            abort(403, "شما دسترسی لازم ({$permission}) برای این عملیات را ندارید.");
        }
    }
}
