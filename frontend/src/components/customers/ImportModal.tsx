import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { customerApi } from '../../services/api'
import { cx, num } from '../../utils/format'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportModal({ open, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [importResult, setImportResult] = useState<{ imported_count: number; errors: string[] } | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      await customerApi.downloadTemplate()
      toast.success('فایل نمونه اکسل با موفقیت دانلود شد.')
    } catch {
      toast.error('خطا در دانلود فایل نمونه اکسل')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const reset = () => {
    setFile(null)
    setImportResult(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFileChange = (f: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      return toast.error('فقط فایل‌های اکسل (.xlsx, .xls) یا CSV پشتیبانی می‌شوند.')
    }
    setFile(f)
    setImportResult(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const res = await customerApi.importExcel(file)
      setImportResult({
        imported_count: res.imported_count,
        errors: res.errors || [],
      })
      toast.success(res.message)
      if (!res.errors || res.errors.length === 0) {
        setTimeout(() => {
          onSuccess()
          close()
        }, 1500)
      } else {
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطا در بارگذاری و پردازش فایل اکسل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="ورود گروهی مشتریان با فایل اکسل (Excel)"
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>
            انصراف
          </button>
          <button className="btn btn-primary" disabled={!file || busy} onClick={handleUpload}>
            {busy && <span className="loading loading-spinner loading-xs" />}
            شروع ایمپورت فایل
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {!file ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFileChange(f)
              }}
              onClick={() => inputRef.current?.click()}
              className={cx(
                'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all',
                drag ? 'border-primary bg-primary/10 scale-[0.99]' : 'border-base-300 hover:border-primary/60 hover:bg-base-200/50',
              )}
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="size-7" />
              </span>
              <div>
                <p className="font-bold text-base">فایل اکسل (.xlsx) را اینجا رها کنید یا کلیک نمایید</p>
                <p className="text-xs text-base-content/60 mt-1">
                  ستون‌های فایل: نوع مشتری (بالقوه/بالفعل)، نام، نام خانوادگی، شماره همراه، شرکت، شهر و...
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileChange(f)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Template Download Card */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-8 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold">فایل نمونه اکسل استاندارد</p>
                  <p className="text-[11px] text-base-content/60">دارای ستون‌های استاندارد و نمونه ردیف‌های بالفعل و بالقوه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="btn btn-xs btn-outline btn-success gap-1.5"
              >
                {downloadingTemplate ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Download className="size-3.5" />
                )}
                دانلود قالب اکسل
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-8 text-primary" />
                <div>
                  <p className="font-bold text-sm">{file.name}</p>
                  <p className="text-xs text-base-content/50">{(file.size / 1024).toFixed(1)} کیلوبایت</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-xs text-error" onClick={reset} disabled={busy}>
                انتخاب فایل دیگر
              </button>
            </div>

            {/* Import Status / Errors */}
            {importResult && (
              <div className="space-y-3">
                <div className="alert alert-success">
                  <CheckCircle2 className="size-5" />
                  <span>تعداد {num(importResult.imported_count)} مشتری با موفقیت وارد/بروزرسانی شد.</span>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                    <p className="font-bold text-xs text-warning-content flex items-center gap-1.5">
                      <AlertCircle className="size-4" />
                      هشدارهای سطرهای نامعتبر ({num(importResult.errors.length)} سطر نادیده گرفته شد):
                    </p>
                    <ul className="text-xs text-base-content/70 space-y-1 list-disc list-inside max-h-40 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
