<?php

namespace App\Services\Sales;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Invoice;
use App\Models\Part;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Setting;
use App\Models\User;
use App\Services\Customers\CustomerService;
use App\Services\Sms\MelipayamakService;
use App\Support\JalaliDate;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class SaleService
{
    public function __construct(protected MelipayamakService $melipayamakService)
    {
    }

    public function defaultTaxPercent(): float
    {
        $raw = Setting::get('sales_default_tax_percent', '10');
        $val = is_numeric($raw) ? (float) $raw : 10.0;

        return max(0.0, min(100.0, $val));
    }

    /**
     * Automatically create a Sale + SaleItem inside the part-assignment transaction.
     */
    public function createFromAssignment(
        CustomerPart $customerPart,
        Customer $customer,
        Part $part,
        array $attributes = [],
        ?int $userId = null
    ): Sale {
        $qty = max(1, (int) ($customerPart->quantity ?? 1));
        $hasExplicitUnitPrice = array_key_exists('unit_price', $attributes)
            && $attributes['unit_price'] !== null
            && $attributes['unit_price'] !== '';
        $hasInvoiceAmount = array_key_exists('invoice_amount', $attributes)
            && $attributes['invoice_amount'] !== null
            && $attributes['invoice_amount'] !== '';

        if ($hasExplicitUnitPrice) {
            $unitPrice = max(0, (int) round((float) $attributes['unit_price']));
            $taxPercent = array_key_exists('tax_percent', $attributes) && $attributes['tax_percent'] !== null && $attributes['tax_percent'] !== ''
                ? max(0.0, min(100.0, (float) $attributes['tax_percent']))
                : $this->defaultTaxPercent();
        } elseif ($hasInvoiceAmount) {
            $invoiceAmount = max(0, (int) round((float) $attributes['invoice_amount']));
            $unitPrice = (int) round($invoiceAmount / $qty);
            $taxPercent = array_key_exists('tax_percent', $attributes) && $attributes['tax_percent'] !== null && $attributes['tax_percent'] !== ''
                ? max(0.0, min(100.0, (float) $attributes['tax_percent']))
                : 0.0;
        } else {
            $unitPrice = max(0, (int) ($part->unit_price ?? 0));
            $taxPercent = array_key_exists('tax_percent', $attributes) && $attributes['tax_percent'] !== null && $attributes['tax_percent'] !== ''
                ? max(0.0, min(100.0, (float) $attributes['tax_percent']))
                : $this->defaultTaxPercent();
        }

        $itemDiscount = max(0, (int) round((float) ($attributes['item_discount_amount'] ?? 0)));
        $saleDiscount = max(0, (int) round((float) ($attributes['discount_amount'] ?? 0)));

        $saleDate = !empty($attributes['sale_date'])
            ? Carbon::parse($attributes['sale_date'])->toDateString()
            : ($customerPart->installation_date
                ? Carbon::parse($customerPart->installation_date)->toDateString()
                : now()->toDateString());

        $status = $attributes['sale_status'] ?? $attributes['status_sale'] ?? Sale::STATUS_CONFIRMED;
        if (!in_array($status, [Sale::STATUS_DRAFT, Sale::STATUS_CONFIRMED, Sale::STATUS_CANCELLED], true)) {
            $status = Sale::STATUS_CONFIRMED;
        }

        $paymentStatus = $attributes['payment_status'] ?? Sale::PAYMENT_UNPAID;
        if (!in_array($paymentStatus, [Sale::PAYMENT_UNPAID, Sale::PAYMENT_PARTIAL, Sale::PAYMENT_PAID], true)) {
            $paymentStatus = Sale::PAYMENT_UNPAID;
        }

        $sale = Sale::create([
            'customer_id' => $customer->id,
            'user_id' => $attributes['user_id'] ?? $userId ?? $customer->created_by_user_id,
            'sale_date' => $saleDate,
            'status' => $status,
            'payment_status' => $paymentStatus,
            'subtotal' => 0,
            'discount_amount' => $saleDiscount,
            'tax_percent' => $taxPercent,
            'tax_amount' => 0,
            'total' => 0,
            'paid_amount' => isset($attributes['paid_amount']) && $attributes['paid_amount'] !== null && $attributes['paid_amount'] !== ''
                ? max(0, (int) round((float) $attributes['paid_amount']))
                : 0,
            'notes' => $attributes['sale_notes'] ?? $attributes['notes'] ?? null,
        ]);

        $lineTotal = max(0, ($qty * $unitPrice) - $itemDiscount);

        SaleItem::create([
            'sale_id' => $sale->id,
            'part_id' => $part->id,
            'customer_part_id' => $customerPart->id,
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'discount_amount' => $itemDiscount,
            'line_total' => $lineTotal,
        ]);

        $explicitPaid = array_key_exists('paid_amount', $attributes)
            && $attributes['paid_amount'] !== null
            && $attributes['paid_amount'] !== '';

        $this->recalculateTotals($sale, $paymentStatus, $explicitPaid);

        if (!$hasInvoiceAmount && $sale->total > 0) {
            $customerPart->update(['invoice_amount' => $sale->total]);
        }

        if (!empty($customerPart->invoice_number)) {
            $invNo = trim((string) $customerPart->invoice_number);
            if (!Invoice::where('number', $invNo)->exists()) {
                [$jy] = JalaliDate::gregorianToJalali(
                    (int) Carbon::parse($saleDate)->year,
                    (int) Carbon::parse($saleDate)->month,
                    (int) Carbon::parse($saleDate)->day
                );
                $seq = (int) (Invoice::where('jalali_year', $jy)->max('sequence_number') ?? 0) + 1;
                Invoice::create([
                    'sale_id' => $sale->id,
                    'number' => $invNo,
                    'jalali_year' => $jy,
                    'sequence_number' => $seq,
                    'issued_at' => $saleDate,
                    'status' => $sale->payment_status === Sale::PAYMENT_PAID ? Invoice::STATUS_PAID : Invoice::STATUS_ISSUED,
                    'created_by_user_id' => $userId,
                ]);
            }
        }

        if (!empty($attributes['send_sms']) && $sale->status === Sale::STATUS_CONFIRMED) {
            $this->sendSaleConfirmationSms($sale);
        }

        return $sale->fresh(['customer', 'seller', 'items.part', 'items.customerPart', 'activeInvoice']);
    }

    /**
     * Create a manual sale via the Sales modal, routing through CustomerService::assignPart()
     * so warehouse stock, customer_parts, and customer status conversion remain strictly synchronized.
     */
    public function createManualSale(array $validated, User $actor): Sale
    {
        $customer = Customer::findOrFail($validated['customer_id']);
        $part = Part::findOrFail($validated['part_id']);

        /** @var CustomerService $customerService */
        $customerService = app(CustomerService::class);

        $cpAttributes = [
            'quantity' => $validated['quantity'] ?? 1,
            'serial_number' => $validated['serial_number'] ?? null,
            'installation_date' => $validated['sale_date'] ?? now()->toDateString(),
            'unit_price' => $validated['unit_price'] ?? $part->unit_price ?? 0,
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'tax_percent' => $validated['tax_percent'] ?? $this->defaultTaxPercent(),
            'sale_date' => $validated['sale_date'] ?? now()->toDateString(),
            'sale_status' => $validated['status'] ?? Sale::STATUS_CONFIRMED,
            'payment_status' => $validated['payment_status'] ?? Sale::PAYMENT_UNPAID,
            'paid_amount' => $validated['paid_amount'] ?? null,
            'user_id' => $validated['user_id'] ?? $actor->id,
            'notes' => $validated['notes'] ?? null,
            'send_sms' => $validated['send_sms'] ?? false,
        ];

        $customerPart = $customerService->assignPart(
            $customer,
            $part,
            $validated['serial_number'] ?? null,
            $cpAttributes,
            $actor->id
        );

        $sale = Sale::whereHas('items', fn ($q) => $q->where('customer_part_id', $customerPart->id))
            ->firstOrFail();

        return $sale->load(['customer', 'seller', 'items.part', 'items.customerPart', 'activeInvoice']);
    }

    public function updateSale(Sale $sale, array $validated, User $actor): Sale
    {
        if ($sale->trashed() || $sale->status === Sale::STATUS_CANCELLED) {
            throw ValidationException::withMessages([
                'status' => ['امکان ویرایش فروش لغوشده وجود ندارد.'],
            ]);
        }

        return DB::transaction(function () use ($sale, $validated, $actor) {
            /** @var Sale $lockedSale */
            $lockedSale = Sale::with(['items.customerPart', 'customer'])->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('unit_price', $validated) || array_key_exists('item_discount_amount', $validated)) {
                $firstItem = $lockedSale->items->first();
                if ($firstItem) {
                    $newUnitPrice = array_key_exists('unit_price', $validated) && $validated['unit_price'] !== null
                        ? max(0, (int) round((float) $validated['unit_price']))
                        : $firstItem->unit_price;
                    $newItemDiscount = array_key_exists('item_discount_amount', $validated) && $validated['item_discount_amount'] !== null
                        ? max(0, (int) round((float) $validated['item_discount_amount']))
                        : $firstItem->discount_amount;

                    $firstItem->update([
                        'unit_price' => $newUnitPrice,
                        'discount_amount' => $newItemDiscount,
                        'line_total' => max(0, ($firstItem->quantity * $newUnitPrice) - $newItemDiscount),
                    ]);
                }
            }

            if (!empty($validated['items']) && is_array($validated['items'])) {
                foreach ($validated['items'] as $itemPayload) {
                    if (empty($itemPayload['id'])) {
                        continue;
                    }
                    $item = $lockedSale->items->firstWhere('id', (int) $itemPayload['id']);
                    if (!$item) {
                        continue;
                    }
                    $uPrice = array_key_exists('unit_price', $itemPayload)
                        ? max(0, (int) round((float) $itemPayload['unit_price']))
                        : $item->unit_price;
                    $iDisc = array_key_exists('discount_amount', $itemPayload)
                        ? max(0, (int) round((float) $itemPayload['discount_amount']))
                        : $item->discount_amount;
                    $item->update([
                        'unit_price' => $uPrice,
                        'discount_amount' => $iDisc,
                        'line_total' => max(0, ($item->quantity * $uPrice) - $iDisc),
                    ]);
                }
            }

            $updateFields = [];
            foreach (['sale_date', 'status', 'notes'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $updateFields[$field] = $validated[$field];
                }
            }
            if (array_key_exists('discount_amount', $validated) && $validated['discount_amount'] !== null) {
                $updateFields['discount_amount'] = max(0, (int) round((float) $validated['discount_amount']));
            }
            if (array_key_exists('tax_percent', $validated) && $validated['tax_percent'] !== null) {
                $updateFields['tax_percent'] = max(0.0, min(100.0, (float) $validated['tax_percent']));
            }
            if (array_key_exists('user_id', $validated) && $validated['user_id']) {
                $updateFields['user_id'] = (int) $validated['user_id'];
            }
            $explicitPaid = array_key_exists('paid_amount', $validated) && $validated['paid_amount'] !== null;
            if ($explicitPaid) {
                $updateFields['paid_amount'] = max(0, (int) round((float) $validated['paid_amount']));
            }
            if (array_key_exists('payment_status', $validated) && $validated['payment_status']) {
                $updateFields['payment_status'] = $validated['payment_status'];
            }

            if (!empty($updateFields)) {
                $lockedSale->update($updateFields);
            }

            $this->recalculateTotals(
                $lockedSale,
                $validated['payment_status'] ?? null,
                $explicitPaid
            );

            // Sync linked customer_parts invoice_amount so Device & Sales views match
            $lockedSale->load('items.customerPart');
            $linkedParts = $lockedSale->items->pluck('customerPart')->filter();
            if ($linkedParts->count() === 1) {
                $linkedParts->first()->update(['invoice_amount' => $lockedSale->total]);
            }

            // Keep active invoice payment status aligned
            if ($lockedSale->payment_status === Sale::PAYMENT_PAID) {
                $lockedSale->activeInvoice()->update(['status' => Invoice::STATUS_PAID]);
            } elseif ($lockedSale->activeInvoice && $lockedSale->activeInvoice->status === Invoice::STATUS_PAID) {
                $lockedSale->activeInvoice()->update(['status' => Invoice::STATUS_ISSUED]);
            }

            if ($lockedSale->customer) {
                $lockedSale->customer->histories()->create([
                    'user_id' => $actor->id,
                    'action' => 'sale_updated',
                    'description' => "اطلاعات فروش شماره #{$lockedSale->id} (مبلغ نهایی: " . number_format($lockedSale->total) . ' تومان) بروزرسانی شد.',
                    'metadata' => [
                        'sale_id' => $lockedSale->id,
                        'total' => $lockedSale->total,
                        'status' => $lockedSale->status,
                        'payment_status' => $lockedSale->payment_status,
                    ],
                ]);
            }

            if (!empty($validated['send_sms']) && $lockedSale->status === Sale::STATUS_CONFIRMED) {
                $this->sendSaleConfirmationSms($lockedSale);
            }

            return $lockedSale->fresh(['customer', 'seller', 'items.part', 'items.customerPart', 'activeInvoice', 'invoices']);
        });
    }

    public function cancelSale(Sale $sale, User $actor): Sale
    {
        return DB::transaction(function () use ($sale, $actor) {
            /** @var Sale $lockedSale */
            $lockedSale = Sale::with(['customer', 'activeInvoice'])->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            $lockedSale->update([
                'status' => Sale::STATUS_CANCELLED,
            ]);

            if ($lockedSale->activeInvoice) {
                $lockedSale->activeInvoice->update(['status' => Invoice::STATUS_VOID]);
            }

            if ($lockedSale->customer) {
                $lockedSale->customer->histories()->create([
                    'user_id' => $actor->id,
                    'action' => 'sale_cancelled',
                    'description' => "رکورد فروش شماره #{$lockedSale->id} لغو گردید.",
                    'metadata' => [
                        'sale_id' => $lockedSale->id,
                    ],
                ]);
            }

            $lockedSale->delete();

            return $lockedSale;
        });
    }

    public function recalculateTotals(Sale $sale, ?string $requestedPaymentStatus = null, bool $explicitPaid = false): Sale
    {
        $sale->load('items');

        $subtotal = 0;
        foreach ($sale->items as $item) {
            $lineTotal = max(0, ($item->quantity * $item->unit_price) - $item->discount_amount);
            if ((int) $item->line_total !== $lineTotal) {
                $item->update(['line_total' => $lineTotal]);
            }
            $subtotal += $lineTotal;
        }

        $discountAmount = min($subtotal, max(0, (int) $sale->discount_amount));
        $taxable = max(0, $subtotal - $discountAmount);
        $taxPercent = max(0.0, min(100.0, (float) $sale->tax_percent));
        $taxAmount = (int) round($taxable * ($taxPercent / 100));
        $total = max(0, $taxable + $taxAmount);

        $paidAmount = max(0, (int) $sale->paid_amount);
        $paymentStatus = $requestedPaymentStatus ?? $sale->payment_status;

        if ($requestedPaymentStatus === Sale::PAYMENT_PAID && !$explicitPaid) {
            $paidAmount = $total;
        } elseif ($requestedPaymentStatus === Sale::PAYMENT_UNPAID && !$explicitPaid) {
            $paidAmount = 0;
        } elseif ($explicitPaid) {
            $paidAmount = min($paidAmount, $total);
            if ($total > 0 && $paidAmount >= $total) {
                $paymentStatus = Sale::PAYMENT_PAID;
            } elseif ($paidAmount > 0) {
                $paymentStatus = Sale::PAYMENT_PARTIAL;
            } else {
                $paymentStatus = Sale::PAYMENT_UNPAID;
            }
        } else {
            if ($paidAmount > $total) {
                $paidAmount = $total;
            }
            if ($total > 0 && $paidAmount >= $total) {
                $paymentStatus = Sale::PAYMENT_PAID;
            } elseif ($paidAmount > 0) {
                $paymentStatus = Sale::PAYMENT_PARTIAL;
            }
        }

        $sale->update([
            'subtotal' => $subtotal,
            'discount_amount' => $discountAmount,
            'tax_percent' => $taxPercent,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'paid_amount' => $paidAmount,
            'payment_status' => $paymentStatus,
        ]);

        return $sale->fresh();
    }

    public function sendSaleConfirmationSms(Sale $sale): ?array
    {
        $patternId = trim((string) Setting::get('sales_sms_pattern_id', ''));
        if ($patternId === '') {
            return null;
        }

        $sale->loadMissing('customer');
        $mobile = $sale->customer?->mobile;
        if (!$mobile) {
            return null;
        }

        try {
            $customerName = $sale->customer->display_name ?: 'مشتری گرامی';
            $amountStr = number_format((int) $sale->total);
            $dateStr = JalaliDate::format($sale->sale_date);

            return $this->melipayamakService->sendPattern(
                $mobile,
                $patternId,
                [$customerName, $amountStr, $dateStr],
                $sale->customer
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to send post-sale SMS', [
                'sale_id' => $sale->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
