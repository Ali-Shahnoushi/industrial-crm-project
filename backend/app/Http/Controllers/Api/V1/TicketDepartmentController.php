<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketDepartmentController extends Controller
{
    /**
     * List active ticket departments for staff ticket creation & filter dropdowns.
     */
    public function activeList(): JsonResponse
    {
        $user = auth()->user();
        if (!$user || (!$user->hasSafePermission('tickets.view') && !$user->hasSafePermission('settings.manage'))) {
            abort(403, 'شما مجوز مشاهده دپارتمان‌های تیکتینگ را ندارید.');
        }

        $departments = TicketDepartment::where('is_active', true)
            ->with(['agents' => function ($q) {
                $q->where('users.is_active', true)
                    ->staffOnly()
                    ->select(['users.id', 'users.name', 'users.email', 'users.user_type', 'users.avatar']);
            }])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'departments' => $departments,
            'data' => $departments,
        ]);
    }

    /**
     * Full admin management list of all ticket departments, assigned agents, active ticket loads, and staff candidates.
     */
    public function index(): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $openCountsByAgent = Ticket::query()
            ->whereNotNull('assigned_to_user_id')
            ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
            ->selectRaw('assigned_to_user_id, COUNT(*) as open_count')
            ->groupBy('assigned_to_user_id')
            ->pluck('open_count', 'assigned_to_user_id');

        $departments = TicketDepartment::with([
            'agents' => fn ($q) => $q->staffOnly()->select(['users.id', 'users.name', 'users.email', 'users.user_type', 'users.is_active', 'users.avatar']),
            'lastAssignedUser:id,name',
        ])
            ->withCount([
                'tickets',
                'tickets as open_tickets_count' => fn ($q) => $q->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES),
            ])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(function (TicketDepartment $dept) use ($openCountsByAgent) {
                $arr = $dept->toArray();
                $arr['agent_ids'] = $dept->agents->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
                $arr['agents'] = $dept->agents->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'user_type' => $u->user_type,
                    'role_label' => $u->role_label,
                    'is_active' => (bool) $u->is_active,
                    'avatar_url' => $u->avatar_url,
                    'open_tickets_count' => (int) ($openCountsByAgent[$u->id] ?? 0),
                ])->values()->all();
                return $arr;
            });

        $staffCandidates = User::staffOnly()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'user_type', 'avatar'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'user_type' => $u->user_type,
                'role_label' => $u->role_label,
                'avatar_url' => $u->avatar_url,
                'open_tickets_count' => (int) ($openCountsByAgent[$u->id] ?? 0),
            ]);

        return response()->json([
            'departments' => $departments,
            'staff_candidates' => $staffCandidates,
            'strategies' => [
                ['key' => TicketDepartment::STRATEGY_ROUND_ROBIN, 'label' => 'توزیع نوبتی چرخشی (Round-Robin)', 'description' => 'تیکت‌های جدید به ترتیب و نوبت مساوی بین کارشناسان فعال دپارتمان تقسیم می‌شوند.'],
                ['key' => TicketDepartment::STRATEGY_LEAST_LOADED, 'label' => 'کمترین تیکت باز فعال (Least-Loaded)', 'description' => 'تیکت جدید به کارشناسی ارجاع می‌شود که در حال حاضر کمترین تیکت باز و درجریان را دارد.'],
                ['key' => TicketDepartment::STRATEGY_RANDOM, 'label' => 'توزیع تصادفی (Random)', 'description' => 'تیکت جدید به صورت تصادفی به یکی از کارشناسان فعال دپارتمان اختصاص می‌یابد.'],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:120|unique:ticket_departments,name',
            'description' => 'nullable|string|max:500',
            'assignment_strategy' => 'required|in:round_robin,random,least_loaded',
            'is_default_repair' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:999',
            'agent_ids' => 'nullable|array',
            'agent_ids.*' => 'integer|exists:users,id',
        ], [
            'name.required' => 'نام دپارتمان الزامی است.',
            'name.unique' => 'دپارتمانی با این نام قبلاً ثبت شده است.',
            'assignment_strategy.required' => 'انتخاب الگوریتم توزیع خودکار تیکت الزامی است.',
        ]);

        $validStaffIds = !empty($validated['agent_ids'])
            ? User::staffOnly()->whereIn('id', $validated['agent_ids'])->pluck('id')->all()
            : [];

        $department = DB::transaction(function () use ($validated, $validStaffIds, $request) {
            $isDefaultRepair = $request->boolean('is_default_repair', false);
            if ($isDefaultRepair) {
                TicketDepartment::query()->update(['is_default_repair' => false]);
            }

            $created = TicketDepartment::create([
                'name' => trim($validated['name']),
                'description' => $validated['description'] ?? null,
                'assignment_strategy' => $validated['assignment_strategy'],
                'is_default_repair' => $isDefaultRepair,
                'is_active' => $request->boolean('is_active', true),
                'sort_order' => (int) ($validated['sort_order'] ?? (TicketDepartment::max('sort_order') + 1)),
            ]);

            $created->agents()->sync($validStaffIds);

            return $created->load('agents:id,name,email,user_type,is_active');
        });

        return response()->json([
            'message' => 'دپارتمان جدید تیکتینگ با موفقیت ایجاد شد.',
            'department' => $department,
        ], 201);
    }

    public function update(Request $request, TicketDepartment $ticketDepartment): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120|unique:ticket_departments,name,' . $ticketDepartment->id,
            'description' => 'nullable|string|max:500',
            'assignment_strategy' => 'sometimes|required|in:round_robin,random,least_loaded',
            'is_default_repair' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:999',
            'agent_ids' => 'nullable|array',
            'agent_ids.*' => 'integer|exists:users,id',
        ], [
            'name.required' => 'نام دپارتمان الزامی است.',
            'name.unique' => 'دپارتمانی با این نام قبلاً ثبت شده است.',
        ]);

        DB::transaction(function () use ($ticketDepartment, $validated, $request) {
            if ($request->has('is_default_repair') && $request->boolean('is_default_repair')) {
                TicketDepartment::where('id', '!=', $ticketDepartment->id)->update(['is_default_repair' => false]);
            }

            $updates = [];
            foreach (['name', 'description', 'assignment_strategy', 'sort_order'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $updates[$field] = $validated[$field];
                }
            }
            if ($request->has('is_default_repair')) {
                $updates['is_default_repair'] = $request->boolean('is_default_repair');
            }
            if ($request->has('is_active')) {
                $updates['is_active'] = $request->boolean('is_active');
            }

            if (!empty($updates)) {
                $ticketDepartment->update($updates);
            }

            if (array_key_exists('agent_ids', $validated)) {
                $validStaffIds = !empty($validated['agent_ids'])
                    ? User::staffOnly()->whereIn('id', $validated['agent_ids'])->pluck('id')->all()
                    : [];
                $ticketDepartment->agents()->sync($validStaffIds);
            }
        });

        return response()->json([
            'message' => 'تنظیمات دپارتمان و کارشناسان پاسخگو بروزرسانی شد.',
            'department' => $ticketDepartment->fresh('agents:id,name,email,user_type,is_active'),
        ]);
    }

    public function destroy(TicketDepartment $ticketDepartment): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        if ($ticketDepartment->tickets()->exists()) {
            return response()->json([
                'message' => 'این دپارتمان دارای سوابق تیکت ثبت‌شده است و برای حفظ تاریخچه قابل حذف مستقیم نیست (می‌توانید آن را غیرفعال کنید).',
            ], 422);
        }

        $ticketDepartment->delete();

        return response()->json([
            'message' => 'دپارتمان تیکتینگ حذف شد.',
        ]);
    }
}
