<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CustomerPart extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'part_id',
        'serial_number',
        'quantity',
        'invoice_amount',
        'invoice_number',
        'installation_date',
        'warranty_expire_date',
        'status', // active | under_repair | replaced | retired
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'invoice_amount' => 'decimal:2',
            'installation_date' => 'date',
            'warranty_expire_date' => 'date',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function serviceHistories(): HasMany
    {
        return $this->hasMany(PartServiceHistory::class)->latest('service_date');
    }

    public function inventoryLogs(): HasMany
    {
        return $this->hasMany(PartInventoryLog::class)->latest();
    }

    public function saleItem(): HasOne
    {
        return $this->hasOne(SaleItem::class);
    }
}
