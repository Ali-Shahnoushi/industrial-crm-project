<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Returns the case-insensitive LIKE operator for the active database driver.
     *
     * PostgreSQL uses ILIKE for case-insensitive matching, while MySQL/MariaDB
     * use plain LIKE (which is case-insensitive by default with *_ci collations).
     */
    protected function likeOp(): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }

    /**
     * Authorizes that the authenticated user possesses the required ACL permission.
     */
    protected function authorizePermission(string $permission): void
    {
        $user = auth()->user();
        if (!$user || !$user->hasSafePermission($permission)) {
            abort(403, "شما دسترسی لازم ({$permission}) برای این عملیات را ندارید.");
        }
    }

    /**
     * Authorizes row-level customer visibility/access for the authenticated user (Task 1 RBAC/ACL).
     */
    protected function authorizeCustomerAccess(Customer $customer): void
    {
        $user = auth()->user();
        if (!$user || !$user->canAccessCustomer($customer)) {
            abort(403, 'شما مجوز دسترسی به پرونده این مشتری را ندارید.');
        }
    }

    /**
     * Converts Persian (۰-۹) and Arabic (٠-٩) numerals to standard ASCII digits (0-9).
     */
    protected function normalizeDigits(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $arabic  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $latin   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        return str_replace($arabic, $latin, str_replace($persian, $latin, $value));
    }
}
