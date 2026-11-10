<?php

namespace App\Services\Tickets;

use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TicketAssignmentService
{
    /**
     * Resolve the optimal active staff agent in the given department according to its configured strategy:
     * - `round_robin`: strict sequential cursor rotation across active agents (`lockForUpdate` concurrency-safe)
     * - `least_loaded`: active agent with the fewest currently open/active tickets (round-robin tie-breaker)
     * - `random`: uniform random selection among active department agents
     */
    public function selectAssignee(?TicketDepartment $department): ?int
    {
        if (!$department) {
            return null;
        }

        return DB::transaction(function () use ($department) {
            /** @var TicketDepartment|null $lockedDept */
            $lockedDept = TicketDepartment::whereKey($department->id)->lockForUpdate()->first();
            if (!$lockedDept) {
                return null;
            }

            $agents = $lockedDept->agents()
                ->where('users.is_active', true)
                ->where(function ($q) {
                    $q->where('users.user_type', '!=', User::ROLE_CUSTOMER)
                        ->orWhereNull('users.user_type');
                })
                ->orderBy('users.id')
                ->get(['users.id', 'users.name']);

            if ($agents->isEmpty()) {
                return null;
            }

            if ($agents->count() === 1) {
                $onlyId = (int) $agents->first()->id;
                $lockedDept->update(['last_assigned_user_id' => $onlyId]);
                return $onlyId;
            }

            $strategy = $lockedDept->assignment_strategy ?: TicketDepartment::STRATEGY_ROUND_ROBIN;

            $selectedId = match ($strategy) {
                TicketDepartment::STRATEGY_RANDOM => $this->pickRandom($agents),
                TicketDepartment::STRATEGY_LEAST_LOADED => $this->pickLeastLoaded($agents, $lockedDept->last_assigned_user_id),
                default => $this->pickRoundRobin($agents, $lockedDept->last_assigned_user_id),
            };

            $lockedDept->update(['last_assigned_user_id' => $selectedId]);

            return $selectedId;
        });
    }

    /**
     * @param \Illuminate\Support\Collection<int, User> $agents
     */
    protected function pickRoundRobin($agents, ?int $lastUserId): int
    {
        $ids = $agents->pluck('id')->map(fn ($v) => (int) $v)->values()->all();
        if (!$lastUserId) {
            return $ids[0];
        }

        $currentIndex = array_search((int) $lastUserId, $ids, true);
        if ($currentIndex === false) {
            foreach ($ids as $id) {
                if ($id > (int) $lastUserId) {
                    return $id;
                }
            }
            return $ids[0];
        }

        $nextIndex = ($currentIndex + 1) % count($ids);
        return $ids[$nextIndex];
    }

    /**
     * @param \Illuminate\Support\Collection<int, User> $agents
     */
    protected function pickRandom($agents): int
    {
        $ids = $agents->pluck('id')->map(fn ($v) => (int) $v)->values()->all();
        return $ids[random_int(0, count($ids) - 1)];
    }

    /**
     * @param \Illuminate\Support\Collection<int, User> $agents
     */
    protected function pickLeastLoaded($agents, ?int $lastUserId): int
    {
        $ids = $agents->pluck('id')->map(fn ($v) => (int) $v)->values()->all();

        $openCounts = Ticket::query()
            ->whereIn('assigned_to_user_id', $ids)
            ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
            ->selectRaw('assigned_to_user_id, COUNT(*) as open_count')
            ->groupBy('assigned_to_user_id')
            ->pluck('open_count', 'assigned_to_user_id');

        $minLoad = null;
        foreach ($ids as $id) {
            $load = (int) ($openCounts[$id] ?? 0);
            if ($minLoad === null || $load < $minLoad) {
                $minLoad = $load;
            }
        }

        $tiedCandidates = $agents->filter(fn ($u) => (int) ($openCounts[$u->id] ?? 0) === $minLoad)->values();
        if ($tiedCandidates->count() === 1) {
            return (int) $tiedCandidates->first()->id;
        }

        return $this->pickRoundRobin($tiedCandidates, $lastUserId);
    }
}
