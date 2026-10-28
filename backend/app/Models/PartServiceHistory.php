<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartServiceHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_part_id',
        'performed_by_user_id',
        'service_date',
        'service_type', // periodic | repair | overhaul
        'description',
        'cost',
    ];

    protected function casts(): array
    {
        return [
            'service_date' => 'date',
            'cost' => 'decimal:2',
        ];
    }

    public function customerPart(): BelongsTo
    {
        return $this->belongsTo(CustomerPart::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by_user_id');
    }
}
