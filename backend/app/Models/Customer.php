<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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
    ];

    protected $appends = ['full_name'];

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function customerParts(): HasMany
    {
        return $this->hasMany(CustomerPart::class);
    }

    public function parts(): BelongsToMany
    {
        return $this->belongsToMany(Part::class, 'customer_parts')
            ->withPivot(['id', 'serial_number', 'installation_date', 'warranty_expire_date', 'status', 'notes'])
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
}
