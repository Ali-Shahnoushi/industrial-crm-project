<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use HasFactory;

    public const STATUS_ISSUED = 'issued';
    public const STATUS_PAID = 'paid';
    public const STATUS_VOID = 'void';

    protected $fillable = [
        'sale_id',
        'number',
        'jalali_year',
        'sequence_number',
        'issued_at',
        'due_at',
        'status',
        'notes',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'jalali_year' => 'integer',
            'sequence_number' => 'integer',
            'issued_at' => 'date:Y-m-d',
            'due_at' => 'date:Y-m-d',
        ];
    }

    public function scopeAccessibleBy(Builder $query, ?User $user): Builder
    {
        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        if (!$user->hasRestrictedCustomerScope()) {
            return $query;
        }

        return $query->whereHas('sale.customer', fn (Builder $cq) => $cq->accessibleBy($user));
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
