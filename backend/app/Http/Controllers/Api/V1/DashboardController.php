<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerHistory;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\SmsLog;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $totalCustomers = Customer::count();
        $effectiveCustomers = Customer::where('customer_type', 'effective')->count();
        $potentialCustomers = Customer::where('customer_type', 'potential')->count();

        $totalParts = Part::count();
        $assignedParts = CustomerPart::count();
        $totalSmsSent = SmsLog::where('status', 'sent')->count();

        $recentActivities = CustomerHistory::with(['customer', 'user'])
            ->latest()
            ->take(8)
            ->get();

        $recentSms = SmsLog::with('customer')
            ->latest()
            ->take(6)
            ->get();

        return response()->json([
            'stats' => [
                'total_customers' => $totalCustomers,
                'effective_customers' => $effectiveCustomers,
                'potential_customers' => $potentialCustomers,
                'total_parts' => $totalParts,
                'assigned_parts' => $assignedParts,
                'total_sms_sent' => $totalSmsSent,
            ],
            'recent_activities' => $recentActivities,
            'recent_sms' => $recentSms,
        ]);
    }
}
