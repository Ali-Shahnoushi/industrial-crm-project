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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerPortalController extends Controller
{
    public function __construct(protected TicketAssignmentService $assignmentService)
    {
    }

    protected function resolvePortalCustomer(Request $request): Customer
    {
        /** @var User $user */
        $user = $request->user();

        return Customer::with([
            'creator:id,name,email,phone,user_type,avatar,is_active',
            'salesManager:id,name,email,phone,user_type,avatar,is_active',
        ])->findOrFail($user->customer_id);
    }

    protected function buildSalesTeamPayload(Customer $customer): array
    {
        $salesRepUser = ($customer->creator && $customer->creator->is_active && !$customer->creator->isCustomerPortalUser())
            ? $customer->creator
            : null;

        $salesManagerUser = ($customer->salesManager && $customer->salesManager->is_active && !$customer->salesManager->isCustomerPortalUser())
            ? $customer->salesManager
            : User::staffOnly()
                ->where('is_active', true)
                ->whereIn('user_type', [User::ROLE_MANAGER, User::ROLE_ADMINISTRATOR])
                ->orderByRaw("CASE WHEN user_type = 'manager' THEN 0 ELSE 1 END")
                ->orderBy('id')
                ->first(['id', 'name', 'email', 'phone', 'user_type', 'avatar', 'is_active']);

        $formatContact = fn (?User $u, string $fallbackTitle) => $u ? [
            'id' => $u->id,
            'name' => $u->name,
            'title' => $fallbackTitle,
            'role_label' => $u->role_label,
            'phone' => $u->phone,
            'email' => $u->email,
            'avatar_url' => $u->avatar_url,
        ] : null;

        return [
            'sales_manager' => $formatContact($salesManagerUser, 'مدیر فروش پروژه'),
            'sales_rep' => $formatContact($salesRepUser, 'کارشناس و مسئول فروش پرونده'),
        ];
    }

    protected function formatPortalDevice(CustomerPart $cp, array $openTicketCountByDevice = []): array
    {
        $today = Carbon::today();
        $warrantyExpire = $cp->warranty_expire_date ? Carbon::parse($cp->warranty_expire_date)->startOfDay() : null;
        $isUnderWarranty = $warrantyExpire ? $warrantyExpire->greaterThanOrEqualTo($today) : false;
        $warrantyDaysLeft = $warrantyExpire ? (int) $today->diffInDays($warrantyExpire, false) : null;

        return [
            'id' => $cp->id,
            'part_id' => $cp->part_id,
            'serial_number' => $cp->serial_number,
            'quantity' => (int) ($cp->quantity ?? 1),
            'installation_date' => $cp->installation_date,
            'warranty_expire_date' => $cp->warranty_expire_date,
            'is_under_warranty' => $isUnderWarranty,
            'warranty_days_remaining' => $warrantyDaysLeft,
            'status' => $cp->status,
            'notes' => $cp->notes,
            'open_repair_tickets_count' => (int) ($openTicketCountByDevice[$cp->id] ?? 0),
            'part' => $cp->part ? [
                'id' => $cp->part->id,
                'name' => $cp->part->name,
                'code' => $cp->part->code,
                'unit' => $cp->part->unit ?? 'دستگاه',
                'periodic_service_months' => $cp->part->periodic_service_months,
                'description' => $cp->part->description,
            ] : null,
            'service_histories' => $cp->serviceHistories->map(fn ($h) => [
                'id' => $h->id,
                'service_date' => $h->service_date,
                'service_type' => $h->service_type,
                'description' => $h->description,
                'cost' => $h->cost,
                'performed_by_name' => $h->performedBy?->name ?? 'واحد فنی',
            ])->values()->all(),
        ];
    }

    /**
     * Customer Portal Home Overview:
     * - Safe customer dossier info
     * - Dedicated Project Sales Manager & Sales Representative contacts
     * - Assigned devices summary & warranty status
     * - Active departments & recent tickets
     */
    public function overview(Request $request): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);

        $customerParts = $customer->customerParts()
            ->with([
                'part:id,name,code,unit,periodic_service_months,description',
                'serviceHistories' => fn ($q) => $q->latest('service_date')->with('performedBy:id,name'),
            ])
            ->latest()
            ->get();

        $openTicketCountsByDevice = Ticket::where('customer_id', $customer->id)
            ->whereNotNull('customer_part_id')
            ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
            ->selectRaw('customer_part_id, COUNT(*) as cnt')
            ->groupBy('customer_part_id')
            ->pluck('cnt', 'customer_part_id')
            ->all();

        $devices = $customerParts->map(fn (CustomerPart $cp) => $this->formatPortalDevice($cp, $openTicketCountsByDevice))->values();

        $recentTickets = Ticket::where('customer_id', $customer->id)
            ->with([
                'department:id,name',
                'assignee:id,name,user_type,avatar',
                'customerPart.part:id,name,code',
            ])
            ->orderByDesc('last_reply_at')
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        $departments = TicketDepartment::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'description', 'is_default_repair']);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'display_name' => $customer->display_name,
                'full_name' => $customer->full_name,
                'type' => $customer->type,
                'customer_type' => $customer->customer_type,
                'company_name' => $customer->company_name,
                'first_name' => $customer->first_name,
                'last_name' => $customer->last_name,
                'mobile' => $customer->mobile,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'province' => $customer->province,
                'city' => $customer->city,
                'address' => $customer->address,
            ],
            'sales_team' => $this->buildSalesTeamPayload($customer),
            'stats' => [
                'devices_count' => $devices->count(),
                'total_devices_qty' => (int) $customerParts->sum('quantity'),
                'active_warranty_count' => $devices->where('is_under_warranty', true)->count(),
                'open_tickets_count' => Ticket::where('customer_id', $customer->id)->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)->count(),
                'answered_tickets_count' => Ticket::where('customer_id', $customer->id)->where('status', Ticket::STATUS_ANSWERED)->count(),
            ],
            'devices' => $devices,
            'departments' => $departments,
            'recent_tickets' => $recentTickets,
        ]);
    }

    /**
     * List all devices assigned to the authenticated portal customer along with warranty & service history.
     */
    public function devices(Request $request): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);

        $openTicketCountsByDevice = Ticket::where('customer_id', $customer->id)
            ->whereNotNull('customer_part_id')
            ->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES)
            ->selectRaw('customer_part_id, COUNT(*) as cnt')
            ->groupBy('customer_part_id')
            ->pluck('cnt', 'customer_part_id')
            ->all();

        $devices = $customer->customerParts()
            ->with([
                'part:id,name,code,unit,periodic_service_months,description',
                'serviceHistories' => fn ($q) => $q->latest('service_date')->with('performedBy:id,name'),
            ])
            ->latest()
            ->get()
            ->map(fn (CustomerPart $cp) => $this->formatPortalDevice($cp, $openTicketCountsByDevice))
            ->values();

        return response()->json([
            'devices' => $devices,
            'data' => $devices,
        ]);
    }

    /**
     * Paginated list of the customer's own tickets & repair requests.
     */
    public function tickets(Request $request): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);

        $query = Ticket::where('customer_id', $customer->id)
            ->with([
                'department:id,name',
                'assignee:id,name,user_type,avatar',
                'customerPart.part:id,name,code',
            ])
            ->withCount(['publicMessages as messages_count'])
            ->orderByDesc('last_reply_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            if ($request->status === 'active_all') {
                $query->whereIn('status', Ticket::ACTIVE_LOAD_STATUSES);
            } else {
                $query->where('status', $request->status);
            }
        }

        if ($request->filled('ticket_type') && in_array($request->ticket_type, ['repair_request', 'sales_inquiry', 'technical_support', 'general'], true)) {
            $query->where('ticket_type', $request->ticket_type);
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $normTerm, $op) {
                $q->where('tracking_code', $op, "%{$normTerm}%")
                    ->orWhere('subject', $op, "%{$term}%");
            });
        }

        $perPage = max(1, min(50, (int) $request->input('per_page', 15)));

        return response()->json($query->paginate($perPage));
    }

    /**
     * Customer submits a Device Breakdown / Repair Request OR a Sales / Support Ticket.
     */
    public function createTicket(Request $request): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);
        /** @var User $portalUser */
        $portalUser = $request->user();

        $validated = $request->validate([
            'ticket_type' => 'required|in:repair_request,sales_inquiry,technical_support,general',
            'customer_part_id' => 'nullable|integer',
            'department_id' => 'nullable|integer|exists:ticket_departments,id',
            'target_contact' => 'nullable|in:sales_rep,sales_manager',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'subject' => 'required|string|max:200',
            'body' => 'required|string|max:10000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ], [
            'ticket_type.required' => 'نوع درخواست را انتخاب کنید.',
            'subject.required' => 'عنوان درخواست یا شرح کوتاه خرابی الزامی است.',
            'body.required' => 'لطفاً جزئیات کامل درخواست یا علائم خرابی دستگاه را بنویسید.',
            'attachment.mimes' => 'فایل پیوست فقط می‌تواند تصویر (JPG, PNG, WebP) یا PDF باشد.',
            'attachment.max' => 'حداکثر حجم فایل پیوست ۵ مگابایت است.',
        ]);

        // Enforce strict device ownership!
        $customerPart = null;
        if (!empty($validated['customer_part_id'])) {
            $customerPart = CustomerPart::where('id', (int) $validated['customer_part_id'])
                ->where('customer_id', $customer->id)
                ->first();

            if (!$customerPart) {
                throw ValidationException::withMessages([
                    'customer_part_id' => ['دستگاه انتخاب‌شده معتبر نیست یا متعلق به پرونده شما نمی‌باشد.'],
                ]);
            }
        }

        // Resolve target department
        $department = null;
        if (!empty($validated['department_id'])) {
            $department = TicketDepartment::where('is_active', true)->find($validated['department_id']);
        }
        if (!$department) {
            if ($validated['ticket_type'] === Ticket::TYPE_REPAIR_REQUEST) {
                $department = TicketDepartment::where('is_active', true)->where('is_default_repair', true)->first()
                    ?? TicketDepartment::where('is_active', true)->orderBy('sort_order')->first();
            } elseif ($validated['ticket_type'] === Ticket::TYPE_SALES_INQUIRY) {
                $op = $this->likeOp();
                $department = TicketDepartment::where('is_active', true)->where('name', $op, '%فروش%')->first()
                    ?? TicketDepartment::where('is_active', true)->orderBy('sort_order')->first();
            } else {
                $department = TicketDepartment::where('is_active', true)->orderBy('sort_order')->first();
            }
        }

        // Check if customer explicitly chose direct contact with their Sales Rep or Sales Manager
        $directAssigneeId = null;
        if (!empty($validated['target_contact'])) {
            $salesTeam = $this->buildSalesTeamPayload($customer);
            if ($validated['target_contact'] === 'sales_rep' && !empty($salesTeam['sales_rep']['id'])) {
                $directAssigneeId = (int) $salesTeam['sales_rep']['id'];
            } elseif ($validated['target_contact'] === 'sales_manager' && !empty($salesTeam['sales_manager']['id'])) {
                $directAssigneeId = (int) $salesTeam['sales_manager']['id'];
            }
        }

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('ticket-attachments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $ticket = DB::transaction(function () use ($customer, $portalUser, $customerPart, $department, $directAssigneeId, $validated, $attachmentPath, $attachmentName) {
            $assigneeId = $directAssigneeId ?? $this->assignmentService->selectAssignee($department);

            $created = Ticket::create([
                'tracking_code' => Ticket::generateTrackingCode(),
                'customer_id' => $customer->id,
                'customer_part_id' => $customerPart?->id,
                'department_id' => $department?->id,
                'created_by_user_id' => $portalUser->id,
                'assigned_to_user_id' => $assigneeId,
                'ticket_type' => $validated['ticket_type'],
                'priority' => $validated['priority'] ?? ($validated['ticket_type'] === Ticket::TYPE_REPAIR_REQUEST ? 'high' : 'medium'),
                'status' => Ticket::STATUS_OPEN,
                'subject' => trim($validated['subject']),
                'last_reply_at' => now(),
            ]);

            $created->messages()->create([
                'user_id' => $portalUser->id,
                'sender_type' => 'customer',
                'is_internal_note' => false,
                'body' => trim($validated['body']),
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $actionLabel = $validated['ticket_type'] === Ticket::TYPE_REPAIR_REQUEST
                ? 'ثبت درخواست تعمیر / خرابی دستگاه از پنل مشتری'
                : 'ثبت تیکت جدید توسط مشتری در پنل کاربری';

            $customer->histories()->create([
                'user_id' => $assigneeId ?? $customer->created_by_user_id,
                'action' => 'updated',
                'description' => "{$actionLabel}: «{$created->subject}» (کد رهگیری {$created->tracking_code})",
            ]);

            return $created->load([
                'department:id,name',
                'assignee:id,name,user_type,avatar',
                'customerPart.part:id,name,code',
                'publicMessages.user:id,name,user_type,avatar',
            ]);
        });

        $payload = $ticket->toArray();
        $payload['messages'] = $payload['public_messages'] ?? [];
        unset($payload['public_messages']);

        return response()->json([
            'message' => 'درخواست شما با موفقیت ثبت شد و به کارشناس مربوطه ارجاع گردید.',
            'ticket' => $payload,
        ], 201);
    }

    /**
     * View a single ticket thread inside Customer Portal — strictly excludes internal staff notes!
     */
    public function showTicket(Request $request, int $ticket): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);

        $found = Ticket::where('customer_id', $customer->id)
            ->with([
                'department:id,name',
                'assignee:id,name,user_type,avatar',
                'customerPart.part:id,name,code,unit',
                'publicMessages.user:id,name,user_type,avatar',
            ])
            ->findOrFail($ticket);

        $payload = $found->toArray();
        $payload['messages'] = $payload['public_messages'] ?? [];
        unset($payload['public_messages']);

        return response()->json([
            'ticket' => $payload,
        ]);
    }

    /**
     * Customer posts a follow-up reply on an open/answered/resolved ticket.
     */
    public function replyTicket(Request $request, int $ticket): JsonResponse
    {
        $customer = $this->resolvePortalCustomer($request);
        /** @var User $portalUser */
        $portalUser = $request->user();

        $found = Ticket::where('customer_id', $customer->id)->findOrFail($ticket);

        if ($found->status === Ticket::STATUS_CLOSED) {
            return response()->json([
                'message' => 'این تیکت بسته شده است. در صورت نیاز به پیگیری مجدد، لطفاً تیکت جدیدی ثبت فرمایید.',
            ], 422);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:10000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ], [
            'body.required' => 'متن پیام خود را وارد کنید.',
            'attachment.mimes' => 'فایل پیوست فقط می‌تواند تصویر (JPG, PNG, WebP) یا PDF باشد.',
            'attachment.max' => 'حداکثر حجم فایل پیوست ۵ مگابایت است.',
        ]);

        $attachmentPath = null;
        $attachmentName = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('ticket-attachments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $msg = DB::transaction(function () use ($found, $portalUser, $validated, $attachmentPath, $attachmentName) {
            $createdMsg = $found->messages()->create([
                'user_id' => $portalUser->id,
                'sender_type' => 'customer',
                'is_internal_note' => false,
                'body' => trim($validated['body']),
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
            ]);

            $found->update([
                'status' => Ticket::STATUS_CUSTOMER_REPLY,
                'last_reply_at' => now(),
            ]);

            return $createdMsg->load('user:id,name,user_type,avatar');
        });

        return response()->json([
            'message' => 'پاسخ شما با موفقیت ثبت و برای کارشناس ارسال شد.',
            'ticket_message' => $msg,
        ], 201);
    }
}
