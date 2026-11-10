<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffUser
{
    /**
     * Block Customer Portal accounts (`user_type === 'customer'`) from accessing any Staff CRM endpoints.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || $user->isCustomerPortalUser()) {
            return response()->json([
                'message' => 'دسترسی غیرمجاز: این بخش صرفاً مخصوص پرسنل و مدیران سازمان است.',
            ], 403);
        }

        return $next($request);
    }
}
