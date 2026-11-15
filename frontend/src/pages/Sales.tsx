import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, Plus, Settings2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { DatePicker } from '../components/ui/DatePicker'
import { Can } from '../components/common/Can'
import { SalesKpiCards } from '../components/sales/SalesKpiCards'
import { RevenueChart } from '../components/sales/RevenueChart'
import { SalesBySellerChart } from '../components/sales/SalesBySellerChart'
import { SalesByPartChart } from '../components/sales/SalesByPartChart'
import { SalesTable } from '../components/sales/SalesTable'
import { SaleFormModal } from '../components/sales/SaleFormModal'
import { SalesSettingsModal } from '../components/sales/SalesSettingsModal'
import { http } from '../services/api'
import { salesApi } from '../services/sales'
import { cx, localTodayYmd } from '../utils/format'
import type { Sale } from '../types/sales'

function daysAgoYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Sales() {
  const [fromDate, setFromDate] = useState<string | null>(() => daysAgoYmd(179))
  const [toDate, setToDate] = useState<string | null>(() => localTodayYmd())
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month')

  // Table state
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')
  const [sortBy, setSortBy] = useState('sale_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const perPage = 15

  // Modals
  const [formOpen, setFormOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const periodParams = useMemo(
    () => ({
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [fromDate, toDate],
  )

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['sales-summary', periodParams],
    queryFn: () => salesApi.summary(periodParams),
  })

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['sales-charts', periodParams, granularity],
    queryFn: () => salesApi.charts({ ...periodParams, granularity }),
  })

  const { data: sellers = [] } = useQuery({
    queryKey: ['sales-seller-options'],
    queryFn: salesApi.sellerOptions,
  })

  const { data: salesPage, isLoading: tableLoading } = useQuery({
    queryKey: [
      'sales',
      q,
      fromDate,
      toDate,
      statusFilter,
      paymentFilter,
      sellerFilter,
      sortBy,
      sortDir,
      page,
    ],
    queryFn: () =>
      salesApi.list({
        q: q.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        user_id: sellerFilter || undefined,
        sort_by: sortBy,
        sort_direction: sortDir,
        page,
        per_page: perPage,
      }),
  })

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  const applyPreset = (days: number | null) => {
    if (days === null) {
      setFromDate(null)
      setToDate(null)
    } else {
      setFromDate(daysAgoYmd(days - 1))
      setToDate(localTodayYmd())
      if (days <= 14) setGranularity('day')
      else if (days <= 90) setGranularity('week')
      else setGranularity('month')
    }
    setPage(1)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const url = salesApi.exportExcelUrl({
        from: fromDate || undefined,
        to: toDate || undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        user_id: sellerFilter || undefined,
      })
      const response = await http.get(url.replace('/api/v1', ''), {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `sales-${fromDate || 'all'}-to-${toDate || localTodayYmd()}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      toast.success('فایل اکسل فروش با موفقیت دانلود شد.')
    } catch {
      toast.error('خطا در تهیه خروجی اکسل فروش')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="فروش و گزارش‌های تحلیلی"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Can permission="settings.manage">
              <button
                type="button"
                className="btn btn-sm btn-ghost border border-base-300 gap-1.5"
                onClick={() => setSettingsOpen(true)}
                title="تنظیمات مالیات و پیامک فروش"
              >
                <Settings2 className="size-4" />
                تنظیمات فروش
              </button>
            </Can>

            <button
              type="button"
              className="btn btn-sm btn-outline gap-1.5"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              {exporting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="size-4" />
              )}
              خروجی اکسل
            </button>

            <Can permission="sales.create">
              <button
                type="button"
                className="btn btn-sm btn-primary gap-1.5"
                onClick={() => {
                  setEditingSale(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                ثبت فروش جدید
              </button>
            </Can>
          </div>
        }
      />

      {/* Jalali Date Range Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-base-200 bg-base-100 p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-base-content/70">بازه تاریخی گزارش:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '۷ روز اخیر', days: 7 },
              { label: '۳۰ روز اخیر', days: 30 },
              { label: '۳ ماه اخیر', days: 90 },
              { label: '۶ ماه اخیر', days: 180 },
              { label: 'کل دوره', days: null },
            ].map((preset) => {
              const active =
                preset.days === null
                  ? !fromDate && !toDate
                  : fromDate === daysAgoYmd(preset.days - 1) && toDate === localTodayYmd()
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className={cx(
                    'btn btn-xs',
                    active ? 'btn-primary' : 'btn-ghost border border-base-300',
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[440px]">
          <DatePicker
            value={fromDate}
            placeholder="از تاریخ شمسی..."
            onChange={(val) => {
              setFromDate(val)
              setPage(1)
            }}
          />
          <DatePicker
            value={toDate}
            placeholder="تا تاریخ شمسی..."
            onChange={(val) => {
              setToDate(val)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* KPIs */}
      <SalesKpiCards summary={summary} loading={summaryLoading} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RevenueChart
            series={charts?.revenue_series ?? []}
            granularity={granularity}
            onGranularityChange={setGranularity}
            loading={chartsLoading}
          />
        </div>
        <div className="lg:col-span-5">
          <SalesBySellerChart
            data={charts?.by_salesperson ?? []}
            loading={chartsLoading}
          />
        </div>
        <div className="lg:col-span-12">
          <SalesByPartChart
            data={charts?.by_part ?? []}
            loading={chartsLoading}
          />
        </div>
      </div>

      {/* Sales Table */}
      <SalesTable
        sales={salesPage?.data ?? []}
        total={salesPage?.total ?? 0}
        page={salesPage?.current_page ?? page}
        perPage={salesPage?.per_page ?? perPage}
        loading={tableLoading}
        q={q}
        status={statusFilter}
        paymentStatus={paymentFilter}
        sellerId={sellerFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        sellers={sellers}
        onSearchChange={(val) => {
          setQ(val)
          setPage(1)
        }}
        onStatusChange={(val) => {
          setStatusFilter(val)
          setPage(1)
        }}
        onPaymentStatusChange={(val) => {
          setPaymentFilter(val)
          setPage(1)
        }}
        onSellerChange={(val) => {
          setSellerFilter(val)
          setPage(1)
        }}
        onSort={handleSort}
        onPageChange={setPage}
        onEdit={(sale) => {
          setEditingSale(sale)
          setFormOpen(true)
        }}
      />

      <SaleFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingSale(null)
        }}
        editingSale={editingSale}
      />

      <SalesSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
