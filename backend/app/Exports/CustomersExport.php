<?php

namespace App\Exports;

use App\Models\Customer;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class CustomersExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize
{
    protected $type;

    public function __construct(?string $type = null)
    {
        $this->type = $type;
    }

    public function collection()
    {
        $query = Customer::latest();
        if ($this->type && in_array($this->type, ['potential', 'effective'])) {
            $query->where('customer_type', $this->type);
        }
        return $query->get();
    }

    public function headings(): array
    {
        return [
            'نوع مشتری',
            'نوع شخص',
            'نام',
            'نام خانوادگی',
            'نام شرکت',
            'کد ملی / شناسه ملی',
            'شماره همراه',
            'تلفن ثابت',
            'ایمیل',
            'استان',
            'شهر',
            'آدرس',
            'یادداشت',
            'تاریخ ثبت',
        ];
    }

    /**
     * @param Customer $customer
     */
    public function map($customer): array
    {
        return [
            $customer->customer_type === 'effective' ? 'بالفعل' : 'بالقوه',
            $customer->type === 'company' ? 'حقوقی' : 'حقیقی',
            $customer->first_name,
            $customer->last_name,
            $customer->company_name ?? '',
            $customer->national_code ?? '',
            $customer->mobile,
            $customer->phone ?? '',
            $customer->email ?? '',
            $customer->province ?? '',
            $customer->city ?? '',
            $customer->address ?? '',
            $customer->notes ?? '',
            $customer->created_at?->format('Y/m/d H:i') ?? '',
        ];
    }
}
