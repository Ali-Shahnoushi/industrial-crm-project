<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'recipient_mobile',
        'pattern_code',
        'tokens',
        'status', // sent | failed | pending
        'provider_message_id',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'tokens' => 'array',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
