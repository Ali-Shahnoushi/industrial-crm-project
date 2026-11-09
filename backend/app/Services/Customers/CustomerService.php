<?php

namespace App\Services\Customers;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\PartInventoryLog;
use App\Models\PartServiceHistory;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerService
{
    /**
     * Assign a physical device to a customer with unique serial number, quantity, and invoice info.
     * Atomically deducts stock, logs inventory transaction, and converts 'potential' customer to 'effective'.
     */
    public function assignPart(
        Customer $customer,
        Part $part,
        ?string $serialNumber = null,
        array $attributes = [],
        ?int $userId = null
    ): CustomerPart {
        $serialNumber = !empty($serialNumber) ? trim((string) $serialNumber) : null;
        $quantity = max(1, (int) ($attributes['quantity'] ?? 1));
        $invoiceAmount = isset($attributes['invoice_amount']) && $attributes['invoice_amount'] !== '' && $attributes['invoice_amount'] !== null
            ? (float) $attributes['invoice_amount']
            : null;
        $invoiceNumber = isset($attributes['invoice_number']) && trim((string) $attributes['invoice_number']) !== ''
            ? trim((string) $attributes['invoice_number'])
            : null;

        return DB::transaction(function () use ($customer, $part, $serialNumber, $quantity, $invoiceAmount, $invoiceNumber, $attributes, $userId) {
            if ($serialNumber !== null && CustomerPart::where('serial_number', $serialNumber)->lockForUpdate()->exists()) {
                throw ValidationException::withMessages([
                    'serial_number' => ["شماره سریال {$serialNumber} قبلاً برای دستگاه دیگری ثبت شده است."],
                ]);
            }

            /** @var Part $lockedPart */
            $lockedPart = Part::whereKey($part->id)->lockForUpdate()->firstOrFail();
            $beforeBalance = (int) $lockedPart->stock_quantity;

            if ($beforeBalance < $quantity) {
                throw ValidationException::withMessages([
                    'quantity' => [
                        "موجودی انبار برای دستگاه «{$lockedPart->name}» کافی نیست (موجودی فعلی: {$beforeBalance} عدد، تعداد درخواستی: {$quantity} عدد).",
                    ],
                ]);
            }

            $newBalance = $beforeBalance - $quantity;
            $lockedPart->update(['stock_quantity' => $newBalance]);

            $installDate = !empty($attributes['installation_date'])
                ? Carbon::parse($attributes['installation_date'])
                : Carbon::now();

            $warrantyMonths = $lockedPart->periodic_service_months ?: 12;
            $warrantyExpire = (clone $installDate)->addMonths($warrantyMonths);

            $customerPart = $customer->customerParts()->create([
                'part_id' => $lockedPart->id,
                'serial_number' => $serialNumber,
                'quantity' => $quantity,
                'invoice_amount' => $invoiceAmount,
                'invoice_number' => $invoiceNumber,
                'installation_date' => $installDate->toDateString(),
                'warranty_expire_date' => $warrantyExpire->toDateString(),
                'status' => $attributes['status'] ?? 'active',
                'notes' => $attributes['notes'] ?? null,
            ]);

            PartInventoryLog::create([
                'part_id' => $lockedPart->id,
                'customer_part_id' => $customerPart->id,
                'customer_id' => $customer->id,
                'user_id' => $userId,
                'type' => PartInventoryLog::TYPE_OUT_ASSIGN,
                'quantity' => $quantity,
                'balance_before' => $beforeBalance,
                'balance_after' => $newBalance,
                'description' => "تخصیص دستگاه به مشتری «{$customer->display_name}»"
                    . ($serialNumber ? " (سریال: {$serialNumber})" : '')
                    . ($invoiceNumber ? " - شماره فاکتور: {$invoiceNumber}" : ''),
            ]);

            $invoiceSummary = $invoiceAmount !== null ? ' - مبلغ فاکتور: ' . number_format((float) $invoiceAmount) . ' تومان' : '';
            $serialSummary = $serialNumber ? "، شماره سریال: {$serialNumber}" : '';
            $customer->histories()->create([
                'user_id' => $userId,
                'action' => 'part_assigned',
                'description' => "دستگاه «{$lockedPart->name}» (تعداد: {$quantity} عدد{$serialSummary}{$invoiceSummary}) به مشتری تخصیص داده شد.",
                'metadata' => [
                    'part_id' => $lockedPart->id,
                    'part_name' => $lockedPart->name,
                    'serial_number' => $serialNumber,
                    'quantity' => $quantity,
                    'invoice_amount' => $invoiceAmount,
                    'invoice_number' => $invoiceNumber,
                    'warranty_expire_date' => $warrantyExpire->toDateString(),
                ],
            ]);

            if ($customer->customer_type === 'potential') {
                $customer->update(['customer_type' => 'effective']);
                $customer->histories()->create([
                    'user_id' => $userId,
                    'action' => 'type_converted',
                    'description' => "وضعیت مشتری به دلیل تحویل دستگاه فیزیکی (سریال {$serialNumber}) از «بالقوه» به «بالفعل» ارتقا یافت.",
                    'metadata' => [
                        'previous_type' => 'potential',
                        'new_type' => 'effective',
                        'triggered_by_serial' => $serialNumber,
                    ],
                ]);
            }

            return $customerPart->load(['part', 'serviceHistories.performedBy']);
        });
    }

    /**
     * Update an assigned customer device (including part change, quantity adjustment, invoice details, serial, dates)
     * and reconcile inventory stock & audit logs atomically inside a DB transaction.
     */
    public function updateAssignedPart(
        CustomerPart $customerPart,
        array $attributes,
        ?int $userId = null
    ): CustomerPart {
        return DB::transaction(function () use ($customerPart, $attributes, $userId) {
            /** @var CustomerPart $lockedCp */
            $lockedCp = CustomerPart::whereKey($customerPart->id)->lockForUpdate()->firstOrFail();
            $customer = Customer::findOrFail($lockedCp->customer_id);

            $oldPartId = (int) $lockedCp->part_id;
            $newPartId = isset($attributes['part_id']) ? (int) $attributes['part_id'] : $oldPartId;

            $oldQty = max(1, (int) ($lockedCp->quantity ?: 1));
            $newQty = isset($attributes['quantity']) ? max(1, (int) $attributes['quantity']) : $oldQty;

            $newSerial = array_key_exists('serial_number', $attributes)
                ? (!empty($attributes['serial_number']) ? trim((string) $attributes['serial_number']) : null)
                : $lockedCp->serial_number;

            if ($newSerial !== null && $newSerial !== $lockedCp->serial_number) {
                if (CustomerPart::where('serial_number', $newSerial)->where('id', '!=', $lockedCp->id)->lockForUpdate()->exists()) {
                    throw ValidationException::withMessages([
                        'serial_number' => ["شماره سریال {$newSerial} قبلاً برای دستگاه دیگری ثبت شده است."],
                    ]);
                }
            }

            if ($newPartId !== $oldPartId) {
                $firstId = min($oldPartId, $newPartId);
                $secondId = max($oldPartId, $newPartId);
                $firstPart = Part::whereKey($firstId)->lockForUpdate()->firstOrFail();
                $secondPart = Part::whereKey($secondId)->lockForUpdate()->firstOrFail();

                $oldPart = $oldPartId === $firstId ? $firstPart : $secondPart;
                $newPart = $newPartId === $firstId ? $firstPart : $secondPart;

                $oldBefore = (int) $oldPart->stock_quantity;
                $restoredBalance = $oldBefore + $oldQty;
                $oldPart->update(['stock_quantity' => $restoredBalance]);

                PartInventoryLog::create([
                    'part_id' => $oldPart->id,
                    'customer_part_id' => $lockedCp->id,
                    'customer_id' => $customer->id,
                    'user_id' => $userId,
                    'type' => PartInventoryLog::TYPE_RETURN,
                    'quantity' => $oldQty,
                    'balance_before' => $oldBefore,
                    'balance_after' => $restoredBalance,
                    'description' => "بازگشت به انبار به دلیل تغییر مدل دستگاه تخصیص‌یافته مشتری «{$customer->display_name}»",
                ]);

                $newBefore = (int) $newPart->stock_quantity;
                if ($newBefore < $newQty) {
                    throw ValidationException::withMessages([
                        'quantity' => [
                            "موجودی انبار برای دستگاه «{$newPart->name}» کافی نیست (موجودی فعلی: {$newBefore} عدد، تعداد درخواستی: {$newQty} عدد).",
                        ],
                    ]);
                }

                $deductedBalance = $newBefore - $newQty;
                $newPart->update(['stock_quantity' => $deductedBalance]);

                PartInventoryLog::create([
                    'part_id' => $newPart->id,
                    'customer_part_id' => $lockedCp->id,
                    'customer_id' => $customer->id,
                    'user_id' => $userId,
                    'type' => PartInventoryLog::TYPE_OUT_ASSIGN,
                    'quantity' => $newQty,
                    'balance_before' => $newBefore,
                    'balance_after' => $deductedBalance,
                    'description' => "تخصیص جایگزین دستگاه به مشتری «{$customer->display_name}» (سریال: {$newSerial})",
                ]);

                $activePart = $newPart;
            } else {
                /** @var Part $activePart */
                $activePart = Part::whereKey($oldPartId)->lockForUpdate()->firstOrFail();
                $delta = $newQty - $oldQty;
                $beforeBalance = (int) $activePart->stock_quantity;

                if ($delta > 0) {
                    if ($beforeBalance < $delta) {
                        throw ValidationException::withMessages([
                            'quantity' => [
                                "موجودی انبار برای افزایش تعداد دستگاه «{$activePart->name}» کافی نیست (موجودی فعلی انبار: {$beforeBalance} عدد، افزایش درخواستی: {$delta} عدد).",
                            ],
                        ]);
                    }
                    $newBalance = $beforeBalance - $delta;
                    $activePart->update(['stock_quantity' => $newBalance]);

                    PartInventoryLog::create([
                        'part_id' => $activePart->id,
                        'customer_part_id' => $lockedCp->id,
                        'customer_id' => $customer->id,
                        'user_id' => $userId,
                        'type' => PartInventoryLog::TYPE_OUT_ASSIGN,
                        'quantity' => $delta,
                        'balance_before' => $beforeBalance,
                        'balance_after' => $newBalance,
                        'description' => "افزایش تعداد دستگاه تخصیص‌یافته مشتری «{$customer->display_name}» از {$oldQty} به {$newQty} عدد (سریال: {$newSerial})",
                    ]);
                } elseif ($delta < 0) {
                    $returnedQty = abs($delta);
                    $newBalance = $beforeBalance + $returnedQty;
                    $activePart->update(['stock_quantity' => $newBalance]);

                    PartInventoryLog::create([
                        'part_id' => $activePart->id,
                        'customer_part_id' => $lockedCp->id,
                        'customer_id' => $customer->id,
                        'user_id' => $userId,
                        'type' => PartInventoryLog::TYPE_RETURN,
                        'quantity' => $returnedQty,
                        'balance_before' => $beforeBalance,
                        'balance_after' => $newBalance,
                        'description' => "بازگشت به انبار بابت کاهش تعداد دستگاه مشتری «{$customer->display_name}» از {$oldQty} به {$newQty} عدد (سریال: {$newSerial})",
                    ]);
                }
            }

            $installDate = array_key_exists('installation_date', $attributes)
                ? (!empty($attributes['installation_date']) ? Carbon::parse($attributes['installation_date']) : null)
                : ($lockedCp->installation_date ? Carbon::parse($lockedCp->installation_date) : null);

            $warrantyMonths = $activePart->periodic_service_months ?: 12;
            $warrantyExpire = $installDate
                ? (clone $installDate)->addMonths($warrantyMonths)->toDateString()
                : ($lockedCp->warranty_expire_date?->toDateString());

            $invoiceAmount = array_key_exists('invoice_amount', $attributes)
                ? ($attributes['invoice_amount'] !== '' && $attributes['invoice_amount'] !== null ? (float) $attributes['invoice_amount'] : null)
                : $lockedCp->invoice_amount;

            $invoiceNumber = array_key_exists('invoice_number', $attributes)
                ? ($attributes['invoice_number'] !== null && trim((string) $attributes['invoice_number']) !== '' ? trim((string) $attributes['invoice_number']) : null)
                : $lockedCp->invoice_number;

            $lockedCp->update([
                'part_id' => $newPartId,
                'serial_number' => $newSerial,
                'quantity' => $newQty,
                'invoice_amount' => $invoiceAmount,
                'invoice_number' => $invoiceNumber,
                'installation_date' => $installDate?->toDateString(),
                'warranty_expire_date' => $warrantyExpire,
                'status' => $attributes['status'] ?? $lockedCp->status,
                'notes' => array_key_exists('notes', $attributes) ? $attributes['notes'] : $lockedCp->notes,
            ]);

            $customer->histories()->create([
                'user_id' => $userId,
                'action' => 'part_updated',
                'description' => "اطلاعات دستگاه تخصیص‌یافته «{$activePart->name}» (سریال: {$newSerial}، تعداد: {$newQty} عدد) ویرایش شد.",
                'metadata' => [
                    'customer_part_id' => $lockedCp->id,
                    'part_id' => $activePart->id,
                    'serial_number' => $newSerial,
                    'quantity' => $newQty,
                    'invoice_amount' => $invoiceAmount,
                    'invoice_number' => $invoiceNumber,
                ],
            ]);

            return $lockedCp->fresh(['part', 'serviceHistories.performedBy']);
        });
    }

    /**
     * Delete an assigned customer device and atomically return its quantity back to warehouse stock.
     */
    public function deleteAssignedPart(CustomerPart $customerPart, ?int $userId = null): void
    {
        DB::transaction(function () use ($customerPart, $userId) {
            /** @var CustomerPart $lockedCp */
            $lockedCp = CustomerPart::whereKey($customerPart->id)->lockForUpdate()->firstOrFail();
            $customer = Customer::find($lockedCp->customer_id);
            /** @var Part $lockedPart */
            $lockedPart = Part::whereKey($lockedCp->part_id)->lockForUpdate()->firstOrFail();

            $qty = max(1, (int) ($lockedCp->quantity ?: 1));
            $serial = $lockedCp->serial_number;
            $beforeBalance = (int) $lockedPart->stock_quantity;
            $newBalance = $beforeBalance + $qty;

            $lockedPart->update(['stock_quantity' => $newBalance]);

            PartInventoryLog::create([
                'part_id' => $lockedPart->id,
                'customer_part_id' => null,
                'customer_id' => $customer?->id,
                'user_id' => $userId,
                'type' => PartInventoryLog::TYPE_RETURN,
                'quantity' => $qty,
                'balance_before' => $beforeBalance,
                'balance_after' => $newBalance,
                'description' => "بازگشت به انبار به دلیل حذف دستگاه تخصیص‌یافته مشتری «" . ($customer?->display_name ?? 'نامشخص') . "» (سریال: {$serial})",
            ]);

            if ($customer) {
                $customer->histories()->create([
                    'user_id' => $userId,
                    'action' => 'part_deleted',
                    'description' => "تخصیص دستگاه «{$lockedPart->name}» (سریال: {$serial}، تعداد: {$qty} عدد) حذف شد و موجودی به انبار بازگشت.",
                    'metadata' => [
                        'part_id' => $lockedPart->id,
                        'part_name' => $lockedPart->name,
                        'serial_number' => $serial,
                        'returned_quantity' => $qty,
                    ],
                ]);
            }

            $lockedCp->delete();
        });
    }

    /**
     * Manual warehouse stock entry (in) or exit (out_manual / return) wrapped in a DB transaction.
     */
    public function adjustStock(
        Part $part,
        string $type,
        int $quantity,
        ?string $description = null,
        ?int $userId = null,
        ?int $customerId = null
    ): PartInventoryLog {
        if ($quantity < 1) {
            throw ValidationException::withMessages([
                'quantity' => ['تعداد وارد شده برای عملیات انبار باید حداقل ۱ عدد باشد.'],
            ]);
        }

        return DB::transaction(function () use ($part, $type, $quantity, $description, $userId, $customerId) {
            /** @var Part $lockedPart */
            $lockedPart = Part::whereKey($part->id)->lockForUpdate()->firstOrFail();
            $currentStock = (int) $lockedPart->stock_quantity;

            if ($type === PartInventoryLog::TYPE_OUT_MANUAL) {
                if ($currentStock < $quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => [
                            "موجودی انبار برای خروج کالا کافی نیست (موجودی فعلی «{$lockedPart->name}»: {$currentStock} عدد، خروج درخواستی: {$quantity} عدد).",
                        ],
                    ]);
                }
                $newBalance = $currentStock - $quantity;
            } else {
                $newBalance = $currentStock + $quantity;
            }

            $lockedPart->update(['stock_quantity' => $newBalance]);

            return PartInventoryLog::create([
                'part_id' => $lockedPart->id,
                'customer_part_id' => null,
                'customer_id' => $customerId,
                'user_id' => $userId,
                'type' => $type,
                'quantity' => $quantity,
                'balance_before' => $currentStock,
                'balance_after' => $newBalance,
                'description' => $description ?: ($type === PartInventoryLog::TYPE_OUT_MANUAL
                    ? 'ثبت خروج دستی کالا از انبار'
                    : 'ثبت ورود کالا به انبار'),
            ])->load(['part', 'user', 'customer']);
        });
    }

    /**
     * Record repair/service history on an assigned customer device.
     */
    public function recordServiceHistory(
        CustomerPart $customerPart,
        array $data,
        ?int $userId = null
    ): PartServiceHistory {
        return DB::transaction(function () use ($customerPart, $data, $userId) {
            $serviceDate = !empty($data['service_date'])
                ? Carbon::parse($data['service_date'])
                : Carbon::now();

            $history = $customerPart->serviceHistories()->create([
                'performed_by_user_id' => $userId,
                'service_date' => $serviceDate->toDateString(),
                'service_type' => $data['service_type'] ?? 'periodic',
                'description' => $data['description'],
                'cost' => $data['cost'] ?? null,
            ]);

            $customer = $customerPart->customer;
            if ($customer) {
                $customer->histories()->create([
                    'user_id' => $userId,
                    'action' => 'service_performed',
                    'description' => "اقدام سرویس/تعمیر برای دستگاه «{$customerPart->part?->name}» (سریال {$customerPart->serial_number}) ثبت گردید.",
                    'metadata' => [
                        'service_history_id' => $history->id,
                        'service_type' => $history->service_type,
                        'cost' => $history->cost,
                    ],
                ]);
            }

            return $history;
        });
    }
}
