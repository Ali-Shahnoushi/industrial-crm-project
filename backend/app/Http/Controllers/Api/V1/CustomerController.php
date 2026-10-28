<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\CustomersExport;
use App\Exports\CustomersTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\CustomersImport;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $query = Customer::withCount('customerParts')->latest();

        if ($request->filled('customer_type') && in_array($request->customer_type, ['potential', 'effective'])) {
            $query->where('customer_type', $request->customer_type);
        }

        if ($request->filled('q')) {
            $term = trim($request->q);
            $query->where(function ($q) use ($term) {
                $q->where('first_name', 'ilike', "%{$term}%")
                    ->orWhere('last_name', 'ilike', "%{$term}%")
                    ->orWhere('company_name', 'ilike', "%{$term}%")
                    ->orWhere('mobile', 'ilike', "%{$term}%")
                    ->orWhere('national_code', 'ilike', "%{$term}%")
                    ->orWhere('city', 'ilike', "%{$term}%")
                    ->orWhere('province', 'ilike', "%{$term}%")
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) ILIKE ?", ["%{$term}%"]);
            });
        }

        $perPage = (int) $request->input('per_page', 15);
        $customers = $query->paginate($perPage);

        return response()->json($customers);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.create');

        $personType = $request->input('type', 'individual');
        $nationalCodeRule = $personType === 'company'
            ? 'nullable|string|regex:/^\d{11}$/'
            : 'nullable|string|regex:/^\d{10}$/';

        $validated = $request->validate([
            'customer_type' => 'required|in:potential,effective',
            'type' => 'required|in:individual,company',
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'company_name' => 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{10}$/'],
            'email' => 'nullable|email|max:150',
            'province' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
        ], [
            'national_code.regex' => $personType === 'company'
                ? 'شناسه ملی شخص حقوقی باید دقیقاً ۱۱ رقم عددی باشد.'
                : 'کد ملی شخص حقیقی باید دقیقاً ۱۰ رقم عددی باشد.',
            'mobile.regex' => 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.',
            'phone.regex' => 'شماره تلفن ثابت باید ۱۱ رقم عددی بوده و با 0 شروع شود (مانند 02188776655).',
        ]);

        $customer = Customer::create($validated);

        $customer->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'created',
            'description' => "مشتری جدید («{$customer->full_name}») در سامانه ثبت شد.",
        ]);

        return response()->json([
            'message' => 'مشتری با موفقیت ثبت شد.',
            'customer' => $customer,
        ], 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $customer->load([
            'customerParts.part',
            'customerParts.serviceHistories.performedBy',
            'histories.user',
            'smsLogs',
        ]);

        return response()->json($customer);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.edit');

        $personType = $request->input('type', $customer->type);
        $nationalCodeRule = $personType === 'company'
            ? 'nullable|string|regex:/^\d{11}$/'
            : 'nullable|string|regex:/^\d{10}$/';

        $validated = $request->validate([
            'customer_type' => 'sometimes|in:potential,effective',
            'type' => 'sometimes|in:individual,company',
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'company_name' => 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['sometimes', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{10}$/'],
            'email' => 'nullable|email|max:150',
            'province' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
        ], [
            'national_code.regex' => $personType === 'company'
                ? 'شناسه ملی شخص حقوقی باید دقیقاً ۱۱ رقم عددی باشد.'
                : 'کد ملی شخص حقیقی باید دقیقاً ۱۰ رقم عددی باشد.',
            'mobile.regex' => 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.',
            'phone.regex' => 'شماره تلفن ثابت باید ۱۱ رقم عددی بوده و با 0 شروع شود (مانند 02188776655).',
        ]);

        $customer->update($validated);

        $customer->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'updated',
            'description' => 'مشخصات پرونده مشتری ویرایش شد.',
        ]);

        return response()->json([
            'message' => 'اطلاعات مشتری بروزرسانی شد.',
            'customer' => $customer,
        ]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.delete');

        $name = $customer->full_name;
        $customer->delete();

        return response()->json([
            'message' => "مشتری «{$name}» با موفقیت حذف شد.",
        ]);
    }

    /**
     * Import customers from Excel (.xlsx, .xls, .csv)
     */
    public function import(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.import');

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        $import = new CustomersImport();
        Excel::import($import, $request->file('file'));

        return response()->json([
            'message' => "عملیات ورود با موفقیت انجام شد. {$import->getImportedCount()} مشتری ثبت/بروزرسانی شد.",
            'imported_count' => $import->getImportedCount(),
            'errors' => $import->getErrors(),
        ]);
    }

    /**
     * Export customers to Excel (.xlsx)
     */
    public function export(Request $request)
    {
        $this->authorizePermission('customers.export');

        $type = $request->query('customer_type');
        $fileName = 'customers-' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(new CustomersExport($type), $fileName);
    }

    /**
     * Download sample Excel template (.xlsx)
     */
    public function template()
    {
        return Excel::download(new CustomersTemplateExport(), 'customers-sample-template.xlsx');
    }

    protected function authorizePermission(string $permission): void
    {
        $user = auth()->user();
        if (!$user || !$user->hasPermissionTo($permission)) {
            abort(403, "شما دسترسی لازم ({$permission}) برای این عملیات را ندارید.");
        }
    }
}
