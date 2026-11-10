<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use App\Services\Tickets\TicketAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TicketController extends Controller
{
    public function __construct(protected TicketAssignmentService $assignmentService)
    {
    }

    /**
     * Staff KPI summary for Ticketing Dashboard.
     */
    public function summary(Request $request): JsonResponse
    {
        $this->authorizePermission('tickets.view');

        /** @var User $user */
        $user = $request->user();
        $base = Ticket::accessibleByStaff($user);

        return response()->json([
            'total' => (clone $base)->count(),
            'open_active' => (clone $base)->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
            'waiting_staff' => (clone $base)->whereIn('status', [Ticket::STATUS_OPEN, Ticket::STATUS_CUSTOMER_REPLY])->count(),
            'repair_requests' => (clone $base)->where('ticket_type', Ticket::TYPE_REPAIR_REQUEST)->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
            'urgent_high' => (clone $base)->whereIn('priority', ['urgent', 'high'])->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
            'assigned_to_me' => (clone $base)->where('assigned_to_user_id', $user->id)->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
            'unassigned' => (clone $base)->whereNull('assigned_to_user_id')->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
        ]);
    }

    /**
     * Paginated list of tickets visible to the authenticated staff member.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('tickets.view');

        /** @var User $user */
        $user = $request->user();

        $query = Ticket::accessibleByStaff($user)
            ->with([
                'customer:id,first_name,last_name,company_name,type,mobile,customer_type',
                'customerPart.part:id,name,code',
                'department:id,name,assignment_strategy',
                'assignee:id,name,user_type,avatar',
                'creator:id,name,user_type',
            ])
            ->withCount('messages')
            ->orderByDesc('last_reply_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            if ($request->status === 'active_all') {
                $query->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES);
            } else {
                $query->where('status', $request->status);
            }
        }

        if ($request->filled('priority') && in_array($request->priority, ['low', 'medium', 'high', 'urgent'], true)) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('ticket_type') && in_array($request->ticket_type, ['repair_request', 'sales_inquiry', 'technical_support', 'general'], true)) {
            $query->where('ticket_type', $request->ticket_type);
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', (int) $request->department_id);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->customer_id);
        }

        if ($request->boolean('mine_only', false)) {
            $query->where('assigned_to_user_id', $user->id);
        } elseif ($request->boolean('unassigned_only', false)) {
            $query->whereNull('assigned_to_user_id');
        } elseif ($request->filled('assigned_to_user_id')) {
            $query->where('assigned_to_user_id', (int) $request->assigned_to_user_id);
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();

            $query->where(function ($q) use ($term, $normTerm, $op) {
                $q->where('tracking_code', $op, "%{$normTerm}%")
                    ->orWhere('subject', $op, "%{$term}%")
                    ->orWhereHas('customer', function ($cq) use ($term, $normTerm, $op) {
                        $cq->where('first_name', $op, "%{$term}%")
                            ->orWhere('last_name', $op, "%{$term}%")
                            ->orWhere('company_name', $op, "%{$term}%")
                            ->orWhere('mobile', $op, "%{$normTerm}%");
                    })
                    ->orWhereHas('customerPart', function ($cpq) use ($term, $normTerm, $op) {
                        $cpq->where('serial_number', $op, "%{$normTerm}%")
                            ->orWhereHas('part', fn ($pq) => $pq->where('name', $op, "%{$term}%"));
                    });
            });
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 15)));

        return response()->json($query->paginate($perPage));
    }

    /**
     * Staff creates a new ticket on behalf of a customer (auto-routed via department strategy unless manually assigned).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('tickets.reply');

        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'customer_part_id' => 'nullable|integer|exists:customer_parts,id',
            'department_id' => 'nullable|integer|exists:ticket_departments,id',
            'assigned_to_user_id' => 'nullable|integer|exists:users,id',
            'ticket_type' => 'nullable|in:repair_request,sales_inquiry,technical_support,general',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'subject' => 'required|string|max:200',
            'body' => 'required|string|max:10000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ], [
            'customer_id.required' => 'انتخاب مشتری الزامی است.',
            'subject.required' => 'عنوان تیکت را وارد کنید.',
            'body.required' => 'متن شرح درخواست یا پیام تیکت الزامی است.',
            'attachment.mimes' => 'فایل پیوست فقط می‌تواند تصویر (JPG, PNG, WebP) یا PDF باشد.',
            'attachment.max' => 'حداکثر حجم مجاز فایل پیوست ۵ مگابایت است.',
        ]);

        $customer = Customer::findOrFail($validated['customer_id']);
        $this->authorizeCustomerAccess($customer);

        if (!empty($validated['customer_part_id'])) {
            $belongs = CustomerPart::where('id', $validated['customer_part_id'])
                ->where('customer_id', $customer->id)
                ->exists();
            if (!$belongs) {
                throw ValidationException::withMessages([
                    'customer_part_id' => ['دستگاه انتخاب‌شده متعلق به این مشتری نیست.'],
                ]);
            }
        }

        $ticketType = $validated['ticket_type'] ?? (!empty($validated['customer_part_id']) ? Ticket::TYPE_REPAIR_REQUEST : Ticket::TYPE_GENERAL);

        $department = null;
        if (!empty($validated['department_id'])) {
            $department = TicketDepartment::find($validated['department_id']);
        } elseif ($ticketType === Ticket::TYPE_REPAIR_REQUEST) {
            $department = TicketDepartment::where('is_active', true)->where('is_default_repair', true)->first()
                ?? TicketDepartment::where('is_active', true)->orderBy('sort_order')->first();
        } else {
            $department = TicketDepartment::where('is_active', true)->orderBy('sort_order')->first();
        }

        $manualAssigneeId = null;
        if (!empty($validated['assigned_to_user_id']) && $user->hasSafePermission('tickets.manage')) {
            $candidate = User::findOrFail($validated['assigned_to_user_id']);
            if (!$candidate->is_active || $candidate->isCustomerPortalUser()) {
                throw ValidationException::withMessages([
                    'assigned_to_user_id' => ['کارشناس انتخاب‌شده فعال یا معتبر نیست.'],
                ]);
            }
            $manualAssigneeId = $candidate->id;
        }

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('ticket-attachments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $ticket = DB::transaction(function () use ($validated, $customer, $department, $manualAssigneeId, $ticketType, $user, $attachmentPath, $attachmentName) {
            $assigneeId = $manualAssigneeId ?? $this->assignmentService->selectAssignee($department);

            $created = Ticket::create([
                'tracking_code' => Ticket::generateTrackingCode(),
                'customer_id' => $customer->id,
                'customer_part_id' => $validated['customer_part_id'] ?? null,
                'department_id' => $department?->id,
                'created_by_user_id' => $user->id,
                'assigned_to_user_id' => $assigneeId,
                'ticket_type' => $ticketType,
                'priority' => $validated['priority'] ?? 'medium',
                'status' => Ticket::STATUS_OPEN,
                'subject' => trim($validated['subject']),
                'last_reply_at' => now(),
            ]);

            $created->messages()->create([
                'user_id' => $user->id,
                'sender_type' => 'staff',
                'is_internal_note' => false,
                'body' => trim($validated['body']),
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $customer->histories()->create([
                'user_id' => $user->id,
                'action' => 'updated',
                'description' => "تیکت پشتیبانی «{$created->subject}» (کد {$created->tracking_code}) ثبت گردید.",
            ]);

            return $created->load([
                'customer:id,first_name,last_name,company_name,type,mobile',
                'customerPart.part:id,name,code',
                'department:id,name,assignment_strategy',
                'assignee:id,name,user_type,avatar',
                'messages.user:id,name,user_type,avatar',
            ]);
        });

        return response()->json([
            'message' => 'تیکت جدید ثبت شد و به کارشناس مربوطه ارجاع گردید.',
            'ticket' => $ticket,
        ], 201);
    }

    /**
     * Full staff view of a ticket including internal notes, device info, and eligible assignees.
     */
    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizePermission('tickets.view');

        /** @var User $user */
        $user = $request->user();
        if (!$ticket->canBeAccessedByStaff($user)) {
            abort(403, 'شما مجوز دسترسی به این تیکت را ندارید.');
        }

        $ticket->load([
            'customer:id,first_name,last_name,company_name,type,mobile,phone,email,customer_type,created_by_user_id,sales_manager_user_id',
            'customer.creator:id,name,phone,user_type',
            'customer.salesManager:id,name,phone,user_type',
            'customerPart.part:id,name,code,periodic_service_months,unit',
            'customerPart.serviceHistories.performedBy:id,name',
            'department.agents' => fn ($q) => $q->where('users.is_active', true)->staffOnly()->select(['users.id', 'users.name', 'users.user_type']),
            'assignee:id,name,email,phone,user_type,avatar',
            'creator:id,name,user_type',
            'messages.user:id,name,user_type,avatar',
        ]);

        $staffOptions = User::staffOnly()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'user_type'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'user_type' => $u->user_type,
                'role_label' => $u->role_label,
            ]);

        return response()->json([
            'ticket' => $ticket,
            'staff_options' => $staffOptions,
        ]);
    }

    /**
     * Staff replies to a ticket or writes an internal confidential note (`is_internal_note = true`).
     */
    public function addMessage(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizePermission('tickets.reply');

        /** @var User $user */
        $user = $request->user();
        if (!$ticket->canBeAccessedByStaff($user)) {
            abort(403, 'شما مجوز پاسخگویی به این تیکت را ندارید.');
        }

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
            'is_internal_note' => 'nullable|boolean',
            'next_status' => 'nullable|in:open,in_progress,answered,resolved,closed',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ], [
            'body.required' => 'متن پاسخ یا یادداشت را وارد کنید.',
            'attachment.mimes' => 'فایل پیوست فقط می‌تواند تصویر (JPG, PNG, WebP) یا PDF باشد.',
            'attachment.max' => 'حداکثر حجم مجاز فایل پیوست ۵ مگابایت است.',
        ]);

        $isInternal = $request->boolean('is_internal_note', false);

        if (!$isInternal && $ticket->status === Ticket::STATUS_CLOSED && empty($validated['next_status'])) {
            return response()->json([
                'message' => 'این تیکت بسته شده است؛ برای ارسال پاسخ عمومی ابتدا وضعیت آن را به «در حال بررسی» یا «باز» تغییر دهید.',
            ], 422);
        }

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('ticket-attachments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $message = DB::transaction(function () use ($ticket, $user, $validated, $isInternal, $attachmentPath, $attachmentName) {
            $msg = $ticket->messages()->create([
                'user_id' => $user->id,
                'sender_type' => 'staff',
                'is_internal_note' => $isInternal,
                'body' => trim($validated['body']),
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            if (!$isInternal) {
                $targetStatus = $validated['next_status'] ?? Ticket::STATUS_ANSWERED;
                $updates = [
                    'status' => $targetStatus,
                    'last_reply_at' => now(),
                    'closed_at' => $targetStatus === Ticket::STATUS_CLOSED ? now() : null,
                ];
                if (!$ticket->assigned_to_user_id) {
                    $updates['assigned_to_user_id'] = $user->id;
                }
                $ticket->update($updates);
            }

            return $msg->load('user:id,name,user_type,avatar');
        });

        return response()->json([
            'message' => $isInternal ? 'یادداشت محرمانه داخلی ثبت شد.' : 'پاسخ شما برای مشتری ارسال شد.',
            'ticket_message' => $message,
            'ticket' => $ticket->fresh(['assignee:id,name,user_type,avatar', 'department:id,name']),
        ], 201);
    }

    /**
     * Update ticket metadata: status, priority, department transfer (with optional auto-reassignment), or manual assignee.
     */
    public function update(Request $request, Ticket $ticket): JsonResponse
    {
        $user = $request->user();
        if (!$user || (!$user->hasSafePermission('tickets.reply') && !$user->hasSafePermission('tickets.manage'))) {
            abort(403, 'شما مجوز ویرایش وضعیت تیکت را ندارید.');
        }
        if (!$ticket->canBeAccessedByStaff($user)) {
            abort(403, 'شما مجوز دسترسی به این تیکت را ندارید.');
        }

        $validated = $request->validate([
            'status' => 'sometimes|required|in:open,in_progress,answered,customer_reply,resolved,closed',
            'priority' => 'sometimes|required|in:low,medium,high,urgent',
            'department_id' => 'nullable|integer|exists:ticket_departments,id',
            'assigned_to_user_id' => 'nullable|integer|exists:users,id',
            'auto_reassign' => 'nullable|boolean',
        ]);

        if ((array_key_exists('department_id', $validated) || array_key_exists('assigned_to_user_id', $validated))
            && !$user->hasSafePermission('tickets.manage')) {
            abort(403, 'تغییر دپارتمان یا کارشناس مسئول تیکت نیازمند مجوز مدیریت تیکت‌ها (tickets.manage) است.');
        }

        DB::transaction(function () use ($ticket, $validated, $request, $user) {
            $updates = [];
            $systemNotes = [];

            if (array_key_exists('status', $validated) && $validated['status'] !== $ticket->status) {
                $updates['status'] = $validated['status'];
                $updates['closed_at'] = $validated['status'] === Ticket::STATUS_CLOSED ? now() : null;
            }

            if (array_key_exists('priority', $validated) && $validated['priority'] !== $ticket->priority) {
                $updates['priority'] = $validated['priority'];
            }

            if (array_key_exists('department_id', $validated) && (int) ($validated['department_id'] ?? 0) !== (int) ($ticket->department_id ?? 0)) {
                $newDept = !empty($validated['department_id']) ? TicketDepartment::find($validated['department_id']) : null;
                $updates['department_id'] = $newDept?->id;
                $systemNotes[] = 'تیکت به دپارتمان «' . ($newDept?->name ?? 'عمومی') . '» منتقل شد.';

                if ($request->boolean('auto_reassign', true) && !array_key_exists('assigned_to_user_id', $validated)) {
                    $updates['assigned_to_user_id'] = $this->assignmentService->selectAssignee($newDept);
                }
            }

            if (array_key_exists('assigned_to_user_id', $validated)) {
                if (!empty($validated['assigned_to_user_id'])) {
                    $targetAgent = User::findOrFail($validated['assigned_to_user_id']);
                    if (!$targetAgent->is_active || $targetAgent->isCustomerPortalUser()) {
                        throw ValidationException::withMessages([
                            'assigned_to_user_id' => ['کاربر انتخاب‌شده مجاز یا فعال نیست.'],
                        ]);
                    }
                    if ((int) $ticket->assigned_to_user_id !== (int) $targetAgent->id) {
                        $updates['assigned_to_user_id'] = $targetAgent->id;
                        $systemNotes[] = "کارشناس پاسخگو به «{$targetAgent->name}» تغییر یافت.";
                    }
                } else {
                    $updates['assigned_to_user_id'] = null;
                }
            }

            if (!empty($updates)) {
                $ticket->update($updates);
            }

            foreach ($systemNotes as $noteText) {
                $ticket->messages()->create([
                    'user_id' => $user->id,
                    'sender_type' => 'system',
                    'is_internal_note' => true,
                    'body' => $noteText,
                ]);
            }
        });

        return response()->json([
            'message' => 'اطلاعات و وضعیت تیکت بروزرسانی شد.',
            'ticket' => $ticket->fresh([
                'customer:id,first_name,last_name,company_name,type,mobile',
                'customerPart.part:id,name,code',
                'department:id,name,assignment_strategy',
                'assignee:id,name,user_type,avatar',
                'messages.user:id,name,user_type,avatar',
            ]),
        ]);
    }
}
