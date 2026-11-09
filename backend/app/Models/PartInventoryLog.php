<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartInventoryLog extends Model
{
    use HasFactory;

    public const TYPE_IN = 'in';
    public const TYPE_OUT_MANUAL = 'out_manual';
    public const TYPE_OUT_ASSIGN = 'out_assign';
    public const TYPE_RETURN = 'return';

    public const TYPE_LABELS = [
        self::TYPE_IN => 'ورود به انبار',
        self::TYPE_OUT_MANUAL => 'خروج دستی از انبار',
        self::TYPE_OUT_ASSIGN => 'خروج جهت تخصیص به مشتری',
        self::TYPE_RETURN => 'برگشت به انبار',
    ];

    protected $fillable = [
        'part_id',
        'user_id',
        'customer_id',
        'customer_part_id',
        'type',
        'quantity',
        'balance_before',
        'balance_after',
        'description',
    ];

    protected $appends = [
        'type_label',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'balance_before' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function getTypeLabelAttribute(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function customerPart(): BelongsTo
    {
        return $this->belongsTo(CustomerPart::class);
    }
}
