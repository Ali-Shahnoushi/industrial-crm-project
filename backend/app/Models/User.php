<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    public const ROLE_ADMINISTRATOR = 'administrator';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_SALESPERSON = 'salesperson';
    public const ROLE_INSTALLER = 'installer';
    public const ROLE_CUSTOMER = 'customer';

    public const SCOPE_OWN = 'own';
    public const SCOPE_SELECTED = 'selected';
    public const SCOPE_ALL = 'all';

    public const ROLE_LABELS = [
        self::ROLE_ADMINISTRATOR => 'مدیر ارشد',
        self::ROLE_MANAGER => 'مدیر / سرپرست',
        self::ROLE_SALESPERSON => 'کارمند فروش',
        self::ROLE_INSTALLER => 'نصاب',
        self::ROLE_CUSTOMER => 'مشتری (پنل کاربری)',
    ];

    public const ROLE_DEFAULT_PERMISSIONS = [
        self::ROLE_ADMINISTRATOR => [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.delete',
            'customers.import',
            'customers.export',
            'parts.view',
            'parts.manage',
            'parts.assign',
            'parts.history',
            'tickets.view',
            'tickets.reply',
            'tickets.manage',
            'sms.send',
            'sms.logs',
            'users.manage',
            'settings.manage',
        ],
        self::ROLE_MANAGER => [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.delete',
            'customers.import',
            'customers.export',
            'parts.view',
            'parts.manage',
            'parts.assign',
            'parts.history',
            'tickets.view',
            'tickets.reply',
            'tickets.manage',
            'sms.send',
            'sms.logs',
        ],
        self::ROLE_SALESPERSON => [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.export',
            'parts.view',
            'parts.assign',
            'tickets.view',
            'tickets.reply',
        ],
        self::ROLE_INSTALLER => [
            'customers.view',
            'parts.view',
            'parts.assign',
            'parts.history',
            'tickets.view',
            'tickets.reply',
        ],
        self::ROLE_CUSTOMER => [],
    ];

    public function isCustomerPortalUser(): bool
    {
        return $this->user_type === self::ROLE_CUSTOMER;
    }

    public function scopeStaffOnly(Builder $query): Builder
    {
        if (!Schema::hasColumn('users', 'user_type')) {
            return $query;
        }

        return $query->where(function (Builder $q) {
            $q->where('users.user_type', '!=', self::ROLE_CUSTOMER)
                ->orWhereNull('users.user_type');
        });
    }

    public function isAdministrator(): bool
    {
        return $this->user_type === self::ROLE_ADMINISTRATOR
            || $this->email === 'admin@crm.local'
            || ($this->user_type === null && (int) $this->id === 1);
    }

    /**
     * Safely check whether a staff user possesses an ACL permission without throwing
     * `PermissionDoesNotExist` when a permission row hasn't been seeded yet.
     */
    public function hasSafePermission(string $permission): bool
    {
        if ($this->isCustomerPortalUser()) {
            return false;
        }

        if ($this->isAdministrator()) {
            return true;
        }

        try {
            return $this->checkPermissionTo($permission);
        } catch (\Throwable) {
            return false;
        }
    }

    public function isSalesperson(): bool
    {
        return $this->user_type === self::ROLE_SALESPERSON;
    }

    public function isInstaller(): bool
    {
        return $this->user_type === self::ROLE_INSTALLER;
    }

    public function effectiveCustomerScope(): string
    {
        if ($this->isAdministrator()) {
            return self::SCOPE_ALL;
        }

        if (!empty($this->customer_scope)) {
            return $this->customer_scope;
        }

        return $this->isSalesperson() ? self::SCOPE_OWN : self::SCOPE_ALL;
    }

    public function hasRestrictedCustomerScope(): bool
    {
        return $this->effectiveCustomerScope() !== self::SCOPE_ALL;
    }

    public function hasFullCustomerScope(): bool
    {
        return !$this->hasRestrictedCustomerScope();
    }

    public function canAccessCustomer(Customer $customer): bool
    {
        if (!$this->hasRestrictedCustomerScope()) {
            return true;
        }

        if ((int) $customer->created_by_user_id === (int) $this->id) {
            return true;
        }

        if (Schema::hasTable('user_customer_staff_grants') && $customer->created_by_user_id) {
            if ($this->grantedStaff()->where('users.id', $customer->created_by_user_id)->exists()) {
                return true;
            }
        }

        if (Schema::hasTable('user_customer_grants')) {
            if ($this->grantedCustomers()->where('customers.id', $customer->id)->exists()) {
                return true;
            }
        }

        return false;
    }

    protected $fillable = [
        'name',
        'email',
        'phone',
        'avatar',
        'password',
        'is_active',
        'user_type',
        'customer_scope',
        'customer_id',
    ];

    protected $appends = [
        'avatar_url',
        'role_label',
        'user_type_label',
    ];

    public function getAvatarUrlAttribute(): ?string
    {
        if (!$this->avatar) {
            return null;
        }

        if (str_starts_with($this->avatar, 'http://') || str_starts_with($this->avatar, 'https://')) {
            return $this->avatar;
        }

        return '/storage/' . ltrim($this->avatar, '/');
    }

    public function getRoleLabelAttribute(): string
    {
        return self::ROLE_LABELS[$this->user_type ?? ''] ?? 'کاربر سیستم';
    }

    public function getUserTypeLabelAttribute(): string
    {
        return $this->role_label;
    }

    public function createdCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'created_by_user_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function ticketDepartments(): BelongsToMany
    {
        return $this->belongsToMany(
            TicketDepartment::class,
            'ticket_department_user',
            'user_id',
            'department_id'
        )->withTimestamps();
    }

    public function assignedTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assigned_to_user_id');
    }

    public function grantedStaff(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'user_customer_staff_grants',
            'grantee_user_id',
            'staff_user_id'
        )->withTimestamps();
    }

    public function grantedCustomers(): BelongsToMany
    {
        return $this->belongsToMany(
            Customer::class,
            'user_customer_grants',
            'grantee_user_id',
            'customer_id'
        )->withTimestamps();
    }

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'user_type' => 'string',
            'customer_scope' => 'string',
        ];
    }

    public function serializeForApi(): array
    {
        $grantedStaffIds = [];
        $grantedStaffList = [];
        $grantedCustomerIds = [];
        $grantedCustomersList = [];

        if (Schema::hasTable('user_customer_staff_grants')) {
            $staff = $this->grantedStaff()->get(['users.id', 'users.name']);
            $grantedStaffIds = $staff->pluck('id')->map(fn ($v) => (int) $v)->values()->all();
            $grantedStaffList = $staff->map(fn ($s) => ['id' => (int) $s->id, 'name' => $s->name])->values()->all();
        }

        if (Schema::hasTable('user_customer_grants')) {
            $custs = $this->grantedCustomers()->get([
                'customers.id',
                'customers.first_name',
                'customers.last_name',
                'customers.company_name',
                'customers.type',
            ]);
            $grantedCustomerIds = $custs->pluck('id')->map(fn ($v) => (int) $v)->values()->all();
            $grantedCustomersList = $custs->map(fn (Customer $c) => [
                'id' => (int) $c->id,
                'display_name' => $c->display_name,
                'type' => $c->type,
            ])->values()->all();
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'avatar_url' => $this->avatar_url,
            'is_active' => (bool) $this->is_active,
            'is_primary_admin' => ((int) $this->id === 1 || $this->email === 'admin@crm.local'),
            'user_type' => $this->user_type ?: self::ROLE_MANAGER,
            'is_customer_portal' => $this->isCustomerPortalUser(),
            'customer_id' => $this->customer_id ? (int) $this->customer_id : null,
            'role_label' => $this->role_label,
            'user_type_label' => $this->role_label,
            'customer_scope' => $this->isCustomerPortalUser() ? self::SCOPE_OWN : $this->effectiveCustomerScope(),
            'granted_staff_ids' => $grantedStaffIds,
            'granted_staff' => $grantedStaffList,
            'granted_customer_ids' => $grantedCustomerIds,
            'granted_customers' => $grantedCustomersList,
            'permissions' => $this->isCustomerPortalUser() ? [] : $this->getAllPermissions()->pluck('name')->values()->all(),
            'created_at' => $this->created_at,
        ];
    }
}
