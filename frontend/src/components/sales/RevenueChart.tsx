import { useMemo } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { TrendingUp } from 'lucide-react'
import { EChart } from './EChart'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { compact, cx, digits, num, toman } from '../../utils/format'
import type { SalesChartsData } from '../../types/sales'

interface Props {
  series: SalesChartsData['revenue_series']
  granularity: 'day' | 'week' | 'month'
  onGranularityChange: (g: 'day' | 'week' | 'month') => void
  loading?: boolean
}

export function RevenueChart({ series, granularity, onGranularityChange, loading }: Props) {
  const isDark = useIsDarkTheme()

  const option = useMemo<EChartsCoreOption>(() => {
    const labels = series.map((s) => digits(s.label))
    const revenues = series.map((s) => s.total_revenue)

    return {
      tooltip: {
        trigger: 'axis',
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
          const item = series[p.dataIndex]
          if (!item) return ''
          return `<div dir="rtl" style="text-align:right;min-width:150px">
            <div style="font-weight:700;margin-bottom:4px">${digits(item.label)}</div>
            <div>درآمد: <b>${toman(item.total_revenue)}</b></div>
            <div style="opacity:0.75;font-size:11px">تعداد فروش: ${num(item.sales_count)} مورد</div>
          </div>`
        },
      },
      grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.2)' } },
        axisLabel: {
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: 11,
          formatter: (val: number) => compact(val),
        },
      },
      series: [
        {
          name: 'درآمد',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.35)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.02)' },
              ],
            },
          },
          data: revenues,
        },
      ],
    }
  }, [series, isDark])

  const hasData = series.some((s) => s.total_revenue > 0 || s.sales_count > 0)

  return (
    <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-base-content">روند درآمد فروش در طول زمان</h3>
            <p className="text-[11px] text-base-content/60">بر اساس تقویم شمسی و سفارش‌های تاییدشده</p>
          </div>
        </div>

        <div className="join">
          {(
            [
              { key: 'day', label: 'روزانه' },
              { key: 'week', label: 'هفتگی' },
              { key: 'month', label: 'ماهانه' },
            ] as const
          ).map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => onGranularityChange(g.key)}
              className={cx(
                'btn btn-xs join-item',
                granularity === g.key ? 'btn-primary' : 'btn-ghost border border-base-300',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && !hasData ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-base-content/50">
          فروش تاییدشده‌ای در این بازه زمانی ثبت نشده است.
        </div>
      ) : (
        <EChart option={option} height={280} loading={loading} />
      )}
    </div>
  )
}
