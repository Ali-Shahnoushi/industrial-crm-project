import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { DatePicker } from '../ui/DatePicker'
import { partApi } from '../../services/api'
import { formatNumericInput, toEnDigits } from '../../utils/format'
import type { CustomerPart } from '../../types'

const schema = z.object({
  service_date: z.string().min(1, 'تاریخ سرویس را انتخاب کنید'),
  service_type: z.enum(['periodic', 'repair', 'overhaul']),
  description: z.string().trim().min(5, 'شرح اقدامات سرویس/تعمیر را وارد کنید (حداقل ۵ کاراکتر)'),
  cost: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ServiceHistoryModalProps {
  open: boolean
  onClose: () => void
  customerPart: CustomerPart | null
  onSuccess: () => void
}

export function ServiceHistoryModal({ open, onClose, customerPart, onSuccess }: ServiceHistoryModalProps) {
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
      service_date: today,
      service_type: 'repair',
      description: '',
      cost: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        service_date: today,
        service_type: 'repair',
        description: '',
        cost: '',
      })
    }
  }, [open, reset, today])

  const onSubmit = async (values: FormValues) => {
    if (!customerPart) return
    const rawCost = values.cost ? toEnDigits(values.cost).replace(/,/g, '').trim() : ''
    try {
      const res = await partApi.addServiceHistory(customerPart.id, {
        service_date: values.service_date,
        service_type: values.service_type,
        description: values.description,
        cost: rawCost ? Number(rawCost) : undefined,
      })
      toast.success(res.message)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطا در ثبت سابقه سرویس')
    }
  }

  if (!customerPart) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`ثبت سابقه اقدام/تعمیر دستگاه — سریال ${customerPart.serial_number}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </button>
          <button type="submit" form="service-history-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            ثبت در سوابق دستگاه
          </button>
        </>
      }
    >
      <form id="service-history-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="تاریخ انجام سرویس/تعمیر" required error={errors.service_date?.message}>
            <DatePicker
              value={watch('service_date')}
              onChange={(val) => setValue('service_date', val || '', { shouldValidate: true })}
            />
          </Field>

          <Field label="نوع اقدام" required error={errors.service_type?.message}>
            <select className="select select-bordered w-full" {...register('service_type')}>
              <option value="repair">تعمیر فنی (Repair)</option>
              <option value="periodic">سرویس دوره‌ای گارانتی (Periodic)</option>
              <option value="overhaul">اورهال و بازسازی کامل (Overhaul)</option>
            </select>
          </Field>
        </div>

        <Field label="شرح خدمات انجام‌شده بر روی دستگاه" required error={errors.description?.message}>
          <textarea
            rows={3}
            className="textarea textarea-bordered w-full"
            placeholder="مثال: تعویض سیل آب‌بندی، کالیبراسیون سنسور، تست فشار نهایی دستگاه..."
            {...register('description')}
          />
        </Field>

        <Field label="هزینه سرویس / تعمیر (تومان - در صورت شمول)">
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            className="input input-bordered w-full text-start font-mono"
            placeholder="مثال: 1,200,000"
            value={watch('cost') || ''}
            onChange={(e) => setValue('cost', formatNumericInput(e.target.value))}
          />
        </Field>
      </form>
    </Modal>
  )
}
