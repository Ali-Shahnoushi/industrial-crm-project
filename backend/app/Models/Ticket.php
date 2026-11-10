<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class Ticket extends Model
{
    use HasFactory;

    public const TYPE_REPAIR_REQUEST = 'repair_request';
    public const TYPE_SALES_INQUIRY = 'sales_inquiry';
    public const TYPE_TECHNICAL_SUPPORT = 'technical_support';
    public const TYPE_GENERAL = 'general';

    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_ANSWERED = 'answered';
    public const STATUS_CUSTOMER_REPLY = 'customer_reply';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const ACTIVE_LOAD_STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_ANSWERED,
        self::STATUS_CUSTOMER_REPLY,
    ];

    protected $fillable = [
        'tracking_code',
        'customer_id',
        'customer_part_id',
        'department_id',
        'created_by_user_id',
        'assigned_to_user_id',
        'ticket_type',
        'priority',
        'status',
        'subject',
        'last_reply_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_reply_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket) {
            if (empty($ticket->tracking_code)) {
                $ticket->tracking_code = static::generateTrackingCode();
            }
        });
    }

    public static function generateTrackingCode(): string
    {
        do {
            $code = 'TKT-' . now()->format('ymd') . '-' . random_int(1000, 9999);
        } while (self::where('tracking_code', $code)->exists());

        return $code;
    }

    /**
     * Scope tickets visible to a staff user based on role, department membership, assignment, and customer ACL.
     */
    public function scopeAccessibleByStaff(Builder $query, ?User $user): Builder
    {
        if (!$user || $user->isCustomerPortalUser()) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->isAdministrator() || (!$user->hasRestrictedCustomerScope() && $user->hasSafePermission('tickets.manage'))) {
            return $query;
        }

        $userId = (int) $user->id;
        $hasDeptPivot = Schema::hasTable('ticket_department_user');

        return $query->where(function (Builder $sub) use ($user, $userId, $hasDeptPivot) {
            $sub->where('tickets.assigned_to_user_id', $userId)
                ->orWhere('tickets.created_by_user_id', $userId)
                ->orWhereHas('customer', fn ($cq) => $cq->accessibleBy($user));

            if ($hasDeptPivot) {
                $sub->orWhereIn('tickets.department_id', function ($dq) use ($userId) {
                    $dq->select('department_id')
                        ->from('ticket_department_user')
                        ->where('user_id', $userId);
                });
            }
        });
    }

    public function canBeAccessedByStaff(?User $user): bool
    {
        if (!$user || $user->isCustomerPortalUser()) {
            return false;
        }

        return self::query()
            ->accessibleByStaff($user)
            ->whereKey($this->id)
            ->exists();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function customerPart(): BelongsTo
    {
        return $this->belongsTo(CustomerPart::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(TicketDepartment::class, 'department_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)->orderBy('id');
    }

    public function publicMessages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)
            ->where('is_internal_note', false)
            ->orderBy('id');
    }
}
