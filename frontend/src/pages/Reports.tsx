import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download, Percent, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { ChartCard, ChartTooltip, axisStyle } from '../components/ui/Chart'
import { Avatar } from '../components/ui/Avatar'
import { useList, useLookup } from '../hooks/useData'
import {
  inWindow, monthlySeries, paid, pctChange, revenueByCategory, revenueByCity, short, sum, topCustomers, topProducts,
} from '../utils/analytics'
import { downloadCsv } from '../utils/csv'
import { CHART_COLORS } from '../utils/meta'
import { compactToman, cx, digits, fullName, num, toman } from '../utils/format'

const PERIODS = [3, 6, 12] as const

export default function Reports() {
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(6)
  const { data: sales, isLoading } = useList('sales')
  const { map: products } = useLookup('products')
  const { map: customers } = useLookup('customers')
  const { map: users } = useLookup('users')

  const days = months * 30
  const cur = useMemo(() => inWindow(sales, days), [sales, days])
  const prev = useMemo(() => inWindow(sales, days * 2, days), [sales, days])

  const kpi = useMemo(() => {
    const p = paid(cur)
    const pp = paid(prev)
    const cost = p.reduce((t, s) => t + s.items.reduce((c, it) => c + it.quantity * (products.get(it.productId)?.cost ?? it.price * 0.8), 0), 0)
    const revenue = sum(p)
    const prevRevenue = sum(pp)
    return {
      revenue, revenueDelta: pctChange(revenue, prevRevenue),
      profit: revenue - cost, margin: revenue ? ((revenue - cost) / revenue) * 100 : 0,
      orders: p.length, ordersDelta: pctChange(p.length, pp.length),
      aov: p.length ? revenue / p.length : 0, aovDelta: pctChange(p.length ? revenue / p.length : 0, pp.length ? prevRevenue / pp.length : 0),
    }
  }, [cur, prev, products])

  const series = useMemo(() => monthlySeries(sales, products, months), [sales, products, months])
  const byCategory = useMemo(() => revenueByCategory(cur, products), [cur, products])
  const byCity = useMemo(() => revenueByCity(cur, customers).slice(0, 6), [cur, customers])
  const byMethod = useMemo(() => {
    const m = new Map<string, number>()
    paid(cur).forEach((s) => m.set(s.paymentMethod, (m.get(s.paymentMethod) ?? 0) + s.total))
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [cur])
  const sellers = useMemo(() => {
    const rows = new Map<string, { revenue: number; orders: number }>()
    paid(cur).forEach((s) => {
      const r = rows.get(s.userId) ?? { revenue: 0, orders: 0 }
      r.revenue += s.total; r.orders += 1
      rows.set(s.userId, r)
    })
    return [...rows.entries()].map(([id, r]) => ({ user: users.get(id), ...r })).filter((r) => r.user).sort((a, b) => b.revenue - a.revenue)
  }, [cur, users])
  const top = useMemo(() => topProducts(cur, 6), [cur])
  const best = useMemo(() => topCustomers(cur, customers, 5), [cur, customers])
  const statusMix = useMemo(() => [
    { name: 'پرداخت‌شده', value: cur.filter((s) => s.status === 'paid').length, color: '#10b981' },
    { name: 'در انتظار', value: cur.filter((s) => s.status === 'pending').length, color: '#f59e0b' },
    { name: 'سررسید گذشته', value: cur.filter((s) => s.status === 'overdue').length, color: '#ef4444' },
    { name: 'لغو شده', value: cur.filter((s) => s.status === 'cancelled').length, color: '#94a3b8' },
  ], [cur])

  const maxSeller = Math.max(1, ...sellers.map((s) => s.revenue))
  const yTick = (v: number) => num(Math.round(v / 1e6))
  const exportReport = () =>
    downloadCsv(`nikan-report-${months}m.csv`, series.map((p) => ({ ماه: p.label, 'درآمد (تومان)': p.revenue, 'سود تخمینی (تومان)': Math.round(p.profit), 'تعداد سفارش': p.orders })))

  return (
    <>
      <PageHeader
        title="گزارش و تحلیل فروش"
        subtitle="عملکرد فروش، سودآوری و رفتار مشتریان"
        actions={<>
          <div className="join">
            {PERIODS.map((p) => (
              <button key={p} className={cx('btn btn-sm join-item', months === p && 'btn-primary')} onClick={() => setMonths(p)}>{num(p)} ماه</button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={exportReport}><Download className="size-4" /> اکسپورت گزارش</button>
        </>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="درآمد دوره" value={compactToman(kpi.revenue)} icon={Wallet} tone="primary" delta={kpi.revenueDelta} hint="نسبت به دوره قبل" loading={isLoading} />
        <StatCard title="سود ناخالص تخمینی" value={compactToman(kpi.profit)} icon={TrendingUp} tone="success" hint={`حاشیه سود ${digits(kpi.margin.toFixed(1))}٪`} loading={isLoading} />
        <StatCard title="تعداد سفارش" value={num(kpi.orders)} icon={ShoppingCart} tone="secondary" delta={kpi.ordersDelta} hint="نسبت به دوره قبل" loading={isLoading} />
        <StatCard title="میانگین ارزش سفارش" value={compactToman(kpi.aov)} icon={Receipt} tone="warning" delta={kpi.aovDelta} hint="نسبت به دوره قبل" loading={isLoading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ChartCard className="xl:col-span-8" title="درآمد و سود ماهانه" subtitle="میلیون تومان">
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series}>
                <CartesianGrid vertical={false} stroke={axisStyle.grid} strokeOpacity={0.1} />
                <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={axisStyle.tick} />
                <YAxis orientation="right" width={44} tickLine={false} axisLine={false} tick={axisStyle.tick} tickFormatter={yTick} />
                <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} content={<ChartTooltip format={(v, n) => (n === 'تعداد سفارش' ? num(v) : toman(v))} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, direction: 'rtl' }} />
                <Bar dataKey="revenue" name="درآمد" fill={CHART_COLORS[0]} radius={[8, 8, 0, 0]} maxBarSize={38} />
                <Line type="monotone" dataKey="profit" name="سود تخمینی" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-4" title="وضعیت فاکتورها" subtitle="تعداد فاکتور بر اساس وضعیت">
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} stroke="none">
                  {statusMix.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => `${num(v)} فاکتور`} />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, direction: 'rtl' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-4" title="فروش بر اساس دسته‌بندی" subtitle="میلیون تومان">
          <HBar data={byCategory} />
        </ChartCard>
        <ChartCard className="xl:col-span-4" title="فروش بر اساس شهر" subtitle="۶ شهر برتر (میلیون تومان)">
          <HBar data={byCity} />
        </ChartCard>
        <ChartCard className="xl:col-span-4" title="روش‌های پرداخت" subtitle="سهم از درآمد">
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius="80%" stroke="none">
                  {byMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => toman(v)} />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, direction: 'rtl' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card-surface p-5">
          <h2 className="mb-4 font-bold">عملکرد فروشندگان</h2>
          <ul className="space-y-4">
            {sellers.map(({ user, revenue, orders }, i) => (
              <li key={user!.id}>
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-base-content/40">{num(i + 1)}</span>
                  <Avatar name={user!.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user!.name}</p>
                    <p className="text-xs text-base-content/50">{num(orders)} سفارش</p>
                  </div>
                  <span className="text-sm font-bold">{compactToman(revenue)}</span>
                </div>
                <progress className="progress progress-primary mt-2 h-1.5" value={(revenue / maxSeller) * 100} max={100} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface overflow-hidden xl:col-span-2">
          <h2 className="p-5 pb-2 font-bold">پرفروش‌ترین محصولات</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>محصول</th><th>تعداد فروش</th><th>درآمد</th></tr></thead>
              <tbody>
                {top.map((p, i) => (
                  <tr key={p.name} className="hover:bg-base-200/50">
                    <td className="text-base-content/50">{num(i + 1)}</td>
                    <td className="font-medium">{short(p.name, 40)}</td>
                    <td>{num(p.qty)}</td>
                    <td className="whitespace-nowrap font-semibold">{compactToman(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-surface p-5 xl:col-span-3">
          <h2 className="mb-4 font-bold">مشتریان برتر دوره</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {best.map(({ customer, total }, i) => (
              <Link key={customer.id} to={`/customers/${customer.id}`} className="flex flex-col items-center gap-2 rounded-2xl border border-base-300/60 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
                <span className="relative">
                  <Avatar name={fullName(customer)} size="lg" />
                  <span className="absolute -end-1 -top-1 flex size-6 items-center justify-center rounded-full bg-warning text-xs font-black text-warning-content">{num(i + 1)}</span>
                </span>
                <p className="font-semibold">{fullName(customer)}</p>
                <p className="truncate text-xs text-base-content/50">{customer.company || customer.city}</p>
                <p className="text-sm font-extrabold text-primary">{compactToman(total)}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-base-content/40"><Percent className="size-3" /> سود بر اساس بهای تمام‌شده ثبت‌شده برای هر کالا محاسبه می‌شود.</p>
    </>
  )
}

/** Horizontal bar chart (RTL-friendly) for name/value rows. */
function HBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis type="number" hide reversed />
          <YAxis type="category" dataKey="name" orientation="right" width={96} tickLine={false} axisLine={false} tick={axisStyle.tick} tickFormatter={(v: string) => short(v, 14)} />
          <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} content={<ChartTooltip format={(v) => toman(v)} />} />
          <Bar dataKey="value" name="درآمد" radius={8} barSize={18}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
