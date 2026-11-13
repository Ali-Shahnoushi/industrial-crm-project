import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { Users } from 'lucide-react'
import { EChart } from './EChart'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { compact, num, toman } from '../../utils/format'
import type { SalesChartsData } from '../../types/sales'

interface Props {
  data: SalesChartsData['by_salesperson']
  loading?: boolean
}

export function SalesBySellerChart({ data, loading }: Props) {
  const isDark = useIsDarkTheme()

  const option = useMemo<EChartsCoreOption>(() => {
    const ordered = [...data].slice(0, 8).reverse()
    const names = ordered.map((d) => d.name)
    const values = ordered.map((d) => d.total_revenue)

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f1f5f9' : '#0f172a',
          fontFamily: '"Vazirmatn FD", "Vazirmatn", sans-serif',
        },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          if (!p) return ''
          const item = ordered[p.dataIndex]
          if (!item) return ''
          return `<div dir="rtl" style="text-align:right">
            <div style="font-weight:700;margin-bottom:4px">${item.name}</div>
            <div>مجموع فروش: <b>${toman(item.total_revenue)}</b></div>
            <div style="opacity:0.75;font-size:11px">تعداد سفارش: ${num(item.sales_count)} مورد</div>
          </div>`
        },
      },
      grid: { left: 16, right: 16, top: 12, bottom: 20, containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.2)' } },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 10,
          formatter: (val: number) => compact(val),
        },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          color: isDark ? '#cbd5e1' : '#334155',
          fontSize: 11,
          width: 110,
          overflow: 'truncate',
        },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      },
      series: [
        {
          name: 'مجموع فروش',
          type: 'bar',
          barMaxWidth: 26,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: '#0ea5e9',
          },
          data: values,
        },
      ],
    }
  }, [data, isDark])

  return (
    <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Users className="size-4" />
        </span>
        <div>
          <h3 className="font-bold text-sm text-base-content">فروش بر اساس کارشناس</h3>
          <p className="text-[11px] text-base-content/60">عملکرد فروشندگان در بازه انتخابی</p>
        </div>
      </div>

      {!loading && !data.length ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-base-content/50">
          داده‌ای برای نمایش عملکرد کارشناسان وجود ندارد.
        </div>
      ) : (
        <EChart option={option} height={280} loading={loading} />
      )}
    </div>
  )
}
