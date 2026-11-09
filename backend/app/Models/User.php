<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
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

    public const SCOPE_OWN = 'own';
    public const SCOPE_SELECTED = 'selected';
    public const SCOPE_ALL = 'all';

    public const ROLE_LABELS = [
        self::ROLE_ADMINISTRATOR => 'مدیر ارشد',
        self::ROLE_MANAGER => 'مدیر / سرپرست',
        self::ROLE_SALESPERSON => 'کارمند فروش',
        self::ROLE_INSTALLER => 'نصاب',
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
        ],
        self::ROLE_INSTALLER => [
            'customers.view',
            'parts.view',
            'parts.assign',
            'parts.history',
        ],
    ];

    public function isAdministrator(): bool
    {
        return $this->user_type === self::ROLE_ADMINISTRATOR || $this->email === 'admin@crm.local';
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
    ];

    protected $appends = [
        'avatar_url',
        'role_label',
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

    public function createdCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'created_by_user_id');
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
            'user_type' => $this->user_type ?: self::ROLE_MANAGER,
            'role_label' => $this->role_label,
            'customer_scope' => $this->effectiveCustomerScope(),
            'granted_staff_ids' => $grantedStaffIds,
            'granted_staff' => $grantedStaffList,
            'granted_customer_ids' => $grantedCustomerIds,
            'granted_customers' => $grantedCustomersList,
            'permissions' => $this->getAllPermissions()->pluck('name')->values()->all(),
            'created_at' => $this->created_at,
        ];
    }
}
