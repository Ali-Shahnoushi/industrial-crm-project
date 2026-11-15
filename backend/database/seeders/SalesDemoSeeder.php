<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Part;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Support\JalaliDate;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class SalesDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        // Backfill realistic unit prices on existing demo parts if still 0
        $defaultPrices = [
            'DEV-INV-55KW' => 240000000,
            'DEV-PMP-HYD300' => 195000000,
            'DEV-PLC-S71500' => 215000000,
            'DEV-CMP-ATLAS75' => 620000000,
            'DEV-HMI-TP1200' => 98000000,
        ];
        foreach ($defaultPrices as $code => $price) {
            Part::where('code', $code)
                ->where(function ($q) {
                    $q->whereNull('unit_price')->orWhere('unit_price', 0);
                })
                ->update(['unit_price' => $price]);
        }

        if (Sale::count() > 5) {
            return;
        }

        $customers = Customer::orderBy('id')->get();
        $parts = Part::where('is_active', true)->orderBy('id')->get();
        $sellers = User::staffOnly()->where('is_active', true)->orderBy('id')->get();

        if ($customers->isEmpty() || $parts->isEmpty() || $sellers->isEmpty()) {
            return;
        }

        $demoManager = $sellers->firstWhere('email', 'demo.manager@crm.local') ?? $sellers->first();
        $demoSales = $sellers->firstWhere('email', 'demo.sales@crm.local') ?? $sellers->last();
        $admin = $sellers->firstWhere('email', 'admin@crm.local') ?? $sellers->first();

        $effectiveCustomers = $customers->where('customer_type', 'effective')->values();
        if ($effectiveCustomers->isEmpty()) {
            $effectiveCustomers = $customers->take(3)->values();
        }

        $samples = [
            ['days_ago' => 145, 'seller' => $demoManager, 'part_idx' => 0, 'qty' => 1, 'discount' => 10000000, 'payment' => 'paid', 'invoice' => true],
            ['days_ago' => 122, 'seller' => $demoSales, 'part_idx' => 4, 'qty' => 2, 'discount' => 5000000, 'payment' => 'paid', 'invoice' => true],
            ['days_ago' => 98, 'seller' => $demoSales, 'part_idx' => 2, 'qty' => 1, 'discount' => 0, 'payment' => 'paid', 'invoice' => true],
            ['days_ago' => 76, 'seller' => $admin, 'part_idx' => 3, 'qty' => 1, 'discount' => 20000000, 'payment' => 'paid', 'invoice' => true],
            ['days_ago' => 54, 'seller' => $demoManager, 'part_idx' => 1, 'qty' => 2, 'discount' => 15000000, 'payment' => 'partial', 'invoice' => true],
            ['days_ago' => 39, 'seller' => $demoSales, 'part_idx' => 0, 'qty' => 2, 'discount' => 12000000, 'payment' => 'paid', 'invoice' => false],
            ['days_ago' => 21, 'seller' => $demoManager, 'part_idx' => 2, 'qty' => 2, 'discount' => 0, 'payment' => 'partial', 'invoice' => true],
            ['days_ago' => 11, 'seller' => $demoSales, 'part_idx' => 4, 'qty' => 3, 'discount' => 8000000, 'payment' => 'unpaid', 'invoice' => false],
            ['days_ago' => 4, 'seller' => $demoSales, 'part_idx' => 1, 'qty' => 1, 'discount' => 0, 'payment' => 'unpaid', 'invoice' => false],
            ['days_ago' => 1, 'seller' => $demoManager, 'part_idx' => 0, 'qty' => 1, 'discount' => 5000000, 'payment' => 'paid', 'invoice' => true],
        ];

        foreach ($samples as $idx => $s) {
            $customer = $effectiveCustomers[$idx % $effectiveCustomers->count()];
            $part = $parts[$s['part_idx'] % $parts->count()];
            $unitPrice = (int) ($part->unit_price ?: 150000000);
            $qty = (int) $s['qty'];
            $subtotal = $qty * $unitPrice;
            $discount = (int) $s['discount'];
            $taxable = max(0, $subtotal - $discount);
            $taxPercent = 10.0;
            $taxAmount = (int) round($taxable * ($taxPercent / 100));
            $total = $taxable + $taxAmount;

            $paidAmount = match ($s['payment']) {
                'paid' => $total,
                'partial' => (int) round($total * 0.5),
                default => 0,
            };

            $saleDate = Carbon::now()->subDays($s['days_ago'])->toDateString();

            $sale = Sale::create([
                'customer_id' => $customer->id,
                'user_id' => $s['seller']->id,
                'sale_date' => $saleDate,
                'status' => Sale::STATUS_CONFIRMED,
                'payment_status' => $s['payment'],
                'subtotal' => $subtotal,
                'discount_amount' => $discount,
                'tax_percent' => $taxPercent,
                'tax_amount' => $taxAmount,
                'total' => $total,
                'paid_amount' => $paidAmount,
                'notes' => 'فروش نمونه جهت نمایش گزارش‌ها و نمودارها',
            ]);

            SaleItem::create([
                'sale_id' => $sale->id,
                'part_id' => $part->id,
                'customer_part_id' => null,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'discount_amount' => 0,
                'line_total' => $subtotal,
            ]);

            if ($s['invoice']) {
                [$jy] = JalaliDate::gregorianToJalali(
                    (int) Carbon::parse($saleDate)->year,
                    (int) Carbon::parse($saleDate)->month,
                    (int) Carbon::parse($saleDate)->day
                );
                $nextSeq = (int) (Invoice::where('jalali_year', $jy)->max('sequence_number') ?? 0) + 1;
                $invNumber = sprintf('INV-%04d-%04d', $jy, $nextSeq);
                while (Invoice::where('number', $invNumber)->exists()) {
                    $nextSeq++;
                    $invNumber = sprintf('INV-%04d-%04d', $jy, $nextSeq);
                }

                Invoice::create([
                    'sale_id' => $sale->id,
                    'number' => $invNumber,
                    'jalali_year' => $jy,
                    'sequence_number' => $nextSeq,
                    'issued_at' => $saleDate,
                    'status' => $s['payment'] === 'paid' ? Invoice::STATUS_PAID : Invoice::STATUS_ISSUED,
                    'created_by_user_id' => $s['seller']->id,
                ]);
            }
        }
    }
}
