<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersAndLockdown
{
    /**
     * Block removed secondary admin/livewire surfaces and attach strict HTTP security headers.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (
            $request->is('admin', 'admin/*', 'livewire', 'livewire/*', 'filament', 'filament/*') ||
            (app()->environment('production') && $request->is('docs', 'docs/*'))
        ) {
            $response = $request->expectsJson()
                ? response()->json(['message' => 'Not Found.'], 404)
                : response('', 404);

            return $this->withSecurityHeaders($response);
        }

        /** @var Response $response */
        $response = $next($request);

        return $this->withSecurityHeaders($response);
    }

    protected function withSecurityHeaders(Response $response): Response
    {
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');

        return $response;
    }
}
