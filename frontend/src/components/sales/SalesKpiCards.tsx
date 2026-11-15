import { Award, Cpu, ShoppingBag, TrendingUp } from 'lucide-react'
import { StatCard } from '../ui/StatCard'
import { compactToman, digits, num, toman } from '../../utils/format'
import type { SalesSummary } from '../../types/sales'

interface Props {
  summary?: SalesSummary
  loading?: boolean
}

export function SalesKpiCards({ summary, loading }: Props) {
  const salesCount = summary?.sales_count ?? 0
  const conversionRate = summary?.conversion_rate ?? 0
  const topSeller = summary?.top_salesperson
  const topPart = summary?.top_part

  return (
    <div className="space-y-3">
      {/* 4 Requested Core KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="تعداد فروش (سفارش‌های تاییدشده)"
          value={`${num(salesCount)} فروش`}
          icon={ShoppingBag}
          tone="primary"
          delta={summary ? summary.sales_count_delta_pct : undefined}
          hint={summary ? `جمع درآمد دوره: ${compactToman(summary.total_revenue)}` : undefined}
          loading={loading}
        />

        <StatCard
          title="نرخ تبدیل مشتری (بالقوه ← بالفعل)"
          value={`${digits(conversionRate.toFixed(1))}٪`}
          icon={TrendingUp}
          tone="success"
          delta={summary ? summary.conversion_delta_pct : undefined}
          hint={
            summary
              ? `${num(summary.converting_customers_count)} از ${num(summary.total_customers_count)} مشتری دارای خرید`
              : undefined
          }
          loading={loading}
        />

        <StatCard
          title="برترین کارشناس فروش"
          value={topSeller ? topSeller.name : '—'}
          icon={Award}
          tone="warning"
          hint={
            topSeller
              ? `${compactToman(topSeller.total_revenue)} (${num(topSeller.sales_count)} فروش)`
              : 'فروشی در این بازه ثبت نشده است'
          }
          loading={loading}
        />

        <StatCard
          title="پرفروش‌ترین دستگاه"
          value={topPart ? topPart.name : '—'}
          icon={Cpu}
          tone="info"
          hint={
            topPart
              ? `${num(topPart.total_quantity)} عدد فروخته‌شده • ${compactToman(topPart.total_revenue)}`
              : 'دستگاهی در این بازه فروخته نشده است'
          }
          loading={loading}
        />
      </div>

      {/* Supporting Financial Strip */}
      {!loading && summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-2xl border border-base-200 bg-base-100 p-4 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-base-200/40 px-3.5 py-2.5">
            <span className="text-base-content/65 font-medium">درآمد کل دوره:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-extrabold text-base-content" title={toman(summary.total_revenue)}>
                {toman(summary.total_revenue)}
              </span>
              <span
                className={`font-bold ${summary.revenue_delta_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              >
                ({summary.revenue_delta_pct >= 0 ? '+' : ''}
                {digits(summary.revenue_delta_pct.toFixed(1))}٪)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-base-200/40 px-3.5 py-2.5">
            <span className="text-base-content/65 font-medium">میانگین هر فاکتور:</span>
            <span className="font-mono text-sm font-extrabold text-base-content">
              {toman(summary.average_order_value)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-base-200/40 px-3.5 py-2.5">
            <span className="text-base-content/65 font-medium">مطالبات پرداخت‌نشده دوره:</span>
            <span className="font-mono text-sm font-extrabold text-rose-600 dark:text-rose-400">
              {toman(summary.unpaid_amount)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
