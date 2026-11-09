import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { SearchableSelect } from '../ui/SearchableSelect'
import { customerApi } from '../../services/api'
import { IRAN_PROVINCES, getCitiesByProvince } from '../../data/iranLocations'
import { cx, toEnDigits } from '../../utils/format'
import type { Customer } from '../../types'

const schema = z
  .object({
    customer_type: z.enum(['potential', 'effective']),
    type: z.enum(['individual', 'company']),
    first_name: z.string().trim().optional(),
    last_name: z.string().trim().optional(),
    company_name: z.string().trim().optional(),
    national_code: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().email('فرمت آدرس ایمیل معتبر نیست').or(z.literal('')).optional(),
    province: z.string().trim().optional(),
    city: z.string().trim().optional(),
    address: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'company') {
      if (!data.company_name || data.company_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['company_name'],
          message: 'وارد کردن نام شرکت برای مشتریان حقوقی الزامی است (حداقل ۲ کاراکتر)',
        })
      }
    } else {
      if (!data.first_name || data.first_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['first_name'],
          message: 'وارد کردن نام برای مشتریان حقیقی الزامی است (حداقل ۲ کاراکتر)',
        })
      }
      if (!data.last_name || data.last_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['last_name'],
          message: 'وارد کردن نام خانوادگی برای مشتریان حقیقی الزامی است (حداقل ۲ کاراکتر)',
        })
      }
    }

    const normMobile = toEnDigits(data.mobile || '').trim()
    if (normMobile.length > 0 && !/^09\d{9}$/.test(normMobile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mobile'],
        message: 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود (مثال: 09121234567)',
      })
    }

    const normPhone = toEnDigits(data.phone || '').trim()
    if (normPhone.length > 0 && !/^0\d{10}$/.test(normPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'شماره تلفن ثابت باید ۱۱ رقم عددی بوده و با 0 شروع شود (مثال: 02188776655)',
      })
    }

    const normNational = toEnDigits(data.national_code || '').trim()
    if (normNational.length > 0) {
      if (data.type === 'individual' && !/^\d{10}$/.test(normNational)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['national_code'],
          message: 'کد ملی برای شخص حقیقی باید دقیقاً ۱۰ رقم عددی باشد',
        })
      } else if (data.type === 'company' && !/^\d{11}$/.test(normNational)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['national_code'],
          message: 'شناسه ملی برای شخص حقوقی باید دقیقاً ۱۱ رقم عددی باشد',
        })
      }
    }
  })

type FormValues = z.infer<typeof schema>

interface CustomerFormModalProps {
  open: boolean
  onClose: () => void
  customer?: Customer
  onSuccess: () => void
}

const allowDigitsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)
  ) {
    return
  }
  if (!/^[0-9۰-۹٠-٩]$/.test(e.key)) {
    e.preventDefault()
  }
}

export function CustomerFormModal({ open, onClose, customer, onSuccess }: CustomerFormModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_type: 'potential',
      type: 'individual',
      first_name: '',
      last_name: '',
      company_name: '',
      national_code: '',
      mobile: '',
      phone: '',
      email: '',
      province: 'تهران',
      city: 'تهران',
      address: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      if (customer) {
        reset({
          customer_type: customer.customer_type,
          type: customer.type,
          first_name: customer.first_name ?? '',
          last_name: customer.last_name ?? '',
          company_name: customer.company_name ?? '',
          national_code: customer.national_code ?? '',
          mobile: customer.mobile ?? '',
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          province: customer.province ?? 'تهران',
          city: customer.city ?? 'تهران',
          address: customer.address ?? '',
          notes: customer.notes ?? '',
        })
      } else {
        reset({
          customer_type: 'potential',
          type: 'individual',
          first_name: '',
          last_name: '',
          company_name: '',
          national_code: '',
          mobile: '',
          phone: '',
          email: '',
          province: 'تهران',
          city: 'تهران',
          address: '',
          notes: '',
        })
      }
    }
  }, [open, customer, reset])

  const type = watch('type')
  const customerType = watch('customer_type')
  const province = watch('province')
  const city = watch('city')
  const isCompany = type === 'company'

  const availableCities = useMemo(() => {
    return getCitiesByProvince(province)
  }, [province])

  const handleProvinceChange = (newProvince: string) => {
    setValue('province', newProvince)
    const cities = getCitiesByProvince(newProvince)
    if (cities.length > 0) {
      setValue('city', cities[0])
    } else {
      setValue('city', '')
    }
  }

  const onSubmit = async (values: FormValues) => {
    const payload: Partial<Customer> = {
      customer_type: values.customer_type,
      type: values.type,
      first_name: values.first_name?.trim() || null,
      last_name: values.last_name?.trim() || null,
      company_name: values.company_name?.trim() || null,
      national_code: toEnDigits(values.national_code || '').trim() || null,
      mobile: toEnDigits(values.mobile || '').trim() || null,
      phone: toEnDigits(values.phone || '').trim() || null,
      email: toEnDigits(values.email || '').trim() || null,
      province: values.province?.trim() || null,
      city: values.city?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
    }

    try {
      if (customer) {
        await customerApi.update(customer.id, payload)
        toast.success('مشخصات مشتری بروزرسانی شد.')
      } else {
        await customerApi.create(payload)
        toast.success('مشتری جدید با موفقیت ثبت شد.')
      }
      onSuccess()
    } catch (err: any) {
      const firstErr = Object.values(err?.response?.data?.errors || {})[0] as string[] | undefined
      const msg = firstErr?.[0] || err.response?.data?.message || 'خطا در ذخیره اطلاعات مشتری'
      toast.error(msg)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={customer ? 'ویرایش پرونده مشتری' : 'ثبت مشتری جدید'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            انصراف
          </button>
          <button type="submit" form="customer-modal-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner loading-xs" />}
            {customer ? 'بروزرسانی تغییرات' : 'ثبت مشتری'}
          </button>
        </>
      }
    >
      <form id="customer-modal-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Type Segments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-base-content/70 mb-1.5 block">وضعیت مشتری</label>
            <div role="tablist" className="tabs tabs-box w-full">
              <label role="tab" className={cx('tab flex-1 text-xs', customerType === 'potential' && 'tab-active')}>
                <input type="radio" value="potential" className="hidden" {...register('customer_type')} />
                مشتری بالقوه (سرنخ)
              </label>
              <label role="tab" className={cx('tab flex-1 text-xs', customerType === 'effective' && 'tab-active')}>
                <input type="radio" value="effective" className="hidden" {...register('customer_type')} />
                مشتری بالفعل (خریدار)
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-base-content/70 mb-1.5 block">نوع شخصیت</label>
            <div role="tablist" className="tabs tabs-box w-full">
              <label role="tab" className={cx('tab flex-1 text-xs', type === 'individual' && 'tab-active')}>
                <input type="radio" value="individual" className="hidden" {...register('type')} />
                حقیقی (فرد)
              </label>
              <label role="tab" className={cx('tab flex-1 text-xs', type === 'company' && 'tab-active')}>
                <input type="radio" value="company" className="hidden" {...register('type')} />
                حقوقی (شرکت/کارگاه)
              </label>
            </div>
          </div>
        </div>

        {/* Company & National Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={isCompany ? 'نام شرکت / کارگاه' : 'نام شرکت / کارگاه (اختیاری)'}
            required={isCompany}
            error={errors.company_name?.message}
          >
            <input
              className="input input-bordered w-full"
              {...register('company_name')}
              placeholder={isCompany ? 'نام ثبتی شرکت (الزامی)' : 'مثال: کارگاه صنعتی پارس'}
            />
          </Field>

          <Field
            label={isCompany ? 'شناسه ملی شرکت (۱۱ رقم)' : 'کد ملی (۱۰ رقم)'}
            error={errors.national_code?.message}
          >
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={isCompany ? 11 : 10}
              className="input input-bordered w-full text-start font-mono"
              placeholder={isCompany ? 'مثال: 10100123456' : 'مثال: 0012345678'}
              {...register('national_code', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value).replace(/\D/g, '')
                },
              })}
              onKeyDown={allowDigitsKeyDown}
            />
          </Field>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={isCompany ? 'نام نماینده / رابط (اختیاری)' : 'نام'}
            required={!isCompany}
            error={errors.first_name?.message}
          >
            <input className="input input-bordered w-full" {...register('first_name')} placeholder="مثال: حمید" />
          </Field>
          <Field
            label={isCompany ? 'نام خانوادگی نماینده / رابط (اختیاری)' : 'نام خانوادگی'}
            required={!isCompany}
            error={errors.last_name?.message}
          >
            <input className="input input-bordered w-full" {...register('last_name')} placeholder="مثال: رضایی" />
          </Field>
        </div>

        {/* Contact Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="شماره همراه (۱۱ رقم با 09 - اختیاری)" error={errors.mobile?.message}>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={11}
              className="input input-bordered w-full text-start font-mono"
              placeholder="09123456789"
              {...register('mobile', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 11)
                },
              })}
              onKeyDown={allowDigitsKeyDown}
            />
          </Field>
          <Field label="تلفن ثابت (۱۱ رقم با 0)" error={errors.phone?.message}>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={11}
              className="input input-bordered w-full text-start font-mono"
              placeholder="02188776655"
              {...register('phone', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 11)
                },
              })}
              onKeyDown={allowDigitsKeyDown}
            />
          </Field>
          <Field label="ایمیل" error={errors.email?.message}>
            <input
              type="email"
              dir="ltr"
              className="input input-bordered w-full text-start"
              {...register('email', {
                onChange: (e) => {
                  e.target.value = toEnDigits(e.target.value)
                },
              })}
              placeholder="name@domain.com"
            />
          </Field>
        </div>

        {/* Location with SearchableSelect catalog */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label="استان"
            placeholder="انتخاب استان..."
            searchPlaceholder="جستجوی استان..."
            value={province || ''}
            options={IRAN_PROVINCES}
            onChange={handleProvinceChange}
          />

          <SearchableSelect
            label="شهر"
            placeholder="انتخاب شهر..."
            searchPlaceholder="جستجوی شهر..."
            value={city || ''}
            options={availableCities}
            onChange={(val) => setValue('city', val)}
            disabled={!province}
          />
        </div>

        <Field label="آدرس پستی">
          <textarea
            rows={2}
            className="textarea textarea-bordered w-full"
            {...register('address')}
            placeholder="آدرس کارخانه یا محل نصب دستگاه‌ها..."
          />
        </Field>

        <Field label="یادداشت و توضیحات">
          <textarea
            rows={2}
            className="textarea textarea-bordered w-full"
            {...register('notes')}
            placeholder="توضیحات تکمیلی یا نیازهای فنی مشتری..."
          />
        </Field>
      </form>
    </Modal>
  )
}
