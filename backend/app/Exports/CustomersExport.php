<?php

namespace App\Exports;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\User;
use App\Support\JalaliDate;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;

class CustomersExport implements
    FromCollection,
    WithHeadings,
    WithMapping,
    ShouldAutoSize,
    WithCustomCsvSettings,
    WithEvents,
    WithTitle,
    WithMultipleSheets
{
    protected ?string $type;
    protected ?User $user;
    protected ?Collection $cachedCustomers = null;

    public function __construct(?string $type = null, ?User $user = null)
    {
        $this->type = $type;
        $this->user = $user;
    }

    protected function getCustomers(): Collection
    {
        if ($this->cachedCustomers !== null) {
            return $this->cachedCustomers;
        }

        $query = Customer::with(['customerParts.part', 'creator'])->latest();

        if ($this->user) {
            $query->accessibleBy($this->user);
        }

        if ($this->type && in_array($this->type, ['potential', 'effective'], true)) {
            $query->where('customer_type', $this->type);
        }

        $this->cachedCustomers = $query->get();

        return $this->cachedCustomers;
    }

    public function sheets(): array
    {
        $customers = $this->getCustomers();

        return [
            new CustomersSummarySheet($customers),
            new CustomerDevicesDetailSheet($customers),
        ];
    }

    public function title(): string
    {
        return 'مشتریان و دستگاه‌ها';
    }

    public function getCsvSettings(): array
    {
        return [
            'delimiter' => ',',
            'enclosure' => '"',
            'use_bom' => true,
            'output_encoding' => 'UTF-8',
        ];
    }

    public function collection()
    {
        return $this->getCustomers();
    }

    public function headings(): array
    {
        return CustomersSummarySheet::sheetHeadings();
    }

    /**
     * @param Customer $customer
     */
    public function map($customer): array
    {
        return CustomersSummarySheet::mapCustomerRow($customer);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $event->sheet->getDelegate()->setRightToLeft(true);
            },
        ];
    }
}

class CustomersSummarySheet implements
    FromCollection,
    WithHeadings,
    WithMapping,
    ShouldAutoSize,
    WithEvents,
    WithTitle,
    WithCustomCsvSettings
{
    public function __construct(protected Collection $customers)
    {
    }

    public function title(): string
    {
        return 'مشتریان و دستگاه‌ها';
    }

    public function getCsvSettings(): array
    {
        return [
            'use_bom' => true,
            'output_encoding' => 'UTF-8',
        ];
    }

    public function collection()
    {
        return $this->customers;
    }

    public static function sheetHeadings(): array
    {
        return [
            'شناسه مشتری',
            'وضعیت مشتری',
            'نوع شخصیت',
            'نام',
            'نام خانوادگی',
            'نام شرکت / سازمان',
            'کد ملی / شناسه ملی',
            'شماره همراه',
            'تلفن ثابت',
            'ایمیل',
            'استان',
            'شهر',
            'آدرس',
            'کارشناس ثبت‌کننده',
            'تعداد کل دستگاه‌ها',
            'نام دستگاه‌ها',
            'کد فنی دستگاه‌ها',
            'شماره سریال دستگاه‌ها',
            'تعداد هر دستگاه',
            'شماره فاکتورها',
            'مبالغ فاکتورها (تومان)',
            'جمع کل مبلغ فاکتورها (تومان)',
            'یادداشت پرونده',
            'تاریخ ثبت',
        ];
    }

    public function headings(): array
    {
        return self::sheetHeadings();
    }

    public static function mapCustomerRow(Customer $customer): array
    {
        $assignments = $customer->customerParts ?? collect();

        $totalDevicesQty = (int) $assignments->sum(fn (CustomerPart $cp) => max(1, (int) ($cp->quantity ?: 1)));
        $deviceNames = $assignments
            ->map(fn (CustomerPart $cp) => $cp->part?->name ?? 'دستگاه')
            ->filter()
            ->implode(' | ');
        $deviceCodes = $assignments
            ->map(fn (CustomerPart $cp) => $cp->part?->code ?? '—')
            ->implode(' | ');
        $serialNumbers = $assignments
            ->map(fn (CustomerPart $cp) => $cp->serial_number ?: '—')
            ->implode(' | ');
        $perDeviceQuantities = $assignments
            ->map(function (CustomerPart $cp) {
                $name = $cp->part?->name ?? 'دستگاه';
                $qty = max(1, (int) ($cp->quantity ?: 1));
                return "{$name}: {$qty} عدد";
            })
            ->implode(' | ');
        $invoiceNumbers = $assignments
            ->map(fn (CustomerPart $cp) => $cp->invoice_number ?: '—')
            ->implode(' | ');
        $invoiceAmounts = $assignments
            ->map(function (CustomerPart $cp) {
                if ($cp->invoice_amount === null) {
                    return '—';
                }
                return number_format((float) $cp->invoice_amount, 0, '.', ',');
            })
            ->implode(' | ');
        $totalInvoiceSum = (int) $assignments->sum(fn (CustomerPart $cp) => (int) ($cp->invoice_amount ?? 0));

        return [
            $customer->id,
            $customer->customer_type === 'effective' ? 'بالفعل' : 'بالقوه',
            $customer->type === 'company' ? 'حقوقی' : 'حقیقی',
            $customer->first_name ?? '',
            $customer->last_name ?? '',
            $customer->company_name ?? '',
            $customer->national_code ?? '',
            $customer->mobile ?? '',
            $customer->phone ?? '',
            $customer->email ?? '',
            $customer->province ?? '',
            $customer->city ?? '',
            $customer->address ?? '',
            $customer->creator?->name ?? 'سیستم',
            $totalDevicesQty,
            $deviceNames,
            $deviceCodes,
            $serialNumbers,
            $perDeviceQuantities,
            $invoiceNumbers,
            $invoiceAmounts,
            $totalInvoiceSum,
            $customer->notes ?? '',
            JalaliDate::formatDateTime($customer->created_at),
        ];
    }

    /**
     * @param Customer $customer
     */
    public function map($customer): array
    {
        return self::mapCustomerRow($customer);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $event->sheet->getDelegate()->setRightToLeft(true);
            },
        ];
    }
}

class CustomerDevicesDetailSheet implements
    FromCollection,
    WithHeadings,
    WithMapping,
    ShouldAutoSize,
    WithEvents,
    WithTitle
{
    public function __construct(protected Collection $customers)
    {
    }

    public function title(): string
    {
        return 'ریز دستگاه‌ها و فاکتورها';
    }

    public function collection()
    {
        $rows = collect();
        foreach ($this->customers as $customer) {
            foreach ($customer->customerParts ?? [] as $cp) {
                $cp->setRelation('customer', $customer);
                $rows->push($cp);
            }
        }
        return $rows;
    }

    public function headings(): array
    {
        return [
            'شناسه تخصیص',
            'شناسه مشتری',
            'نام مشتری / شرکت',
            'نوع شخصیت',
            'شماره همراه مشتری',
            'نام دستگاه',
            'کد فنی دستگاه',
            'شماره سریال',
            'تعداد',
            'شماره فاکتور',
            'مبلغ فاکتور (تومان)',
            'تاریخ تحویل / نصب',
            'پایان گارانتی',
            'وضعیت دستگاه',
            'توضیحات',
        ];
    }

    /**
     * @param CustomerPart $cp
     */
    public function map($cp): array
    {
        $customer = $cp->customer;
        $statusLabel = match ($cp->status) {
            'active' => 'فعال',
            'under_repair' => 'در دست تعمیر',
            'replaced' => 'تعویض‌شده',
            'retired' => 'خارج از رده',
            default => $cp->status,
        };

        return [
            $cp->id,
            $customer?->id ?? '',
            $customer?->display_name ?? '',
            $customer?->type === 'company' ? 'حقوقی' : 'حقیقی',
            $customer?->mobile ?? '',
            $cp->part?->name ?? '',
            $cp->part?->code ?? '',
            $cp->serial_number ?? '',
            max(1, (int) ($cp->quantity ?: 1)),
            $cp->invoice_number ?? '',
            $cp->invoice_amount !== null ? (int) $cp->invoice_amount : '',
            JalaliDate::format($cp->installation_date),
            JalaliDate::format($cp->warranty_expire_date),
            $statusLabel,
            $cp->notes ?? '',
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $event->sheet->getDelegate()->setRightToLeft(true);
            },
        ];
    }
}
