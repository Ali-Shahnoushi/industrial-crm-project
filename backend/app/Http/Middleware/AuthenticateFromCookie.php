<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateFromCookie
{
    /**
     * Handle an incoming request.
     * If an Authorization header is not present but a crm_token httpOnly cookie exists,
     * set the Authorization header so Laravel Sanctum can authenticate the request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->bearerToken() && $token = $request->cookie('crm_token')) {
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        return $next($request);
    }
}
