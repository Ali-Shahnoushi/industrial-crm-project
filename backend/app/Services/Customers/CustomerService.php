<?php

namespace App\Services\Customers;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\PartServiceHistory;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class CustomerService
{
    /**
     * Assign a physical part to a customer with unique serial number.
     * Automatically converts a 'potential' customer to 'effective'.
     */
    public function assignPart(Customer $customer, Part $part, string $serialNumber, array $attributes = [], ?int $userId = null): CustomerPart
    {
        $serialNumber = trim($serialNumber);

        if (CustomerPart::where('serial_number', $serialNumber)->exists()) {
            throw ValidationException::withMessages([
                'serial_number' => ["شماره سریال {$serialNumber} قبلاً برای قطعه دیگری در سیستم ثبت شده است."],
            ]);
        }

        $installDate = isset($attributes['installation_date']) && !empty($attributes['installation_date'])
            ? Carbon::parse($attributes['installation_date'])
            : Carbon::now();

        $warrantyMonths = $part->periodic_service_months ?: 12;
        $warrantyExpire = (clone $installDate)->addMonths($warrantyMonths);

        $customerPart = $customer->customerParts()->create([
            'part_id' => $part->id,
            'serial_number' => $serialNumber,
            'installation_date' => $installDate->toDateString(),
            'warranty_expire_date' => $warrantyExpire->toDateString(),
            'status' => $attributes['status'] ?? 'active',
            'notes' => $attributes['notes'] ?? null,
        ]);

        // Audit Trail: Part Assignment
        $customer->histories()->create([
            'user_id' => $userId,
            'action' => 'part_assigned',
            'description' => "قطعه «{$part->name}» با شماره سریال {$serialNumber} به مشتری تخصیص داده شد.",
            'metadata' => [
                'part_id' => $part->id,
                'part_name' => $part->name,
                'serial_number' => $serialNumber,
                'warranty_expire_date' => $warrantyExpire->toDateString(),
            ],
        ]);

        // Automatic conversion from 'potential' to 'effective'
        if ($customer->customer_type === 'potential') {
            $customer->update(['customer_type' => 'effective']);

            $customer->histories()->create([
                'user_id' => $userId,
                'action' => 'type_converted',
                'description' => "وضعیت مشتری به دلیل تحویل قطعه فیزیکی (سریال {$serialNumber}) از «بالقوه» به «بالفعل» تغییر یافت.",
                'metadata' => [
                    'previous_type' => 'potential',
                    'new_type' => 'effective',
                    'triggered_by_serial' => $serialNumber,
                ],
            ]);
        }

        return $customerPart->load('part');
    }

    /**
     * Record past repair/service history on a customer part
     */
    public function recordServiceHistory(CustomerPart $customerPart, array $data, ?int $userId = null): PartServiceHistory
    {
        $history = $customerPart->serviceHistories()->create([
            'performed_by_user_id' => $userId,
            'service_date' => $data['service_date'] ?? Carbon::now()->toDateString(),
            'service_type' => $data['service_type'] ?? 'repair',
            'description' => $data['description'],
            'cost' => $data['cost'] ?? null,
        ]);

        $customer = $customerPart->customer;
        if ($customer) {
            $customer->histories()->create([
                'user_id' => $userId,
                'action' => 'service_performed',
                'description' => "اقدام سرویس/تعمیر برای قطعه سریال {$customerPart->serial_number} ثبت گردید.",
                'metadata' => [
                    'service_history_id' => $history->id,
                    'service_type' => $history->service_type,
                    'cost' => $history->cost,
                ],
            ]);
        }

        return $history;
    }
}
