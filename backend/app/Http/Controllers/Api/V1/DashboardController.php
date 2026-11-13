<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerHistory;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\Sale;
use App\Models\SmsLog;
use App\Models\Ticket;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        $accessibleCustomers = Customer::accessibleBy($user);
        $accessibleParts = CustomerPart::whereHas('customer', fn ($q) => $q->accessibleBy($user));

        $totalCustomers = (clone $accessibleCustomers)->count();
        $effectiveCustomers = (clone $accessibleCustomers)->where('customer_type', 'effective')->count();
        $potentialCustomers = (clone $accessibleCustomers)->where('customer_type', 'potential')->count();

        $totalParts = Part::count();
        $totalStockQuantity = Schema::hasColumn('parts', 'stock_quantity')
            ? (int) Part::sum('stock_quantity')
            : 0;
        $assignedParts = Schema::hasColumn('customer_parts', 'quantity')
            ? (int) (clone $accessibleParts)->sum('quantity')
            : (int) (clone $accessibleParts)->count();

        $canViewParts = !$user || $user->hasSafePermission('parts.view');
        $lowStockParts = $canViewParts
            ? Part::where('is_active', true)->orderBy('stock_quantity')->get()->filter(fn (Part $p) => $p->is_low_stock)->values()
            : collect();

        $canViewSmsLogs = !$user || $user->hasSafePermission('sms.logs');
        $canViewTickets = !$user || $user->hasSafePermission('tickets.view');

        $totalSmsSent = 0;
        $recentSms = collect();
        if ($canViewSmsLogs) {
            $smsQuery = SmsLog::where(function ($q) use ($user) {
                if ($user && $user->hasRestrictedCustomerScope()) {
                    $q->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
                }
            });
            $totalSmsSent = (clone $smsQuery)->where('status', 'sent')->count();

            $recentSms = SmsLog::with('customer')
                ->where(function ($q) use ($user) {
                    if ($user && $user->hasRestrictedCustomerScope()) {
                        $q->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
                    }
                })
                ->latest()
                ->take(6)
                ->get();
        }

        $openTicketsCount = 0;
        $pendingRepairTicketsCount = 0;
        if ($canViewTickets && Schema::hasTable('tickets')) {
            $accessibleTickets = Ticket::accessibleByStaff($user);
            $openTicketsCount = (clone $accessibleTickets)
                ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
                ->count();
            $pendingRepairTicketsCount = (clone $accessibleTickets)
                ->where('ticket_type', Ticket::TYPE_REPAIR_REQUEST)
                ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
                ->count();
        }

        $recentActivities = CustomerHistory::with(['customer', 'user'])
            ->whereHas('customer', fn ($q) => $q->accessibleBy($user))
            ->latest()
            ->take(8)
            ->get();

        $canViewSales = !$user || $user->hasSafePermission('sales.view');
        $salesStats = null;
        if ($canViewSales && Schema::hasTable('sales')) {
            $salesBase = Sale::accessibleBy($user)->where('status', Sale::STATUS_CONFIRMED);
            $monthStart = Carbon::now()->subDays(29)->toDateString();
            $salesStats = [
                'total_revenue' => (int) (clone $salesBase)->sum('total'),
                'sales_count' => (clone $salesBase)->count(),
                'revenue_last_30_days' => (int) (clone $salesBase)->whereDate('sale_date', '>=', $monthStart)->sum('total'),
                'unpaid_amount' => (int) (clone $salesBase)
                    ->whereColumn('total', '>', 'paid_amount')
                    ->selectRaw('COALESCE(SUM(total - paid_amount), 0) as amt')
                    ->value('amt'),
            ];
        }

        return response()->json([
            'stats' => [
                'total_customers' => $totalCustomers,
                'effective_customers' => $effectiveCustomers,
                'potential_customers' => $potentialCustomers,
                'total_parts' => $totalParts,
                'total_stock_quantity' => $totalStockQuantity,
                'assigned_parts' => $assignedParts,
                'total_sms_sent' => $totalSmsSent,
                'low_stock_parts_count' => $lowStockParts->count(),
                'open_tickets_count' => $openTicketsCount,
                'pending_repair_tickets_count' => $pendingRepairTicketsCount,
                'sales_revenue_total' => $salesStats['total_revenue'] ?? 0,
                'sales_count_total' => $salesStats['sales_count'] ?? 0,
                'sales_revenue_30d' => $salesStats['revenue_last_30_days'] ?? 0,
                'sales_unpaid_total' => $salesStats['unpaid_amount'] ?? 0,
            ],
            'sales_summary' => $salesStats,
            'low_stock_parts' => $lowStockParts->take(8)->values(),
            'recent_activities' => $recentActivities,
            'recent_sms' => $recentSms,
        ]);
    }
}
