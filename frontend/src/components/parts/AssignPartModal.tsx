import { useEffect, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { SearchableSelect } from '../ui/SearchableSelect'
import { DatePicker } from '../ui/DatePicker'
import { partApi } from '../../services/api'
import type { Customer, Part } from '../../types'

const schema = z.object({
  part_id: z.string().min(1, 'انتخاب مدل قطعه الزامی است'),
  serial_number: z
    .string()
    .trim()
    .min(3, 'شماره سریال یکتا را وارد کنید')
    .regex(/^[a-zA-Z0-9]+$/, 'شماره سریال فقط می‌تواند شامل حروف انگلیسی و اعداد باشد'),
  installation_date: z.string().min(1, 'تاریخ نصب یا تحویل را انتخاب کنید'),
  notes: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

interface AssignPartModalProps {
  open: boolean
  onClose: () => void
  customer: Customer
  onSuccess: () => void
}

export function AssignPartModal({ open, onClose, customer, onSuccess }: AssignPartModalProps) {
  const { data: parts = [] } = useQuery({
    queryKey: ['parts-catalog'],
    queryFn: () => partApi.list(),
    enabled: open,
  })

  const today = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      part_id: '',
      serial_number: '',
      installation_date: today,
      notes: '',
    },
  })

  const partId = watch('part_id')

  const partOptions = useMemo(() => {
    return parts.map((p) => ({
      value: String(p.id),
      label: `${p.name} (کد: ${p.code})`,
      hint: `دوره سرویس: ${p.periodic_service_months} ماه`,
    }))
  }, [parts])

  useEffect(() => {
    if (open) {
      reset({
        part_id: parts[0]?.id ? String(parts[0].id) : '',
        serial_number: '',
        installation_date: today,
        notes: '',
      })
    }
  }, [open, parts, reset, today])

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await partApi.assignPart(customer.id, {
        part_id: values.part_id,
        serial_number: values.serial_number,
        installation_date: values.installation_date,
        notes: values.notes,
      })
      toast.success(res.message)
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.serial_number?.[0] || 'خطا در تخصیص قطعه'
      toast.error(msg)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`تخصیص قطعه فیزیکی به ${customer.first_name} ${customer.last_name}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </button>
          <button type="submit" form="assign-part-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            تخصیص قطعه و ثبت سریال
          </button>
        </>
      }
    >
      <form id="assign-part-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {customer.customer_type === 'potential' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-start gap-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold">تبدیل خودکار به مشتری بالفعل</p>
              <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                این مشتری در حال حاضر «بالقوه» است. با ثبت این قطعه، وضعیت پرونده او به طور خودکار به «بالفعل» تغییر خواهد یافت.
              </p>
            </div>
          </div>
        )}

        {/* Searchable Select for Parts */}
        <SearchableSelect
          label="انتخاب مدل قطعه از کاتالوگ"
          required
          error={errors.part_id?.message}
          placeholder="جستجو و انتخاب مدل قطعه..."
          searchPlaceholder="جستجوی نام یا کد قطعه..."
          value={partId}
          options={partOptions}
          onChange={(val) => setValue('part_id', val, { shouldValidate: true })}
        />

        <Field label="شناسه یکتای سریال (Serial Number)" required error={errors.serial_number?.message}>
          <input
            dir="ltr"
            className="input input-bordered w-full text-start font-mono"
            placeholder="مثال: SN20268821"
            {...register('serial_number', {
              onChange: (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
              },
            })}
            onKeyDown={(e) => {
              if (
                e.ctrlKey ||
                e.metaKey ||
                ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)
              ) {
                return
              }
              if (!/^[a-zA-Z0-9]$/.test(e.key)) {
                e.preventDefault()
              }
            }}
          />
        </Field>

        <Field label="تاریخ تحویل یا نصب فیزیکی" required error={errors.installation_date?.message}>
          <DatePicker
            value={watch('installation_date')}
            onChange={(val) => setValue('installation_date', val || '', { shouldValidate: true })}
          />
        </Field>

        <Field label="توضیحات و شرایط ضمانت">
          <textarea
            rows={2}
            className="textarea textarea-bordered w-full"
            placeholder="یادداشت‌های محل نصب، نام تکنسین تحویل‌دهنده یا شرایط خاص قطعه..."
            {...register('notes')}
          />
        </Field>
      </form>
    </Modal>
  )
}
