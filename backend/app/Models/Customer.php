<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_type', // potential | effective
        'type',          // individual | company
        'first_name',
        'last_name',
        'company_name',
        'national_code',
        'mobile',
        'phone',
        'email',
        'province',
        'city',
        'address',
        'notes',
        'created_by_user_id',
    ];

    protected $appends = ['full_name', 'display_name'];

    public function getFullNameAttribute(): string
    {
        $personName = trim((string) ($this->first_name ?? '') . ' ' . (string) ($this->last_name ?? ''));
        if ($personName !== '') {
            return $personName;
        }
        if (!empty($this->company_name)) {
            return trim((string) $this->company_name);
        }
        return 'بدون نام';
    }

    public function getDisplayNameAttribute(): string
    {
        $personName = trim((string) ($this->first_name ?? '') . ' ' . (string) ($this->last_name ?? ''));
        if ($this->type === 'company' && !empty($this->company_name)) {
            return $personName !== ''
                ? "{$this->company_name} ({$personName})"
                : (string) $this->company_name;
        }
        return $personName !== '' ? $personName : ((string) ($this->company_name ?: 'بدون نام'));
    }

    /**
     * Scope query to only customers visible to the given user according to RBAC & granular ACL exceptions.
     */
    public function scopeAccessibleBy(Builder $query, ?User $user): Builder
    {
        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        if (!$user->hasRestrictedCustomerScope()) {
            return $query;
        }

        if (!Schema::hasColumn('customers', 'created_by_user_id')) {
            return $query;
        }

        $userId = (int) $user->id;
        $hasStaffTable = Schema::hasTable('user_customer_staff_grants');
        $hasCustomerTable = Schema::hasTable('user_customer_grants');

        return $query->where(function (Builder $sub) use ($userId, $hasStaffTable, $hasCustomerTable) {
            $sub->where('customers.created_by_user_id', $userId);

            if ($hasStaffTable) {
                $sub->orWhereIn('customers.created_by_user_id', function ($q) use ($userId) {
                    $q->select('staff_user_id')
                        ->from('user_customer_staff_grants')
                        ->where('grantee_user_id', $userId);
                });
            }

            if ($hasCustomerTable) {
                $sub->orWhereIn('customers.id', function ($q) use ($userId) {
                    $q->select('customer_id')
                        ->from('user_customer_grants')
                        ->where('grantee_user_id', $userId);
                });
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function customerParts(): HasMany
    {
        return $this->hasMany(CustomerPart::class);
    }

    public function parts(): BelongsToMany
    {
        return $this->belongsToMany(Part::class, 'customer_parts')
            ->withPivot([
                'id',
                'serial_number',
                'quantity',
                'invoice_amount',
                'invoice_number',
                'installation_date',
                'warranty_expire_date',
                'status',
                'notes',
            ])
            ->withTimestamps();
    }

    public function histories(): HasMany
    {
        return $this->hasMany(CustomerHistory::class)->latest();
    }

    public function smsLogs(): HasMany
    {
        return $this->hasMany(SmsLog::class)->latest();
    }

    public function inventoryLogs(): HasMany
    {
        return $this->hasMany(PartInventoryLog::class)->latest();
    }
}
