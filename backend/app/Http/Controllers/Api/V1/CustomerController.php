<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\CustomersExport;
use App\Exports\CustomersSummarySheet;
use App\Exports\CustomersTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\CustomersImport;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $query = Customer::accessibleBy($request->user())
            ->with('creator:id,name')
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
                    ->orWhereRaw("{$fullNameExpr} {$op} ?", ["%{$term}%"]);
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
            'customer_type' => 'required|in:potential,effective',
            'type' => 'required|in:individual,company',
            'first_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'last_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'company_name' => $personType === 'company' ? 'required|string|max:150' : 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['nullable', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{10}$/'],
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
            'phone.regex' => 'شماره تلفن ثابت باید ۱۱ رقم عددی بوده و با 0 شروع شود (مانند 02188776655).',
        ]);

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
        ], 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.view');
        $this->authorizeCustomerAccess($customer);

        $customer->load([
            'creator:id,name',
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
        $this->authorizeCustomerAccess($customer);

        $this->prepareCustomerInput($request);

        $personType = $request->input('type', $customer->type);
        $nationalCodeRule = $personType === 'company'
            ? 'nullable|string|regex:/^\d{11}$/'
            : 'nullable|string|regex:/^\d{10}$/';

        $validated = $request->validate([
            'customer_type' => 'sometimes|in:potential,effective',
            'type' => 'sometimes|in:individual,company',
            'first_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'last_name' => $personType === 'company' ? 'nullable|string|max:100' : 'required|string|max:100',
            'company_name' => $personType === 'company' ? 'required|string|max:150' : 'nullable|string|max:150',
            'national_code' => $nationalCodeRule,
            'mobile' => ['nullable', 'string', 'regex:/^09\d{9}$/'],
            'phone' => ['nullable', 'string', 'regex:/^0\d{10}$/'],
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
            'phone.regex' => 'شماره تلفن ثابت باید ۱۱ رقم عددی بوده و با 0 شروع شود (مانند 02188776655).',
        ]);

        DB::transaction(function () use ($customer, $validated, $request) {
            $customer->update($validated);

            $customer->histories()->create([
                'user_id' => $request->user()->id,
                'action' => 'updated',
                'description' => 'مشخصات پرونده مشتری ویرایش شد.',
            ]);
        });

        return response()->json([
            'message' => 'اطلاعات مشتری بروزرسانی شد.',
            'customer' => $customer->fresh('creator:id,name'),
        ]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorizePermission('customers.delete');
        $this->authorizeCustomerAccess($customer);

        $name = $customer->display_name;
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

        $import = new CustomersImport($request->user());
        Excel::import($import, $request->file('file'));

        return response()->json([
            'message' => "عملیات ورود با موفقیت انجام شد. {$import->getImportedCount()} مشتری ثبت/بروزرسانی شد.",
            'imported_count' => $import->getImportedCount(),
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
     * Download sample Excel template (.xlsx)
     */
    public function template()
    {
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
