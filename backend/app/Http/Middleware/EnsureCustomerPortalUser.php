<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerPortalUser
{
    /**
     * Ensure the authenticated user is an enabled Customer Portal account linked to a valid Customer record.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->isCustomerPortalUser() || !$user->customer_id) {
            return response()->json([
                'message' => 'این بخش مختص پنل کاربری مشتریان است.',
            ], 403);
        }

        $customer = Customer::find($user->customer_id);
        if (!$customer || !$customer->portal_enabled) {
            return response()->json([
                'message' => 'دسترسی پنل کاربری شما غیرفعال شده است. لطفاً با مسئول فروش خود تماس بگیرید.',
            ], 403);
        }

        return $next($request);
    }
}
