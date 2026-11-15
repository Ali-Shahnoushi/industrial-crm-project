<?php

namespace App\Exports;

use App\Models\Sale;
use App\Models\User;
use App\Support\JalaliDate;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;

class SalesExport implements
    FromCollection,
    WithHeadings,
    WithMapping,
    ShouldAutoSize,
    WithCustomCsvSettings,
    WithEvents,
    WithTitle
{
    public function __construct(
        protected User $user,
        protected ?string $from = null,
        protected ?string $to = null,
        protected ?string $status = null,
        protected ?string $paymentStatus = null,
        protected ?int $sellerId = null,
        protected ?int $customerId = null,
    ) {
    }

    public function title(): string
    {
        return 'گزارش فروش';
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

    public function collection(): Collection
    {
        $query = Sale::with(['customer', 'seller', 'items.part', 'activeInvoice'])
            ->accessibleBy($this->user)
            ->orderByDesc('sale_date')
            ->orderByDesc('id');

        if ($this->from) {
            $query->whereDate('sale_date', '>=', $this->from);
        }
        if ($this->to) {
            $query->whereDate('sale_date', '<=', $this->to);
        }
        if ($this->status && in_array($this->status, [Sale::STATUS_DRAFT, Sale::STATUS_CONFIRMED, Sale::STATUS_CANCELLED], true)) {
            if ($this->status === Sale::STATUS_CANCELLED) {
                $query->withTrashed();
            }
            $query->where('status', $this->status);
        } else {
            $query->where('status', '!=', Sale::STATUS_CANCELLED);
        }
        if ($this->paymentStatus && in_array($this->paymentStatus, [Sale::PAYMENT_UNPAID, Sale::PAYMENT_PARTIAL, Sale::PAYMENT_PAID], true)) {
            $query->where('payment_status', $this->paymentStatus);
        }
        if ($this->sellerId) {
            $query->where('user_id', $this->sellerId);
        }
        if ($this->customerId) {
            $query->where('customer_id', $this->customerId);
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'شناسه فروش',
            'تاریخ شمسی فروش',
            'نام مشتری',
            'شماره موبایل مشتری',
            'کارشناس فروش',
            'دستگاه‌ها / اقلام',
            'تعداد کل',
            'جمع جزء (تومان)',
            'تخفیف (تومان)',
            'مالیات (%)',
            'مبلغ مالیات (تومان)',
            'مبلغ نهایی (تومان)',
            'پرداخت‌شده (تومان)',
            'وضعیت فروش',
            'وضعیت پرداخت',
            'شماره فاکتور',
            'توضیحات',
        ];
    }

    /**
     * @param Sale $sale
     */
    public function map($sale): array
    {
        $statusLabel = match ($sale->status) {
            Sale::STATUS_CONFIRMED => 'تایید شده',
            Sale::STATUS_DRAFT => 'پیش‌نویس',
            Sale::STATUS_CANCELLED => 'لغو شده',
            default => $sale->status,
        };

        $paymentLabel = match ($sale->payment_status) {
            Sale::PAYMENT_PAID => 'پرداخت کامل',
            Sale::PAYMENT_PARTIAL => 'پرداخت جزئی',
            Sale::PAYMENT_UNPAID => 'پرداخت‌نشده',
            default => $sale->payment_status,
        };

        $itemsDesc = $sale->items
            ->map(fn ($item) => ($item->part?->name ?? 'دستگاه') . ' × ' . $item->quantity)
            ->implode(' | ');

        $totalQty = $sale->items->sum('quantity');

        return CustomersExport::sanitizeRow([
            $sale->id,
            JalaliDate::format($sale->sale_date),
            $sale->customer?->display_name ?? '—',
            $sale->customer?->mobile ?? '—',
            $sale->seller?->name ?? '—',
            $itemsDesc ?: '—',
            $totalQty,
            (int) $sale->subtotal,
            (int) $sale->discount_amount,
            (float) $sale->tax_percent,
            (int) $sale->tax_amount,
            (int) $sale->total,
            (int) $sale->paid_amount,
            $statusLabel,
            $paymentLabel,
            $sale->activeInvoice?->number ?? '—',
            $sale->notes ?? '',
        ]);
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
