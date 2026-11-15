import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Calculator, MessageSquare, PackageCheck } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { SearchableSelect } from '../ui/SearchableSelect'
import { DatePicker } from '../ui/DatePicker'
import { customerApi, partApi } from '../../services/api'
import { salesApi, salesSettingsApi } from '../../services/sales'
import { useAuthStore } from '../../store/useAuthStore'
import {
  formatNumericInput,
  localTodayYmd,
  num,
  toEnDigits,
  toman,
} from '../../utils/format'
import type { PaymentStatus, Sale } from '../../types/sales'

interface Props {
  open: boolean
  onClose: () => void
  editingSale?: Sale | null
  defaultCustomerId?: number | string
  onSuccess?: (sale: Sale) => void
}

export function SaleFormModal({
  open,
  onClose,
  editingSale,
  defaultCustomerId,
  onSuccess,
}: Props) {
  if (!open) return null
  return (
    <SaleFormModalContent
      key={`${editingSale?.id ?? 'new'}-${defaultCustomerId ?? ''}`}
      open={open}
      onClose={onClose}
      editingSale={editingSale}
      defaultCustomerId={defaultCustomerId}
      onSuccess={onSuccess}
    />
  )
}

function SaleFormModalContent({
  open,
  onClose,
  editingSale,
  defaultCustomerId,
  onSuccess,
}: Props) {
  const qc = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManageSales = hasPermission('sales.manage')
  const isEdit = Boolean(editingSale)
  const firstEditItem = editingSale?.items?.[0]

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => customerApi.lookup(),
    enabled: open && !isEdit,
  })

  const { data: parts = [] } = useQuery({
    queryKey: ['parts-catalog'],
    queryFn: () => partApi.list(),
    enabled: open && !isEdit,
  })

  const { data: sellers = [] } = useQuery({
    queryKey: ['sales-seller-options'],
    queryFn: salesApi.sellerOptions,
    enabled: open && canManageSales,
  })

  const { data: salesSettings } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: salesSettingsApi.get,
    enabled: open,
  })

  const firstActive = useMemo(
    () => parts.find((p) => p.is_active && (p.stock_quantity ?? 0) > 0) ?? parts[0],
    [parts],
  )

  const [customerId, setCustomerId] = useState(() =>
    editingSale ? String(editingSale.customer_id) : defaultCustomerId ? String(defaultCustomerId) : '',
  )
  const [partIdDraft, setPartIdDraft] = useState<string | null>(() =>
    editingSale ? (firstEditItem ? String(firstEditItem.part_id) : '') : null,
  )
  const [quantity, setQuantity] = useState(() =>
    editingSale ? String(firstEditItem?.quantity ?? 1) : '1',
  )
  const [serialNumber, setSerialNumber] = useState(() =>
    editingSale ? (firstEditItem?.customer_part?.serial_number ?? '') : '',
  )
  const [unitPriceDraft, setUnitPriceDraft] = useState<string | null>(() =>
    editingSale ? formatNumericInput(String(firstEditItem?.unit_price ?? 0)) : null,
  )
  const [discountAmount, setDiscountAmount] = useState(() =>
    editingSale ? formatNumericInput(String(editingSale.discount_amount ?? 0)) : '0',
  )
  const [taxPercentDraft, setTaxPercentDraft] = useState<string | null>(() =>
    editingSale ? String(editingSale.tax_percent ?? 0) : null,
  )
  const [saleDate, setSaleDate] = useState(() =>
    editingSale?.sale_date ? editingSale.sale_date.slice(0, 10) : localTodayYmd(),
  )
  const [status, setStatus] = useState<'draft' | 'confirmed'>(() =>
    editingSale?.status === 'draft' ? 'draft' : 'confirmed',
  )
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() =>
    editingSale ? editingSale.payment_status : 'unpaid',
  )
  const [paidAmount, setPaidAmount] = useState(() =>
    editingSale ? formatNumericInput(String(editingSale.paid_amount ?? 0)) : '0',
  )
  const [sellerId, setSellerId] = useState(() =>
    editingSale?.user_id ? String(editingSale.user_id) : '',
  )
  const [notes, setNotes] = useState(() => (editingSale?.notes ?? ''))
  const [sendSms, setSendSms] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const partId = partIdDraft ?? (firstActive ? String(firstActive.id) : '')
  const unitPrice =
    unitPriceDraft ?? (firstActive?.unit_price ? formatNumericInput(String(firstActive.unit_price)) : '0')
  const taxPercent = taxPercentDraft ?? String(salesSettings?.sales_default_tax_percent ?? 10)
  const setPartId = (val: string) => setPartIdDraft(val)
  const setUnitPrice = (val: string) => setUnitPriceDraft(val)
  const setTaxPercent = (val: string) => setTaxPercentDraft(val)

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: c.display_name,
        hint: c.mobile || undefined,
      })),
    [customers],
  )

  const partOptions = useMemo(
    () =>
      parts
        .filter((p) => p.is_active)
        .map((p) => ({
          value: String(p.id),
          label: `${p.name} (${p.code})`,
          hint: `موجودی: ${num(p.stock_quantity ?? 0)} ${p.unit || 'دستگاه'} • قیمت پایه: ${toman(p.unit_price ?? 0)}`,
        })),
    [parts],
  )

  const selectedPart = useMemo(
    () => parts.find((p) => String(p.id) === partId),
    [parts, partId],
  )

  const handlePartChange = (newPartId: string) => {
    setPartId(newPartId)
    const p = parts.find((item) => String(item.id) === newPartId)
    if (p && !isEdit) {
      setUnitPrice(p.unit_price ? formatNumericInput(String(p.unit_price)) : '0')
    }
  }

  const parsedQty = Math.max(1, Number(toEnDigits(quantity || '1')) || 1)
  const parsedUnitPrice = Math.max(
    0,
    Number(toEnDigits(unitPrice || '0').replace(/,/g, '')) || 0,
  )
  const parsedDiscount = Math.max(
    0,
    Number(toEnDigits(discountAmount || '0').replace(/,/g, '')) || 0,
  )
  const parsedTax = Math.min(100, Math.max(0, Number(toEnDigits(taxPercent || '0')) || 0))
  const parsedPaid = Math.max(
    0,
    Number(toEnDigits(paidAmount || '0').replace(/,/g, '')) || 0,
  )

  const subtotal = isEdit && (editingSale?.items?.length ?? 0) > 1
    ? (editingSale?.subtotal ?? 0)
    : parsedQty * parsedUnitPrice
  const effectiveDiscount = Math.min(subtotal, parsedDiscount)
  const taxable = Math.max(0, subtotal - effectiveDiscount)
  const taxAmount = Math.round(taxable * (parsedTax / 100))
  const grandTotal = taxable + taxAmount
  const effectivePaid =
    paymentStatus === 'paid'
      ? grandTotal
      : paymentStatus === 'unpaid'
        ? 0
        : Math.min(grandTotal, parsedPaid)
  const remaining = Math.max(0, grandTotal - effectivePaid)

  const availableStock = selectedPart?.stock_quantity ?? 0
  const insufficientStock = !isEdit && Boolean(selectedPart && parsedQty > availableStock)

  const handlePaymentStatusChange = (next: PaymentStatus) => {
    setPaymentStatus(next)
    if (next === 'paid') {
      setPaidAmount(formatNumericInput(String(grandTotal)))
    } else if (next === 'unpaid') {
      setPaidAmount('0')
    }
  }

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['sales'] })
    qc.invalidateQueries({ queryKey: ['sales-summary'] })
    qc.invalidateQueries({ queryKey: ['sales-charts'] })
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['invoice-summary'] })
    qc.invalidateQueries({ queryKey: ['uninvoiced-sales'] })
    qc.invalidateQueries({ queryKey: ['customer-sales'] })
    qc.invalidateQueries({ queryKey: ['customers'] })
    qc.invalidateQueries({ queryKey: ['parts-catalog'] })
    qc.invalidateQueries({ queryKey: ['inventory-logs'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    if (customerId) {
      qc.invalidateQueries({ queryKey: ['customer', String(customerId)] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEdit) {
      if (!customerId) {
        toast.error('لطفاً مشتری را انتخاب کنید.')
        return
      }
      if (!partId) {
        toast.error('لطفاً مدل دستگاه را انتخاب کنید.')
        return
      }
      if (insufficientStock) {
        toast.error(`موجودی انبار کافی نیست (حداکثر: ${num(availableStock)} عدد).`)
        return
      }
    }

    setSubmitting(true)
    try {
      if (isEdit && editingSale) {
        const res = await salesApi.update(editingSale.id, {
          sale_date: saleDate,
          status,
          payment_status: paymentStatus,
          unit_price: parsedUnitPrice,
          discount_amount: parsedDiscount,
          tax_percent: parsedTax,
          paid_amount: paymentStatus === 'partial' ? parsedPaid : undefined,
          user_id: canManageSales && sellerId ? Number(sellerId) : undefined,
          notes: notes.trim() || null,
          send_sms: sendSms,
        })
        toast.success(res.message)
        invalidateAll()
        onSuccess?.(res.sale)
        onClose()
      } else {
        const res = await salesApi.create({
          customer_id: Number(customerId),
          part_id: Number(partId),
          quantity: parsedQty,
          serial_number: toEnDigits(serialNumber).trim() || null,
          unit_price: parsedUnitPrice,
          discount_amount: parsedDiscount,
          tax_percent: parsedTax,
          sale_date: saleDate,
          status,
          payment_status: paymentStatus,
          paid_amount: paymentStatus === 'partial' ? parsedPaid : undefined,
          user_id: canManageSales && sellerId ? Number(sellerId) : undefined,
          notes: notes.trim() || null,
          send_sms: sendSms,
        })
        toast.success(res.message)
        invalidateAll()
        onSuccess?.(res.sale)
        onClose()
      }
    } catch (err: any) {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      toast.error(firstErr?.[0] || err?.response?.data?.message || 'خطا در ذخیره اطلاعات فروش')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `ویرایش فروش شماره #${num(editingSale!.id)}` : 'ثبت فروش جدید و کسر خودکار از انبار'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            انصراف
          </button>
          <button
            type="submit"
            form="sale-form"
            className="btn btn-primary"
            disabled={submitting || insufficientStock}
          >
            {submitting && <span className="loading loading-spinner loading-xs" />}
            {isEdit ? 'ذخیره تغییرات فروش' : 'ثبت فروش و کسر از انبار'}
          </button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SearchableSelect
              label="مشتری"
              required
              placeholder="جستجو و انتخاب مشتری..."
              searchPlaceholder="نام، شرکت یا موبایل مشتری..."
              value={customerId}
              options={customerOptions}
              onChange={setCustomerId}
            />

            <SearchableSelect
              label="مدل دستگاه / قطعه"
              required
              placeholder="جستجو و انتخاب دستگاه..."
              searchPlaceholder="نام یا کد فنی دستگاه..."
              value={partId}
              options={partOptions}
              onChange={handlePartChange}
            />
          </div>
        )}

        {!isEdit && selectedPart && (
          <div
            className={`flex items-center justify-between rounded-xl border px-3.5 py-2 text-xs ${
              insufficientStock
                ? 'border-error/40 bg-error/10 text-error'
                : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2 font-bold">
              {insufficientStock ? <AlertTriangle className="size-4" /> : <PackageCheck className="size-4" />}
              {insufficientStock
                ? `موجودی انبار کافی نیست! (موجودی فعلی: ${num(availableStock)} عدد)`
                : `موجودی قابل فروش در انبار: ${num(availableStock)} ${selectedPart.unit || 'دستگاه'}`}
            </span>
            <span className="font-semibold">قیمت پایه کاتالوگ: {toman(selectedPart.unit_price ?? 0)}</span>
          </div>
        )}

        {!isEdit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="تعداد" required>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono font-bold"
                value={quantity}
                onChange={(e) => setQuantity(toEnDigits(e.target.value).replace(/\D/g, ''))}
              />
            </Field>
            <Field label="شماره سریال (اختیاری)">
              <input
                dir="ltr"
                className="input input-bordered w-full text-start font-mono"
                placeholder="SN-2026-..."
                value={serialNumber}
                onChange={(e) =>
                  setSerialNumber(toEnDigits(e.target.value).replace(/[^a-zA-Z0-9\-_/]/g, ''))
                }
              />
            </Field>
          </div>
        )}

        {/* Financial Amounts */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="قیمت واحد (تومان)" required>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono font-bold"
              value={unitPrice}
              onChange={(e) => setUnitPrice(formatNumericInput(e.target.value))}
            />
          </Field>

          <Field label="تخفیف (تومان)">
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(formatNumericInput(e.target.value))}
            />
          </Field>

          <Field label="مالیات / ارزش افزوده (٪)">
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono"
              value={taxPercent}
              onChange={(e) =>
                setTaxPercent(toEnDigits(e.target.value).replace(/[^\d.]/g, ''))
              }
            />
          </Field>
        </div>

        {/* Dates & Statuses */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="تاریخ فروش (شمسی)" required>
            <DatePicker
              value={saleDate}
              clearable={false}
              onChange={(val) => setSaleDate(val || localTodayYmd())}
            />
          </Field>

          <Field label="وضعیت سفارش فروش">
            <select
              className="select select-bordered w-full text-xs font-bold"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'confirmed')}
            >
              <option value="confirmed">تایید شده (قطعی)</option>
              <option value="draft">پیش‌نویس</option>
            </select>
          </Field>

          <Field label="وضعیت پرداخت">
            <select
              className="select select-bordered w-full text-xs font-bold"
              value={paymentStatus}
              onChange={(e) => handlePaymentStatusChange(e.target.value as PaymentStatus)}
            >
              <option value="unpaid">پرداخت‌نشده</option>
              <option value="partial">پرداخت جزئی</option>
              <option value="paid">پرداخت کامل</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {paymentStatus === 'partial' && (
            <Field label="مبلغ پرداخت‌شده تاکنون (تومان)">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered w-full text-start font-mono font-bold"
                value={paidAmount}
                onChange={(e) => setPaidAmount(formatNumericInput(e.target.value))}
              />
            </Field>
          )}

          {canManageSales && sellers.length > 0 && (
            <Field label="کارشناس فروش مسئول">
              <select
                className="select select-bordered w-full text-xs"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
              >
                <option value="">کاربر جاری / پیش‌فرض</option>
                {sellers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {/* Live Totals Preview */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
            <Calculator className="size-4" /> محاسبه خودکار مبالغ فروش
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/70">جمع کل اقلام ({num(parsedQty)} عدد):</span>
            <span className="font-bold">{toman(subtotal)}</span>
          </div>
          {effectiveDiscount > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>تخفیف:</span>
              <span className="font-bold">− {toman(effectiveDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-base-content/70">مالیات ({num(parsedTax)}٪):</span>
            <span className="font-bold">{toman(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-primary/15 pt-1.5 text-sm font-extrabold text-base-content">
            <span>مبلغ نهایی قابل پرداخت:</span>
            <span>{toman(grandTotal)}</span>
          </div>
          {remaining > 0 && effectivePaid > 0 && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
              <span>مانده بدهی:</span>
              <span>{toman(remaining)}</span>
            </div>
          )}
        </div>

        <Field label="توضیحات و شرایط فروش">
          <textarea
            rows={2}
            className="textarea textarea-bordered w-full"
            placeholder="شرایط پرداخت، زمان تحویل یا یادداشت مالی..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-base-200 bg-base-200/40 px-3.5 py-2.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={sendSms}
            onChange={(e) => setSendSms(e.target.checked)}
          />
          <MessageSquare className="size-4 text-primary shrink-0" />
          <span>ارسال پیامک تایید فروش به مشتری پس از ثبت (در صورت تنظیم کد الگوی فروش)</span>
        </label>
      </form>
    </Modal>
  )
}
