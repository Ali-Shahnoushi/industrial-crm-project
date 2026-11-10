<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\SmsLog;
use App\Services\Sms\MelipayamakService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function __construct(protected MelipayamakService $melipayamakService)
    {
    }

    /**
     * Send pattern-based SMS to a customer or direct mobile number.
     */
    public function sendPattern(Request $request): JsonResponse
    {
        $this->authorizePermission('sms.send');

        if ($request->has('mobile')) {
            $request->merge([
                'mobile' => preg_replace('/[^\d]/', '', (string) $this->normalizeDigits((string) $request->input('mobile', ''))),
            ]);
        }
        if ($request->has('pattern_code')) {
            $request->merge([
                'pattern_code' => trim((string) $this->normalizeDigits((string) $request->input('pattern_code', ''))),
            ]);
        }

        $validated = $request->validate([
            'mobile' => 'required_without:customer_id|nullable|string|regex:/^09\d{9}$/',
            'pattern_code' => 'required|string|max:50',
            'tokens' => 'required|array|min:1|max:10',
            'tokens.*' => 'required|string|max:500',
            'customer_id' => 'nullable|exists:customers,id',
        ]);

        $user = $request->user();
        $customer = isset($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;

        if ($customer) {
            $this->authorizeCustomerAccess($customer);
        }

        $mobile = $validated['mobile'] ?? $customer?->mobile;
        if (!$mobile) {
            return response()->json([
                'message' => 'شماره همراه معتبری برای ارسال پیامک یافت نشد.',
            ], 422);
        }

        // Prevent restricted-scope staff from bypassing customer ACL by supplying a colleague's customer mobile directly.
        if (!$customer && $user && $user->hasRestrictedCustomerScope()) {
            $matchingCustomers = Customer::where('mobile', $mobile)->get();
            if ($matchingCustomers->isNotEmpty()) {
                $accessibleMatch = $matchingCustomers->first(fn (Customer $c) => $user->canAccessCustomer($c));
                if (!$accessibleMatch) {
                    abort(403, 'این شماره همراه متعلق به پرونده مشتری خارج از محدوده دسترسی شما است.');
                }
                $customer = $accessibleMatch;
            }
        }

        $result = $this->melipayamakService->sendPattern(
            $mobile,
            $validated['pattern_code'],
            $validated['tokens'],
            $customer
        );

        return response()->json([
            'message' => $result['status'],
            'success' => $result['success'],
            'message_id' => $result['message_id'],
            'is_sandbox' => $result['is_sandbox'] ?? false,
        ], $result['success'] ? 200 : 422);
    }

    /**
     * View history of dispatched SMS messages.
     */
    public function logs(Request $request): JsonResponse
    {
        $this->authorizePermission('sms.logs');

        $user = $request->user();
        $query = SmsLog::with('customer')->latest();

        if ($user && $user->hasRestrictedCustomerScope()) {
            $query->whereHas('customer', fn ($cq) => $cq->accessibleBy($user));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->q);
            $normTerm = $this->normalizeDigits($term) ?? $term;
            $op = $this->likeOp();
            $query->where(function ($q) use ($term, $normTerm, $op) {
                $q->where('recipient_mobile', $op, "%{$normTerm}%")
                    ->orWhere('pattern_code', $op, "%{$normTerm}%")
                    ->orWhere('provider_message_id', $op, "%{$normTerm}%")
                    ->orWhereHas('customer', function ($cq) use ($term, $op) {
                        $cq->where('first_name', $op, "%{$term}%")
                            ->orWhere('last_name', $op, "%{$term}%")
                            ->orWhere('company_name', $op, "%{$term}%");
                    });
            });
        }

        $perPage = (int) $request->input('per_page', 20);
        $logs = $query->paginate($perPage);

        return response()->json($logs);
    }
}
