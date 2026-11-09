<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerHistory;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\SmsLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $totalStockQuantity = (int) Part::sum('stock_quantity');
        $assignedParts = (int) (clone $accessibleParts)->sum('quantity');

        $smsQuery = SmsLog::where(function ($q) use ($user) {
            if ($user && $user->hasRestrictedCustomerScope()) {
                $q->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
            }
        });
        $totalSmsSent = (clone $smsQuery)->where('status', 'sent')->count();

        $recentActivities = CustomerHistory::with(['customer', 'user'])
            ->whereHas('customer', fn ($q) => $q->accessibleBy($user))
            ->latest()
            ->take(8)
            ->get();

        $recentSms = SmsLog::with('customer')
            ->where(function ($q) use ($user) {
                if ($user && $user->hasRestrictedCustomerScope()) {
                    $q->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
                }
            })
            ->latest()
            ->take(6)
            ->get();

        return response()->json([
            'stats' => [
                'total_customers' => $totalCustomers,
                'effective_customers' => $effectiveCustomers,
                'potential_customers' => $potentialCustomers,
                'total_parts' => $totalParts,
                'total_stock_quantity' => $totalStockQuantity,
                'assigned_parts' => $assignedParts,
                'total_sms_sent' => $totalSmsSent,
            ],
            'recent_activities' => $recentActivities,
            'recent_sms' => $recentSms,
        ]);
    }
}
