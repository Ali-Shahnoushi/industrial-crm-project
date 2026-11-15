import { useMemo, useState } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { Cpu } from 'lucide-react'
import { EChart } from './EChart'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { compact, cx, num, toman } from '../../utils/format'
import type { SalesChartsData } from '../../types/sales'

interface Props {
  data: SalesChartsData['by_part']
  loading?: boolean
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

export function SalesByPartChart({ data, loading }: Props) {
  const isDark = useIsDarkTheme()
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut')

  const option = useMemo<EChartsCoreOption>(() => {
    const top = data.slice(0, 7)

    if (chartType === 'bar') {
      const ordered = [...top].reverse()
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
              <div>فروش: <b>${toman(item.total_revenue)}</b></div>
              <div style="opacity:0.75;font-size:11px">تعداد: ${num(item.total_quantity)} عدد</div>
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
            formatter: (v: number) => compact(v),
          },
        },
        yAxis: {
          type: 'category',
          data: ordered.map((d) => d.name),
          axisLabel: {
            color: isDark ? '#cbd5e1' : '#334155',
            fontSize: 11,
            width: 120,
            overflow: 'truncate',
          },
        },
        series: [
          {
            type: 'bar',
            barMaxWidth: 24,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: '#10b981',
            },
            data: ordered.map((d) => d.total_revenue),
          },
        ],
      }
    }

    return {
      color: COLORS,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#f1f5f9' : '#0f172a',
          fontFamily: '"Vazirmatn FD", "Vazirmatn", sans-serif',
        },
        formatter: (p: any) => {
          const item = top[p.dataIndex]
          if (!item) return ''
          return `<div dir="rtl" style="text-align:right">
            <div style="font-weight:700;margin-bottom:4px">${item.name}</div>
            <div>درآمد: <b>${toman(item.total_revenue)}</b> (${num(p.percent ?? 0)}٪)</div>
            <div style="opacity:0.75;font-size:11px">تعداد فروش: ${num(item.total_quantity)} عدد</div>
          </div>`
        },
      },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'middle',
        textStyle: {
          color: isDark ? '#cbd5e1' : '#334155',
          fontSize: 11,
          width: 145,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: 'فروش دستگاه',
          type: 'pie',
          radius: ['48%', '76%'],
          center: ['30%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark ? '#1e293b' : '#ffffff',
            borderWidth: 2,
          },
          label: { show: false },
          data: top.map((d) => ({
            name: d.name,
            value: d.total_revenue > 0 ? d.total_revenue : d.total_quantity,
          })),
        },
      ],
    }
  }, [data, chartType, isDark])

  return (
    <div className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Cpu className="size-4" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-base-content">سهم فروش بر اساس دستگاه</h3>
            <p className="text-[11px] text-base-content/60">پرفروش‌ترین محصولات در بازه انتخابی</p>
          </div>
        </div>

        <div className="join">
          <button
            type="button"
            onClick={() => setChartType('donut')}
            className={cx(
              'btn btn-xs join-item',
              chartType === 'donut' ? 'btn-primary' : 'btn-ghost border border-base-300',
            )}
          >
            دایره‌ای
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={cx(
              'btn btn-xs join-item',
              chartType === 'bar' ? 'btn-primary' : 'btn-ghost border border-base-300',
            )}
          >
            ستونی
          </button>
        </div>
      </div>

      {!loading && !data.length ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-base-content/50">
          فروشی برای تفکیک دستگاه‌ها ثبت نشده است.
        </div>
      ) : (
        <EChart option={option} height={260} loading={loading} />
      )}
    </div>
  )
}
