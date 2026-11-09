import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { AlertTriangle, PackageCheck, Receipt, Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { SearchableSelect } from '../ui/SearchableSelect'
import { DatePicker } from '../ui/DatePicker'
import { partApi } from '../../services/api'
import { customerDisplayName, formatNumericInput, num, toEnDigits } from '../../utils/format'
import type { Customer, CustomerPart, CustomerPartStatus } from '../../types'

const schema = z.object({
  part_id: z.string().min(1, 'انتخاب مدل دستگاه الزامی است'),
  serial_number: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[a-zA-Z0-9\-_/]+$/.test(v), {
      message: 'شماره سریال فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد',
    }),
  quantity: z
    .string()
    .min(1, 'تعداد دستگاه الزامی است')
    .refine((v) => {
      const n = Number(toEnDigits(v))
      return Number.isInteger(n) && n >= 1
    }, 'تعداد دستگاه باید حداقل ۱ عدد باشد'),
  invoice_amount: z.string().optional(),
  invoice_number: z.string().trim().optional(),
  installation_date: z.string().min(1, 'تاریخ نصب یا تحویل را انتخاب کنید'),
  status: z.enum(['active', 'under_repair', 'replaced', 'retired']),
  notes: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

interface AssignPartModalProps {
  open: boolean
  onClose: () => void
  customer: Customer
  editingPart?: CustomerPart | null
  onSuccess: () => void
}

export function AssignPartModal({
  open,
  onClose,
  customer,
  editingPart,
  onSuccess,
}: AssignPartModalProps) {
  const isEdit = Boolean(editingPart)

  const { data: parts = [] } = useQuery({
    queryKey: ['parts-catalog'],
    queryFn: () => partApi.list(),
    enabled: open,
  })

  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      part_id: '',
      serial_number: '',
      quantity: '1',
      invoice_amount: '',
      invoice_number: '',
      installation_date: today,
      status: 'active',
      notes: '',
    },
  })

  const partId = useWatch({ control, name: 'part_id' })
  const qtyStr = useWatch({ control, name: 'quantity' })
  const invoiceAmountVal = useWatch({ control, name: 'invoice_amount' })
  const installationDateVal = useWatch({ control, name: 'installation_date' })

  const partOptions = useMemo(() => {
    return parts
      .filter((p) => p.is_active || (editingPart && String(p.id) === String(editingPart.part_id)))
      .map((p) => ({
        value: String(p.id),
        label: `${p.name} (کد: ${p.code})`,
        hint: `موجودی انبار: ${num(p.stock_quantity ?? 0)} عدد • گارانتی: ${num(p.periodic_service_months)} ماه`,
      }))
  }, [parts, editingPart])

  useEffect(() => {
    if (!open) return

    if (editingPart) {
      reset({
        part_id: String(editingPart.part_id),
        serial_number: editingPart.serial_number || '',
        quantity: String(editingPart.quantity ?? 1),
        invoice_amount:
          editingPart.invoice_amount !== null && editingPart.invoice_amount !== undefined
            ? formatNumericInput(String(Math.round(Number(editingPart.invoice_amount))))
            : '',
        invoice_number: editingPart.invoice_number ?? '',
        installation_date: editingPart.installation_date
          ? editingPart.installation_date.slice(0, 10)
          : today,
        status: editingPart.status || 'active',
        notes: editingPart.notes ?? '',
      })
      return
    }

    const firstInStock = parts.find((p) => p.is_active && (p.stock_quantity ?? 0) > 0) ?? parts[0]
    reset({
      part_id: firstInStock?.id ? String(firstInStock.id) : '',
      serial_number: '',
      quantity: '1',
      invoice_amount: '',
      invoice_number: '',
      installation_date: today,
      status: 'active',
      notes: '',
    })
  }, [open, editingPart, parts, reset, today])

  const selectedPart = parts.find((p) => String(p.id) === partId)
  const requestedQty = Math.max(0, Number(toEnDigits(qtyStr || '0')) || 0)
  const availableStock = selectedPart
    ? (selectedPart.stock_quantity ?? 0) +
      (editingPart && String(editingPart.part_id) === String(selectedPart.id)
        ? Number(editingPart.quantity ?? 1)
        : 0)
    : 0
  const insufficientStock = Boolean(selectedPart && requestedQty > availableStock)

  const onSubmit = async (values: FormValues) => {
    const parsedQty = Number(toEnDigits(values.quantity)) || 1
    if (insufficientStock) {
      toast.error(
        `موجودی انبار برای دستگاه انتخابی کافی نیست (حداکثر قابل تخصیص: ${num(availableStock)} عدد).`,
      )
      return
    }

    const rawAmount = toEnDigits(values.invoice_amount || '').replace(/,/g, '').trim()
    const parsedAmount = rawAmount !== '' ? Number(rawAmount) : null
    const cleanInvoiceNo = toEnDigits(values.invoice_number || '').trim() || null
    const cleanSerial = toEnDigits(values.serial_number || '').trim() || undefined

    try {
      if (isEdit && editingPart) {
        const res = await partApi.updateAssignedPart(editingPart.id, {
          part_id: values.part_id,
          serial_number: cleanSerial,
          quantity: parsedQty,
          invoice_amount: parsedAmount,
          invoice_number: cleanInvoiceNo,
          installation_date: values.installation_date || null,
          status: values.status as CustomerPartStatus,
          notes: values.notes?.trim() || null,
        })
        toast.success(res.message)
      } else {
        const res = await partApi.assignPart(customer.id, {
          part_id: values.part_id,
          serial_number: cleanSerial,
          quantity: parsedQty,
          invoice_amount: parsedAmount,
          invoice_number: cleanInvoiceNo,
          installation_date: values.installation_date,
          notes: values.notes?.trim() || undefined,
        })
        toast.success(res.message)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      const msg =
        firstErr?.[0] ||
        err.response?.data?.message ||
        (isEdit ? 'خطا در ویرایش اطلاعات دستگاه' : 'خطا در تخصیص دستگاه')
      toast.error(msg)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        isEdit
          ? `ویرایش دستگاه اختصاص‌یافته به ${customerDisplayName(customer)}`
          : `تخصیص دستگاه به ${customerDisplayName(customer)}`
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </button>
          <button
            type="submit"
            form="assign-part-form"
            className="btn btn-primary"
            disabled={isSubmitting || insufficientStock}
          >
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            {isEdit ? 'ذخیره تغییرات دستگاه' : 'تخصیص دستگاه و کسر از انبار'}
          </button>
        </>
      }
    >
      <form id="assign-part-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {!isEdit && customer.customer_type === 'potential' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-start gap-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold">تبدیل خودکار به مشتری بالفعل و کسر از موجودی انبار</p>
              <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                با ثبت این دستگاه، تعداد انتخابی از موجودی انبار کسر شده و پرونده مشتری به طور خودکار به «مشتری بالفعل» تبدیل می‌شود.
              </p>
            </div>
          </div>
        )}

        {/* Searchable Select for Devices */}
        <SearchableSelect
          label="انتخاب مدل دستگاه از کاتالوگ و انبار"
          required
          error={errors.part_id?.message}
          placeholder="جستجو و انتخاب مدل دستگاه..."
          searchPlaceholder="جستجوی نام یا کد دستگاه..."
          value={partId}
          options={partOptions}
          onChange={(val) => setValue('part_id', val, { shouldValidate: true })}
        />

        {/* Real-time Warehouse Stock Banner */}
        {selectedPart && (
          <div
            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs ${
              insufficientStock
                ? 'border-error/40 bg-error/10 text-error'
                : availableStock === 0
                  ? 'border-warning/40 bg-warning/10 text-warning-content'
                  : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2 font-bold">
              {insufficientStock || availableStock === 0 ? (
                <AlertTriangle className="size-4 shrink-0" />
              ) : (
                <PackageCheck className="size-4 shrink-0" />
              )}
              {insufficientStock
                ? `موجودی انبار کافی نیست! (حداکثر قابل تخصیص: ${num(availableStock)} عدد)`
                : `موجودی قابل تخصیص در انبار: ${num(availableStock)} عدد`}
            </span>
            <span className="text-[11px] opacity-80">
              گارانتی: {num(selectedPart.periodic_service_months)} ماه
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="تعداد دستگاه" required error={errors.quantity?.message}>
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="input input-bordered w-full text-start font-mono font-bold"
              placeholder="1"
              {...register('quantity', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value).replace(/\D/g, '')
                },
              })}
            />
          </Field>

          <Field
            label="شناسه یکتای سریال (Serial Number)"
            hint="اختیاری"
            error={errors.serial_number?.message}
          >
            <input
              dir="ltr"
              className="input input-bordered w-full text-start font-mono"
              placeholder="اختیاری (مثال: SN-2026-8821)"
              {...register('serial_number', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value).replace(/[^a-zA-Z0-9\-_/]/g, '')
                },
              })}
            />
          </Field>
        </div>

        {/* Invoice Amount & Invoice Number */}
        <div className="rounded-xl border border-base-200 bg-base-200/40 p-3.5 space-y-3">
          <p className="text-xs font-bold text-base-content/80 flex items-center gap-1.5">
            <Receipt className="size-4 text-primary" /> مشخصات مالی و فاکتور فروش (اختیاری)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="مبلغ فاکتور (تومان)" hint="تفکیک سه‌رقمی خودکار">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                className="input input-bordered input-sm h-10 w-full text-start font-mono font-bold"
                placeholder="مثال: 25,000,000"
                value={invoiceAmountVal || ''}
                onChange={(e) => setValue('invoice_amount', formatNumericInput(e.target.value))}
              />
            </Field>

            <Field label="شماره فاکتور (اختیاری)">
              <input
                dir="ltr"
                className="input input-bordered input-sm h-10 w-full text-start font-mono"
                placeholder="مثال: INV-1405-108"
                {...register('invoice_number', {
                  onChange: (e) => {
                    e.target.value = toEnDigits(e.target.value)
                  },
                })}
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="تاریخ تحویل یا نصب فیزیکی"
            required
            error={errors.installation_date?.message}
            className={!isEdit ? 'sm:col-span-2' : ''}
          >
            <DatePicker
              value={installationDateVal}
              onChange={(val) => setValue('installation_date', val || '', { shouldValidate: true })}
            />
          </Field>

          {isEdit && (
            <Field label="وضعیت فعلی دستگاه">
              <select className="select select-bordered w-full text-xs" {...register('status')}>
                <option value="active">فعال در محل مشتری</option>
                <option value="under_repair">در دست تعمیر</option>
                <option value="replaced">تعویض شده</option>
                <option value="retired">از رده خارج</option>
              </select>
            </Field>
          )}
        </div>

        <Field label="توضیحات نصب و شرایط ضمانت">
          <textarea
            rows={2}
            className="textarea textarea-bordered w-full"
            placeholder="یادداشت‌های محل نصب، نام نصاب یا شرایط خاص دستگاه..."
            {...register('notes')}
          />
        </Field>
      </form>
    </Modal>
  )
}
