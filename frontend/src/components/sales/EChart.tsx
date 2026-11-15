import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

interface EChartProps {
  option: EChartsCoreOption
  height?: number
  loading?: boolean
  className?: string
}

export function EChart({ option, height = 300, loading = false, className = '' }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const isDark = useIsDarkTheme()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, isDark ? 'dark' : undefined, { renderer: 'canvas' })
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.resize()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [isDark])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const merged: EChartsCoreOption = {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: '"Vazirmatn FD", "Vazirmatn", ui-sans-serif, system-ui, sans-serif',
      },
      ...option,
    }

    chart.setOption(merged, { notMerge: true })
  }, [option, isDark])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (loading) {
      chart.showLoading('default', {
        text: 'در حال بارگذاری...',
        color: '#4f46e5',
        maskColor: isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.65)',
      })
    } else {
      chart.hideLoading()
    }
  }, [loading, isDark])

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px` }}
      className={`w-full ${className}`}
    />
  )
}
