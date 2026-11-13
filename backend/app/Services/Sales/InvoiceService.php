<?php

namespace App\Services\Sales;

use App\Models\Invoice;
use App\Models\Sale;
use App\Models\User;
use App\Support\JalaliDate;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceService
{
    public function generateForSale(Sale $sale, User $actor, ?string $dueAt = null, ?string $notes = null): Invoice
    {
        if ($sale->trashed() || $sale->status === Sale::STATUS_CANCELLED) {
            throw ValidationException::withMessages([
                'sale' => ['برای فروش لغوشده امکان صدور فاکتور وجود ندارد.'],
            ]);
        }

        return DB::transaction(function () use ($sale, $actor, $dueAt, $notes) {
            /** @var Sale $lockedSale */
            $lockedSale = Sale::with(['items.customerPart', 'customer'])->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            $existing = Invoice::where('sale_id', $lockedSale->id)
                ->where('status', '!=', Invoice::STATUS_VOID)
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'invoice' => ["برای این فروش قبلاً فاکتور فعال به شماره {$existing->number} صادر شده است."],
                ]);
            }

            $issuedAt = Carbon::now();
            [$jy] = JalaliDate::gregorianToJalali((int) $issuedAt->year, (int) $issuedAt->month, (int) $issuedAt->day);

            $maxSeq = (int) (Invoice::where('jalali_year', $jy)->lockForUpdate()->max('sequence_number') ?? 0);
            $nextSeq = $maxSeq + 1;
            $number = sprintf('INV-%04d-%04d', $jy, $nextSeq);

            while (Invoice::where('number', $number)->exists()) {
                $nextSeq++;
                $number = sprintf('INV-%04d-%04d', $jy, $nextSeq);
            }

            $status = $lockedSale->payment_status === Sale::PAYMENT_PAID
                ? Invoice::STATUS_PAID
                : Invoice::STATUS_ISSUED;

            $invoice = Invoice::create([
                'sale_id' => $lockedSale->id,
                'number' => $number,
                'jalali_year' => $jy,
                'sequence_number' => $nextSeq,
                'issued_at' => $issuedAt->toDateString(),
                'due_at' => $dueAt ? Carbon::parse($dueAt)->toDateString() : null,
                'status' => $status,
                'notes' => $notes,
                'created_by_user_id' => $actor->id,
            ]);

            foreach ($lockedSale->items as $item) {
                if ($item->customerPart && empty($item->customerPart->invoice_number)) {
                    $item->customerPart->update(['invoice_number' => $invoice->number]);
                }
            }

            if ($lockedSale->customer) {
                $lockedSale->customer->histories()->create([
                    'user_id' => $actor->id,
                    'action' => 'invoice_issued',
                    'description' => "فاکتور رسمی شماره {$invoice->number} برای فروش #{$lockedSale->id} به مبلغ " . number_format($lockedSale->total) . ' تومان صادر شد.',
                    'metadata' => [
                        'invoice_id' => $invoice->id,
                        'invoice_number' => $invoice->number,
                        'sale_id' => $lockedSale->id,
                        'total' => $lockedSale->total,
                    ],
                ]);
            }

            return $invoice->load(['sale.customer', 'sale.seller', 'sale.items.part', 'creator']);
        });
    }

    public function voidInvoice(Invoice $invoice, User $actor): Invoice
    {
        if ($invoice->status === Invoice::STATUS_VOID) {
            return $invoice;
        }

        return DB::transaction(function () use ($invoice, $actor) {
            $invoice->update(['status' => Invoice::STATUS_VOID]);

            $invoice->loadMissing('sale.customer');
            if ($invoice->sale?->customer) {
                $invoice->sale->customer->histories()->create([
                    'user_id' => $actor->id,
                    'action' => 'invoice_voided',
                    'description' => "فاکتور شماره {$invoice->number} باطل گردید.",
                    'metadata' => [
                        'invoice_id' => $invoice->id,
                        'invoice_number' => $invoice->number,
                        'sale_id' => $invoice->sale_id,
                    ],
                ]);
            }

            return $invoice->fresh(['sale.customer', 'sale.seller', 'sale.items.part', 'creator']);
        });
    }
}
