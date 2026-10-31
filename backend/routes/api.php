<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\PartController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\SmsController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Auth & Utility endpoints
    Route::post('/auth/login', [AuthController::class, 'login'])->name('login');
    Route::post('/auth/otp/send', [AuthController::class, 'sendOtp']);
    Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
    Route::get('/customers/template', [CustomerController::class, 'template']);
    Route::get('/settings/company', [SettingController::class, 'getCompanySettings']);

    // Protected API endpoints
    Route::middleware('auth:sanctum')->group(function () {
        // User profile & logout
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::match(['put', 'post'], '/auth/me', [AuthController::class, 'updateProfile']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Dashboard statistics
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

        // Customers
        Route::get('/customers/export', [CustomerController::class, 'export']);
        Route::post('/customers/import', [CustomerController::class, 'import']);
        Route::apiResource('customers', CustomerController::class);

        // Parts & Assignments
        Route::apiResource('parts', PartController::class);
        Route::post('/customers/{customer}/parts', [PartController::class, 'assign']);
        Route::post('/customer-parts/{customerPart}/history', [PartController::class, 'addServiceHistory']);

        // SMS (Melipayamak)
        Route::post('/sms/send-pattern', [SmsController::class, 'sendPattern']);
        Route::get('/sms/logs', [SmsController::class, 'logs']);

        // System Settings
        Route::get('/settings/sms', [SettingController::class, 'getSmsSettings']);
        Route::put('/settings/sms', [SettingController::class, 'updateSmsSettings']);
        Route::post('/settings/company', [SettingController::class, 'updateCompanySettings']);

        // Users & Pure ACL Permissions
        Route::get('/permissions', [UserController::class, 'availablePermissions']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::match(['put', 'post'], '/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
        Route::put('/users/{user}/permissions', [UserController::class, 'updatePermissions']);
        Route::patch('/users/{user}/toggle-active', [UserController::class, 'toggleActive']);
    });
});
