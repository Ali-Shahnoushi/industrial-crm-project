<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Part extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'periodic_service_months',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'periodic_service_months' => 'integer',
        ];
    }

    public function customerParts(): HasMany
    {
        return $this->hasMany(CustomerPart::class);
    }

    public function customers(): BelongsToMany
    {
        return $this->belongsToMany(Customer::class, 'customer_parts')
            ->withPivot(['id', 'serial_number', 'installation_date', 'warranty_expire_date', 'status', 'notes'])
            ->withTimestamps();
    }
}
