<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(\App\Http\Middleware\SecurityHeadersAndLockdown::class);
        $middleware->alias([
            'active.user' => \App\Http\Middleware\EnsureActiveUser::class,
            'staff.only' => \App\Http\Middleware\EnsureStaffUser::class,
            'portal.customer' => \App\Http\Middleware\EnsureCustomerPortalUser::class,
        ]);
        $middleware->api(prepend: [
            \App\Http\Middleware\AuthenticateFromCookie::class,
        ]);
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
        $middleware->redirectGuestsTo(fn () => response()->json(['message' => 'Unauthenticated.'], 401));
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (\Illuminate\Http\Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // جلوگیری از خطای ثانویه Target class [view] does not exist در صورتی که خطا پیش از ثبت ViewServiceProvider رخ دهد
        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (!app()->bound('view')) {
                if ($request->is('api/*') || $request->expectsJson()) {
                    return response()->json([
                        'message' => 'خطا در راه‌اندازی هسته سامانه. لطفاً فایل‌های کش قدیمی پوشه bootstrap/cache را پاک کنید.',
                        'error' => config('app.debug') ? $e->getMessage() : class_basename($e),
                    ], 500);
                }

                $safeMsg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
                $debugBlock = config('app.debug')
                    ? '<pre style="background:#090d16;color:#38bdf8;padding:12px;border-radius:8px;direction:ltr;text-align:left;overflow:auto">' . $safeMsg . '</pre>'
                    : '';

                return response(
                    '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>خطای راه‌اندازی سامانه</title></head>'
                    . '<body style="font-family:Tahoma,sans-serif;background:#0f172a;color:#f8fafc;padding:32px;line-height:1.7">'
                    . '<div style="max-width:720px;margin:auto;background:#1e293b;border:1px solid #ef4444;border-radius:14px;padding:24px">'
                    . '<h2 style="color:#f87171;margin-top:0">⚠️ خطا در راه‌اندازی هسته لاراول</h2>'
                    . '<p>در حین بارگذاری سرویس‌های هسته خطایی رخ داد. لطفاً فایل‌های <code>*.php</code> داخل پوشه <code>bootstrap/cache/</code> در پوشه خصوصی لاراول را حذف کرده و صفحه را رفرش کنید.</p>'
                    . $debugBlock
                    . '</div></body></html>',
                    500,
                    ['Content-Type' => 'text/html; charset=UTF-8']
                );
            }

            return null;
        });
    })->create();

// Set before any configuration/provider resolves public_path(). Also supports CLI.
if ($publicPath = ($_SERVER['APP_PUBLIC_PATH'] ?? getenv('APP_PUBLIC_PATH'))) {
    $app->usePublicPath($publicPath);
}

$app->afterBootstrapping(\Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class, function ($app) {
    if ($publicPath = ($_SERVER['APP_PUBLIC_PATH'] ?? env('APP_PUBLIC_PATH'))) {
        $app->usePublicPath($publicPath);
    }
});

return $app;
