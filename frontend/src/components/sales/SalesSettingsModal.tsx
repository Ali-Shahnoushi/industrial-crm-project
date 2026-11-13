import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { salesSettingsApi } from '../../services/sales'
import { toEnDigits } from '../../utils/format'

interface Props {
  open: boolean
  onClose: () => void
}

export function SalesSettingsModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [taxDraft, setTaxDraft] = useState<string | null>(null)
  const [patternDraft, setPatternDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: salesSettingsApi.get,
    enabled: open,
  })

  const taxPercent = taxDraft ?? String(data?.sales_default_tax_percent ?? 10)
  const smsPatternId = patternDraft ?? (data?.sales_sms_pattern_id ?? '')

  const handleClose = () => {
    setTaxDraft(null)
    setPatternDraft(null)
    onClose()
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const tax = Number(toEnDigits(taxPercent))
    if (Number.isNaN(tax) || tax < 0 || tax > 100) {
      toast.error('درصد مالیات پیش‌فرض باید بین ۰ تا ۱۰۰ باشد.')
      return
    }

    setSaving(true)
    try {
      const res = await salesSettingsApi.update({
        sales_default_tax_percent: tax,
        sales_sms_pattern_id: toEnDigits(smsPatternId).trim(),
      })
      toast.success(res.message)
      qc.invalidateQueries({ queryKey: ['sales-settings'] })
      handleClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'خطا در ذخیره تنظیمات فروش')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title="تنظیمات فروش، مالیات و پیامک"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={saving}>
            بستن
          </button>
          <button type="submit" form="sales-settings-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="loading loading-spinner loading-xs" />}
            ذخیره تنظیمات
          </button>
        </>
      }
    >
      <form id="sales-settings-form" onSubmit={handleSave} className="space-y-4">
        <Field
          label="درصد مالیات پیش‌فرض (ارزش افزوده)"
          hint="در ثبت فروش جدید به صورت خودکار اعمال می‌شود و در هر فروش قابل ویرایش است."
        >
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            className="input input-bordered w-full text-start font-mono"
            value={taxPercent}
            onChange={(e) => setTaxDraft(toEnDigits(e.target.value).replace(/[^\d.]/g, ''))}
          />
        </Field>

        <Field
          label="کد الگوی پیامک تایید فروش (ملی‌پیامک)"
          hint="پارامترهای ارسالی به الگو به ترتیب: نام مشتری، مبلغ نهایی، تاریخ شمسی فروش"
        >
          <input
            dir="ltr"
            className="input input-bordered w-full text-start font-mono"
            placeholder="مثال: 214580"
            value={smsPatternId}
            onChange={(e) => setPatternDraft(toEnDigits(e.target.value))}
          />
        </Field>
      </form>
    </Modal>
  )
}
