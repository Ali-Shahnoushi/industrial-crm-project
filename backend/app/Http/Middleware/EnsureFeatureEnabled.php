<?php

namespace App\Http\Middleware;

use App\Support\SystemFeatures;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeatureEnabled
{
    /**
     * Reject requests to modules that have been disabled by the administrator.
     */
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        if (!SystemFeatures::isEnabled($feature)) {
            $label = SystemFeatures::label($feature);

            return response()->json([
                'code' => 'FEATURE_DISABLED',
                'feature' => $feature,
                'message' => "بخش «{$label}» در حال حاضر توسط مدیر ارشد سامانه غیرفعال شده است.",
            ], 403);
        }

        return $next($request);
    }
}
