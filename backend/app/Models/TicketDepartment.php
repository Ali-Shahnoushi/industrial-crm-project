<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TicketDepartment extends Model
{
    use HasFactory;

    public const STRATEGY_ROUND_ROBIN = 'round_robin';
    public const STRATEGY_RANDOM = 'random';
    public const STRATEGY_LEAST_LOADED = 'least_loaded';

    public const STRATEGY_LABELS = [
        self::STRATEGY_ROUND_ROBIN => 'توزیع نوبتی چرخشی (Round-Robin)',
        self::STRATEGY_LEAST_LOADED => 'کمترین تیکت باز فعال (Least-Loaded)',
        self::STRATEGY_RANDOM => 'توزیع تصادفی (Random)',
    ];

    protected $fillable = [
        'name',
        'description',
        'assignment_strategy',
        'is_default_repair',
        'is_active',
        'sort_order',
        'last_assigned_user_id',
    ];

    protected $appends = [
        'assignment_strategy_label',
    ];

    protected function casts(): array
    {
        return [
            'is_default_repair' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'last_assigned_user_id' => 'integer',
        ];
    }

    public function getAssignmentStrategyLabelAttribute(): string
    {
        return self::STRATEGY_LABELS[$this->assignment_strategy ?? ''] ?? 'توزیع نوبتی چرخشی';
    }

    public function agents(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'ticket_department_user',
            'department_id',
            'user_id'
        )->withTimestamps();
    }

    public function lastAssignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_assigned_user_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'department_id');
    }
}
