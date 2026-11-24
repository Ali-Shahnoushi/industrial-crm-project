<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BackupController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerPortalController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\PartController;
use App\Http\Controllers\Api\V1\SalesController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\SmsController;
use App\Http\Controllers\Api\V1\TicketController;
use App\Http\Controllers\Api\V1\TicketDepartmentController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Auth & Branding endpoints
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('login');
    Route::post('/auth/sessions/resolve', [AuthController::class, 'resolveSessionLimit'])->middleware('throttle:15,1');
    Route::post('/auth/otp/send', [AuthController::class, 'sendOtp'])->middleware(['feature:otp_login', 'throttle:5,1']);
    Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp'])->middleware(['feature:otp_login', 'throttle:10,1']);
    Route::get('/settings/company', [SettingController::class, 'getCompanySettings']);
    Route::get('/settings/changelog', [SettingController::class, 'getChangelog']);

    // Authenticated endpoints (Sanctum Cookie/Bearer + Active Account Enforcement)
    Route::middleware(['auth:sanctum', 'active.user'])->group(function () {
        // Shared session & self-profile routes (available to both Staff & Customer Portal accounts)
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::match(['put', 'post'], '/auth/me', [AuthController::class, 'updateProfile']);
        Route::match(['put', 'post'], '/auth/profile', [AuthController::class, 'updateProfile']);
        Route::get('/auth/sessions', [AuthController::class, 'mySessions']);
        Route::delete('/auth/sessions/{tokenId}', [AuthController::class, 'revokeMySession'])->whereNumber('tokenId');
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // ─────────────────────────────────────────────────────────────────────
        // ISOLATED CUSTOMER PORTAL ROUTES (Strictly `user_type === 'customer'`)
        // ─────────────────────────────────────────────────────────────────────
        Route::prefix('portal')->middleware(['feature:customer_portal', 'portal.customer'])->group(function () {
            Route::get('/overview', [CustomerPortalController::class, 'overview']);
            Route::get('/devices', [CustomerPortalController::class, 'devices']);
            Route::get('/tickets', [CustomerPortalController::class, 'tickets']);
            Route::post('/tickets', [CustomerPortalController::class, 'createTicket'])->middleware('throttle:20,1');
            Route::get('/tickets/{ticket}', [CustomerPortalController::class, 'showTicket'])->whereNumber('ticket');
            Route::post('/tickets/{ticket}/messages', [CustomerPortalController::class, 'replyTicket'])->whereNumber('ticket')->middleware('throttle:30,1');
        });

        // ─────────────────────────────────────────────────────────────────────
        // STAFF & ADMIN CRM ROUTES (Strictly blocked for Customer Portal accounts)
        // ─────────────────────────────────────────────────────────────────────
        Route::middleware(['staff.only'])->group(function () {
            // Dashboard statistics
            Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

            // Customers + Excel Import/Export + Template + Owner Reassignment + Portal Access + ACL Lookup
            Route::get('/customers-lookup', [CustomerController::class, 'lookup']);
            Route::get('/customers-creator-options', [CustomerController::class, 'creatorOptions']);
            Route::get('/customers-staff-options', [CustomerController::class, 'staffOptions']);
            Route::get('/customers/template', [CustomerController::class, 'template']);
            Route::get('/customers/export', [CustomerController::class, 'export']);
            Route::post('/customers/import', [CustomerController::class, 'import']);
            Route::patch('/customers/{customer}/owner', [CustomerController::class, 'updateOwner']);
            Route::post('/customers/{customer}/portal-access', [CustomerController::class, 'managePortalAccess'])
                ->middleware('feature:customer_portal');
            Route::apiResource('customers', CustomerController::class);

            // Devices Catalog, Warehouse Summary, Stock Adjustment & Customer Device Assignments
            Route::middleware('feature:parts')->group(function () {
                Route::get('/inventory/summary', [PartController::class, 'inventorySummary']);
                Route::get('/inventory-logs', [PartController::class, 'inventoryLogs']);
                Route::get('/parts/inventory-logs', [PartController::class, 'inventoryLogs']);
                Route::get('/parts/{part}/assigned-customers', [PartController::class, 'assignedCustomers']);
                Route::post('/parts/{part}/stock', [PartController::class, 'adjustStock']);
                Route::post('/parts/{part}/adjust-stock', [PartController::class, 'adjustStock']);
                Route::apiResource('parts', PartController::class);
                Route::post('/customers/{customer}/parts', [PartController::class, 'assign']);
                Route::post('/customers/{customer}/assign-part', [PartController::class, 'assign']);
                Route::put('/customer-parts/{customerPart}', [PartController::class, 'updateAssignment']);
                Route::put('/customers/{customer}/parts/{customerPart}', [PartController::class, 'updateAssignmentForCustomer']);
                Route::delete('/customer-parts/{customerPart}', [PartController::class, 'deleteAssignment']);
                Route::delete('/customers/{customer}/parts/{customerPart}', [PartController::class, 'deleteAssignmentForCustomer']);
                Route::post('/customer-parts/{customerPart}/history', [PartController::class, 'addServiceHistory']);
                Route::post('/customer-parts/{customerPart}/service-history', [PartController::class, 'addServiceHistory']);
            });

            // Sales, Analytics (KPIs & Charts), Excel Export & Invoices (Finance)
            Route::middleware('feature:sales')->group(function () {
                Route::get('/sales/summary', [SalesController::class, 'summary']);
                Route::get('/sales/charts', [SalesController::class, 'charts']);
                Route::get('/sales/export', [SalesController::class, 'export']);
                Route::get('/sales/seller-options', [SalesController::class, 'sellerOptions']);
                Route::get('/sales', [SalesController::class, 'index']);
                Route::post('/sales', [SalesController::class, 'store']);
                Route::get('/sales/{sale}', [SalesController::class, 'show'])->whereNumber('sale');
                Route::match(['put', 'patch'], '/sales/{sale}', [SalesController::class, 'update'])->whereNumber('sale');
                Route::delete('/sales/{sale}', [SalesController::class, 'destroy'])->whereNumber('sale');
                Route::post('/sales/{sale}/invoice', [InvoiceController::class, 'generate'])->whereNumber('sale');
                Route::get('/customers/{customer}/sales', [SalesController::class, 'customerSales']);

                Route::get('/invoices/summary', [InvoiceController::class, 'summary']);
                Route::get('/invoices', [InvoiceController::class, 'index']);
                Route::get('/invoices/{invoice}', [InvoiceController::class, 'show'])->whereNumber('invoice');
                Route::patch('/invoices/{invoice}/void', [InvoiceController::class, 'void'])->whereNumber('invoice');

                Route::get('/settings/sales', [SettingController::class, 'getSalesSettings']);
                Route::match(['put', 'post'], '/settings/sales', [SettingController::class, 'updateSalesSettings']);
            });

            // Enterprise Ticketing System (Staff Hub + Configurable Departments)
            Route::middleware('feature:tickets')->group(function () {
                Route::get('/ticket-departments', [TicketDepartmentController::class, 'activeList']);
                Route::get('/tickets/summary', [TicketController::class, 'summary']);
                Route::get('/tickets', [TicketController::class, 'index']);
                Route::post('/tickets', [TicketController::class, 'store']);
                Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
                Route::match(['put', 'patch'], '/tickets/{ticket}', [TicketController::class, 'update']);
                Route::post('/tickets/{ticket}/messages', [TicketController::class, 'addMessage']);

                Route::get('/settings/ticket-departments', [TicketDepartmentController::class, 'index']);
                Route::post('/settings/ticket-departments', [TicketDepartmentController::class, 'store']);
                Route::match(['put', 'patch'], '/settings/ticket-departments/{ticketDepartment}', [TicketDepartmentController::class, 'update']);
                Route::delete('/settings/ticket-departments/{ticketDepartment}', [TicketDepartmentController::class, 'destroy']);
            });

            // SMS (Melipayamak) — rate-limited to prevent gateway balance drain
            Route::middleware('feature:sms')->group(function () {
                Route::post('/sms/send-pattern', [SmsController::class, 'sendPattern'])->middleware('throttle:20,1');
                Route::get('/sms/logs', [SmsController::class, 'logs']);

                Route::get('/settings/sms', [SettingController::class, 'getSmsSettings']);
                Route::match(['put', 'post'], '/settings/sms', [SettingController::class, 'updateSmsSettings']);
            });

            // Database & Data Backup and Recovery (Enterprise v2.3.0 - Preserved from Main)
            Route::prefix('backup')->middleware('feature:backup')->group(function () {
                Route::get('status', [BackupController::class, 'status']);
                Route::get('database-dump', [BackupController::class, 'exportDatabaseDump']);
                Route::get('customers-json', [BackupController::class, 'exportCustomersJson']);
                Route::post('customers-restore-json', [BackupController::class, 'restoreCustomersJson']);
            });

            // Core System Settings, Feature Toggles & Web Upgrade Helper (always reachable)
            Route::post('/settings/company', [SettingController::class, 'updateCompanySettings']);
            Route::get('/settings/features', [SettingController::class, 'getSystemFeatures']);
            Route::put('/settings/features', [SettingController::class, 'updateSystemFeatures']);
            Route::post('/settings/system/upgrade', [SettingController::class, 'upgradeSystem']);

            // Users, Roles, Active Sessions & Granular ACL Permissions
            Route::get('/roles', [UserController::class, 'availableRoles']);
            Route::get('/permissions', [UserController::class, 'availablePermissions']);
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::match(['put', 'post'], '/users/{user}', [UserController::class, 'update']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
            Route::put('/users/{user}/permissions', [UserController::class, 'updatePermissions']);
            Route::patch('/users/{user}/toggle-active', [UserController::class, 'toggleActive']);
            Route::get('/users/{user}/sessions', [UserController::class, 'sessions']);
            Route::delete('/users/{user}/sessions', [UserController::class, 'revokeAllSessions']);
            Route::delete('/users/{user}/sessions/{tokenId}', [UserController::class, 'revokeSession'])->whereNumber('tokenId');
        });
    });
});
