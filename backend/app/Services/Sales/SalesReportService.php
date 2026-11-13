<?php

namespace App\Services\Sales;

use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Support\JalaliDate;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SalesReportService
{
    private const JALALI_MONTHS = [
        1 => 'فروردین',
        2 => 'اردیبهشت',
        3 => 'خرداد',
        4 => 'تیر',
        5 => 'مرداد',
        6 => 'شهریور',
        7 => 'مهر',
        8 => 'آبان',
        9 => 'آذر',
        10 => 'دی',
        11 => 'بهمن',
        12 => 'اسفند',
    ];

    /**
     * Resolve effective [from, to] Carbon bounds. Defaults to last 180 days if omitted.
     *
     * @return array{0:Carbon,1:Carbon}
     */
    public function resolvePeriod(?string $from, ?string $to): array
    {
        $end = $to ? Carbon::parse($to)->endOfDay() : Carbon::now()->endOfDay();
        $start = $from ? Carbon::parse($from)->startOfDay() : (clone $end)->subDays(179)->startOfDay();

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
        }

        return [$start, $end];
    }

    public function summary(User $user, ?string $from = null, ?string $to = null): array
    {
        [$start, $end] = $this->resolvePeriod($from, $to);
        $daysSpan = max(1, (int) $start->diffInDays($end) + 1);

        $prevEnd = $start->copy()->subDay()->endOfDay();
        $prevStart = $prevEnd->copy()->subDays($daysSpan - 1)->startOfDay();

        $baseQuery = fn (Carbon $s, Carbon $e) => Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sale_date', [$s->toDateString(), $e->toDateString()]);

        $currentAgg = $baseQuery($start, $end)
            ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total_revenue, COALESCE(SUM(CASE WHEN total > paid_amount THEN total - paid_amount ELSE 0 END), 0) as unpaid_amount')
            ->first();

        $prevAgg = $baseQuery($prevStart, $prevEnd)
            ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total_revenue')
            ->first();

        $salesCount = (int) ($currentAgg->sales_count ?? 0);
        $totalRevenue = (int) ($currentAgg->total_revenue ?? 0);
        $unpaidAmount = (int) ($currentAgg->unpaid_amount ?? 0);
        $avgOrderValue = $salesCount > 0 ? (int) round($totalRevenue / $salesCount) : 0;

        $prevSalesCount = (int) ($prevAgg->sales_count ?? 0);
        $prevRevenue = (int) ($prevAgg->total_revenue ?? 0);

        $revenueDeltaPct = $this->percentDelta($totalRevenue, $prevRevenue);
        $salesCountDeltaPct = $this->percentDelta($salesCount, $prevSalesCount);

        // Conversion rate: distinct accessible customers with >= 1 confirmed sale / all accessible customers
        $totalCustomers = Customer::accessibleBy($user)->count();
        $convertingCustomersTotal = Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->distinct('customer_id')
            ->count('customer_id');

        $conversionRate = $totalCustomers > 0
            ? round(($convertingCustomersTotal / $totalCustomers) * 100, 1)
            : 0.0;

        $convertingInPeriod = $baseQuery($start, $end)->distinct('customer_id')->count('customer_id');
        $convertingInPrev = $baseQuery($prevStart, $prevEnd)->distinct('customer_id')->count('customer_id');
        $periodConversion = $totalCustomers > 0 ? round(($convertingInPeriod / $totalCustomers) * 100, 1) : 0.0;
        $prevPeriodConversion = $totalCustomers > 0 ? round(($convertingInPrev / $totalCustomers) * 100, 1) : 0.0;
        $conversionDeltaPct = round($periodConversion - $prevPeriodConversion, 1);

        // Top salesperson in period
        $topSellerRow = Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sale_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotNull('user_id')
            ->select('user_id', DB::raw('COUNT(*) as sales_count'), DB::raw('SUM(total) as total_revenue'))
            ->groupBy('user_id')
            ->orderByDesc('total_revenue')
            ->first();

        $topSalesperson = null;
        if ($topSellerRow) {
            $seller = User::find($topSellerRow->user_id);
            $topSalesperson = [
                'user_id' => (int) $topSellerRow->user_id,
                'name' => $seller?->name ?? 'نامشخص',
                'total_revenue' => (int) $topSellerRow->total_revenue,
                'sales_count' => (int) $topSellerRow->sales_count,
            ];
        }

        // Top-selling part in period (by quantity sold)
        $topPartRow = SaleItem::query()
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('parts', 'sale_items.part_id', '=', 'parts.id')
            ->whereNull('sales.deleted_at')
            ->where('sales.status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sales.sale_date', [$start->toDateString(), $end->toDateString()])
            ->when($user->hasRestrictedCustomerScope(), function ($q) use ($user) {
                $q->whereIn('sales.customer_id', Customer::accessibleBy($user)->select('id'));
            })
            ->select(
                'parts.id as part_id',
                'parts.name',
                'parts.code',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.line_total) as total_revenue')
            )
            ->groupBy('parts.id', 'parts.name', 'parts.code')
            ->orderByDesc('total_quantity')
            ->orderByDesc('total_revenue')
            ->first();

        $topPart = $topPartRow ? [
            'part_id' => (int) $topPartRow->part_id,
            'name' => $topPartRow->name,
            'code' => $topPartRow->code,
            'total_quantity' => (int) $topPartRow->total_quantity,
            'total_revenue' => (int) $topPartRow->total_revenue,
        ] : null;

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'total_revenue' => $totalRevenue,
            'revenue_delta_pct' => $revenueDeltaPct,
            'sales_count' => $salesCount,
            'sales_count_delta_pct' => $salesCountDeltaPct,
            'average_order_value' => $avgOrderValue,
            'unpaid_amount' => $unpaidAmount,
            'conversion_rate' => $conversionRate,
            'conversion_delta_pct' => $conversionDeltaPct,
            'converting_customers_count' => $convertingCustomersTotal,
            'total_customers_count' => $totalCustomers,
            'top_salesperson' => $topSalesperson,
            'top_part' => $topPart,
        ];
    }

    public function charts(User $user, ?string $from = null, ?string $to = null, string $granularity = 'month'): array
    {
        [$start, $end] = $this->resolvePeriod($from, $to);
        if (!in_array($granularity, ['day', 'week', 'month'], true)) {
            $granularity = 'month';
        }

        // 1. Revenue over time (Jalali calendar buckets, DB-driver independent)
        $salesRows = Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sale_date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('sale_date')
            ->get(['id', 'user_id', 'sale_date', 'total']);

        $buckets = [];
        // Pre-populate empty buckets for continuous chart timeline
        $cursor = $start->copy()->startOfDay();
        $endDay = $end->copy()->startOfDay();
        while ($cursor->lte($endDay)) {
            [$key, $label] = $this->bucketKeyAndLabel($cursor, $granularity);
            if (!isset($buckets[$key])) {
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $label,
                    'total_revenue' => 0,
                    'sales_count' => 0,
                ];
            }
            $cursor->addDay();
        }

        foreach ($salesRows as $row) {
            $dt = Carbon::parse($row->sale_date);
            [$key, $label] = $this->bucketKeyAndLabel($dt, $granularity);
            if (!isset($buckets[$key])) {
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $label,
                    'total_revenue' => 0,
                    'sales_count' => 0,
                ];
            }
            $buckets[$key]['total_revenue'] += (int) $row->total;
            $buckets[$key]['sales_count'] += 1;
        }
        ksort($buckets);

        // 2. Sales by salesperson
        $sellerRows = Sale::accessibleBy($user)
            ->where('status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sale_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotNull('user_id')
            ->select('user_id', DB::raw('COUNT(*) as sales_count'), DB::raw('SUM(total) as total_revenue'))
            ->groupBy('user_id')
            ->orderByDesc('total_revenue')
            ->get();

        $sellerNames = User::whereIn('id', $sellerRows->pluck('user_id'))
            ->pluck('name', 'id');

        $bySalesperson = $sellerRows->map(fn ($r) => [
            'user_id' => (int) $r->user_id,
            'name' => $sellerNames[$r->user_id] ?? 'کارشناس نامشخص',
            'sales_count' => (int) $r->sales_count,
            'total_revenue' => (int) $r->total_revenue,
        ])->values()->all();

        // 3. Sales by part
        $partRows = SaleItem::query()
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('parts', 'sale_items.part_id', '=', 'parts.id')
            ->whereNull('sales.deleted_at')
            ->where('sales.status', Sale::STATUS_CONFIRMED)
            ->whereBetween('sales.sale_date', [$start->toDateString(), $end->toDateString()])
            ->when($user->hasRestrictedCustomerScope(), function ($q) use ($user) {
                $q->whereIn('sales.customer_id', Customer::accessibleBy($user)->select('id'));
            })
            ->select(
                'parts.id as part_id',
                'parts.name',
                'parts.code',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.line_total) as total_revenue')
            )
            ->groupBy('parts.id', 'parts.name', 'parts.code')
            ->orderByDesc('total_revenue')
            ->get();

        $byPart = $partRows->map(fn ($r) => [
            'part_id' => (int) $r->part_id,
            'name' => $r->name,
            'code' => $r->code,
            'total_quantity' => (int) $r->total_quantity,
            'total_revenue' => (int) $r->total_revenue,
        ])->values()->all();

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'granularity' => $granularity,
            ],
            'revenue_series' => array_values($buckets),
            'by_salesperson' => $bySalesperson,
            'by_part' => $byPart,
        ];
    }

    /**
     * @return array{0:string,1:string}
     */
    protected function bucketKeyAndLabel(Carbon $dt, string $granularity): array
    {
        if ($granularity === 'week') {
            // Persian week starts on Saturday
            $weekStart = $dt->copy()->startOfWeek(Carbon::SATURDAY);
            [$jy, $jm, $jd] = JalaliDate::gregorianToJalali((int) $weekStart->year, (int) $weekStart->month, (int) $weekStart->day);
            $key = sprintf('%04d-%02d-%02d', $jy, $jm, $jd);
            $label = sprintf('هفته %02d %s', $jd, self::JALALI_MONTHS[$jm] ?? '');
            return [$key, $label];
        }

        [$jy, $jm, $jd] = JalaliDate::gregorianToJalali((int) $dt->year, (int) $dt->month, (int) $dt->day);

        if ($granularity === 'month') {
            $key = sprintf('%04d-%02d', $jy, $jm);
            $label = sprintf('%s %d', self::JALALI_MONTHS[$jm] ?? $jm, $jy);
            return [$key, $label];
        }

        $key = sprintf('%04d-%02d-%02d', $jy, $jm, $jd);
        $label = sprintf('%02d %s', $jd, self::JALALI_MONTHS[$jm] ?? $jm);

        return [$key, $label];
    }

    protected function percentDelta(int|float $current, int|float $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
