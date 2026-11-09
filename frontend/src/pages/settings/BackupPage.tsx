import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  HardDrive,
  History,
  Info,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Can } from '../../components/common/Can'
import { backupApi } from '../../services/api'
import { cx, num } from '../../utils/format'

export default function BackupPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
  const [exportingDb, setExportingDb] = useState(false)
  const [restoreResult, setRestoreResult] = useState<{
    message: string
    stats: {
      created_customers: number
      updated_customers: number
      restored_devices: number
    }
  } | null>(null)

  // Fetch DB & Backup Status
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['backup-status'],
    queryFn: backupApi.status,
  })

  // Export JSON
  const handleExportJson = async () => {
    setExportingJson(true)
    try {
      await backupApi.downloadCustomersJson()
      toast.success('فایل پشتیبان JSON مشتریان و دستگاه‌ها با موفقیت دانلود شد.')
    } catch {
      toast.error('خطا در دانلود فایل پشتیبان JSON')
    } finally {
      setExportingJson(false)
    }
  }

  // Export Full DB
  const handleExportDb = async () => {
    setExportingDb(true)
    try {
      await backupApi.downloadDatabaseDump()
      toast.success('پشتیبان کامل پایگاه داده با موفقیت ایجاد و دانلود گردید.')
    } catch {
      toast.error('خطا در استخراج نسخه پشتیبان دیتابیس')
    } finally {
      setExportingDb(false)
    }
  }

  // Restore JSON Mutation
  const restoreMutation = useMutation({
    mutationFn: (file: File) => backupApi.restoreCustomersJson(file),
    onSuccess: (data) => {
      setRestoreResult(data)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['parts-catalog'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      refetch()
      toast.success(data.message || 'بازیابی مشتریان و دستگاه‌ها با موفقیت انجام شد.')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در بازیابی فایل پشتیبان JSON')
    },
  })

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('لطفاً یک فایل استاندارد با پسوند .json انتخاب نمایید.')
        return
      }
      setSelectedFile(file)
      setRestoreResult(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="پشتیبان‌گیری و بازیابی داده‌ها (Backup & Restore)"
        subtitle="پشتیبان‌گیری کامل و بازیابی پرونده مشتریان و دستگاه‌های تخصیص‌یافته به صورت JSON و دریافت خروجی دیتابیس"
        actions={
          <button
            onClick={() => refetch()}
            className="btn btn-sm btn-ghost gap-1.5"
            title="به‌روزرسانی وضعیت"
          >
            <RefreshCw className={cx('size-4', isLoading && 'animate-spin')} />
            به‌روزرسانی آمار
          </button>
        }
      />

      {/* System DB Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-200 shadow-xs p-4 flex flex-row items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <Database className="size-6" />
          </div>
          <div>
            <p className="text-xs text-base-content/60 font-medium">موتور و نوع پایگاه داده</p>
            <p className="text-base font-extrabold uppercase mt-0.5">
              {status?.database_driver || 'SQLite / MySQL'}
            </p>
            <p className="text-[11px] text-base-content/40 truncate">{status?.database_name || 'CRM DB'}</p>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4 flex flex-row items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <HardDrive className="size-6" />
          </div>
          <div>
            <p className="text-xs text-base-content/60 font-medium">حجم پایگاه داده</p>
            <p className="text-base font-extrabold font-mono mt-0.5">
              {status?.database_size || 'در حال محاسبه...'}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold">پایگاه داده بهینه</p>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4 flex flex-row items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Users className="size-6" />
          </div>
          <div>
            <p className="text-xs text-base-content/60 font-medium">پرونده‌های فعال مشتریان</p>
            <p className="text-base font-extrabold mt-0.5">
              {num(status?.total_customers ?? 0)} پرونده
            </p>
            <p className="text-[11px] text-base-content/40">حقیقی و حقوقی</p>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-200 shadow-xs p-4 flex flex-row items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
            <Cpu className="size-6" />
          </div>
          <div>
            <p className="text-xs text-base-content/60 font-medium">دستگاه‌های تحویلی</p>
            <p className="text-base font-extrabold mt-0.5">
              {num(status?.total_devices ?? 0)} دستگاه
            </p>
            <p className="text-[11px] text-base-content/40">در {num(status?.total_parts ?? 0)} مدل کاتالوگ</p>
          </div>
        </div>
      </div>

      {/* Grid: 2 Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: JSON Backup & Restore of Customers & Devices */}
        <div className="card bg-base-100 border border-base-200 shadow-xs">
          <div className="card-body p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-base-200 pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileCode2 className="size-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">پشتیبان‌گیری و بازیابی JSON (مشتریان و دستگاه‌ها)</h3>
                <p className="text-xs text-base-content/60">فرمت ساختاریافته استاندارد و قابل حمل بین تمامی نسخه‌ها</p>
              </div>
            </div>

            {/* Export JSON Box */}
            <div className="rounded-2xl border border-base-200 bg-base-200/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-sm text-base-content">خروجی کامل داده‌ها (JSON Export)</p>
                  <p className="text-xs text-base-content/60 leading-relaxed">
                    دریافت فایل JSON شامل کلیه مشتریان، مشخصات تماس، دستگاه‌های تخصیص‌یافته به مشتریان، شماره‌های سریال، تاریخ‌ها و فاکتورها.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportJson}
                disabled={exportingJson}
                className="btn btn-sm btn-primary gap-2 w-full sm:w-auto"
              >
                {exportingJson ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <ArrowDownToLine className="size-4" />
                )}
                دانلود پشتیبان JSON مشتریان و دستگاه‌ها
              </button>
            </div>

            {/* Restore JSON Box */}
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/20 p-4 space-y-3">
              <p className="font-bold text-sm text-base-content flex items-center gap-2">
                <Upload className="size-4 text-primary" />
                بازیابی یا درون‌ریزی از فایل JSON (Restore)
              </p>
              <p className="text-xs text-base-content/60 leading-relaxed">
                با بارگذاری فایل JSON، مشتریان شناسایی شده و اطلاعات آن‌ها به همراه دستگاه‌هایشان در سامانه به‌روزرسانی یا ایجاد خواهد شد.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={onFileChange}
                className="file-input file-input-bordered file-input-sm w-full text-xs"
              />

              {selectedFile && (
                <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-primary">{selectedFile.name}</p>
                    <p className="text-base-content/50 font-mono">
                      حجم: {Math.round(selectedFile.size / 1024)} کیلوبایت
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmRestoreOpen(true)}
                    disabled={restoreMutation.isPending}
                    className="btn btn-sm btn-success gap-1.5"
                  >
                    {restoreMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    تأیید و اجرای بازیابی
                  </button>
                </div>
              )}

              {/* Restore Summary Success */}
              {restoreResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-3.5 space-y-2 text-xs">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {restoreResult.message}
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-medium text-emerald-900 dark:text-emerald-200">
                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-lg text-center">
                      <span className="block font-bold text-sm">{num(restoreResult.stats.created_customers)}</span>
                      <span className="text-[11px] opacity-75">مشتری جدید</span>
                    </div>
                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-lg text-center">
                      <span className="block font-bold text-sm">{num(restoreResult.stats.updated_customers)}</span>
                      <span className="text-[11px] opacity-75">مشتری به‌روزرسانی‌شده</span>
                    </div>
                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-lg text-center">
                      <span className="block font-bold text-sm">{num(restoreResult.stats.restored_devices)}</span>
                      <span className="text-[11px] opacity-75">دستگاه بازیابی‌شده</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Full Database Backup */}
        <div className="card bg-base-100 border border-base-200 shadow-xs">
          <div className="card-body p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-base-200 pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Database className="size-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">پشتیبان‌گیری کامل پایگاه داده (Database Dump)</h3>
                <p className="text-xs text-base-content/60">دریافت فایل کامل دیتابیس با تمامی جداول، دسترسی‌ها و تاریخچه‌ها</p>
              </div>
            </div>

            <div className="rounded-2xl border border-base-200 bg-base-200/30 p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="font-bold text-sm text-base-content flex items-center gap-2">
                  <Server className="size-4 text-emerald-600" />
                  خروجی خام پایگاه داده ({status?.database_driver === 'sqlite' ? '.sqlite' : '.sql'})
                </p>
                <p className="text-xs text-base-content/60 leading-relaxed">
                  این خروجی حاوی تمامی داده‌های بدون دستکاری شامل جداول کاربران، سطوح دسترسی (ACL)، تنظیمات سیستم، لاگ‌های ورود و خروج انبار، تاریخچه خدمات و فایل‌های ذخیره‌شده است.
                </p>
              </div>

              <Can permission="settings.manage">
                <button
                  type="button"
                  onClick={handleExportDb}
                  disabled={exportingDb}
                  className="btn btn-sm btn-outline border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white gap-2 w-full sm:w-auto"
                >
                  {exportingDb ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <ArrowDownToLine className="size-4" />
                  )}
                  دانلود بکاپ کامل دیتابیس ({status?.database_driver?.toUpperCase() || 'DB'})
                </button>
              </Can>
            </div>

            {/* Hosting & Automation Advice */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/30 p-4 space-y-2 text-xs">
              <p className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Info className="size-4 text-blue-600" />
                توصیه امنیتی برای سرور و هاست cPanel:
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-950/80 dark:text-blue-200/80 leading-relaxed">
                <li>
                  پیشنهاد می‌شود قبل از هرگونه به‌روزرسانی اصلی یا تغییر در ساختار سرور، یک نسخه پشتیبان از پایگاه داده و پرونده‌های مشتریان دانلود و در محل امن نگهداری نمایید.
                </li>
                <li>
                  در محیط cPanel با اتصال به MySQL، می‌توانید از بخش «Backup Wizard» کنترل‌پنل هاست نیز برای زمان‌بندی پشتیبان‌گیری دوره‌ای روزانه استفاده کنید.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Restore */}
      <ConfirmDialog
        open={confirmRestoreOpen}
        title="تأیید بازیابی اطلاعات مشتریان و دستگاه‌ها"
        message="آیا مطمئن هستید که می‌خواهید فایل پشتیبان انتخابی را روی سامانه بازیابی کنید؟ در صورت وجود مشتریان قبلی، اطلاعات آن‌ها به‌روزرسانی شده و دستگاه‌های جدید به آن‌ها تخصیص خواهد یافت."
        confirmText="بله، بازیابی شود"
        loading={restoreMutation.isPending}
        onConfirm={() => {
          setConfirmRestoreOpen(false)
          if (selectedFile) restoreMutation.mutate(selectedFile)
        }}
        onClose={() => setConfirmRestoreOpen(false)}
      />
    </div>
  )
}
