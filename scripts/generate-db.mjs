/**
 * Generates db.json (the json-server database) with realistic Persian demo data.
 * Deterministic (seeded RNG) so every run produces the same dataset.
 * Dates are generated relative to "today" so the demo always looks fresh.
 *
 *   npm run seed
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let seed = 20261007
const rnd = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (a, b) => Math.floor(rnd() * (b - a + 1)) + a
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const chance = (p) => rnd() < p
const pad = (n, l = 3) => String(n).padStart(l, '0')
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v
  }
  return pairs[0][0]
}
const sample = (arr, n) => {
  const copy = [...arr]
  const out = []
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0])
  return out
}

const NOW = new Date()
const at = (dayOffset, h = int(8, 17), m = pick([0, 15, 30, 45])) => {
  const x = new Date(NOW)
  x.setDate(x.getDate() + dayOffset)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}
const daysAgo = (d, h, m) => at(-d, h, m)

/* ------------------------------------------------------------------ users */
const users = [
  ['u-1', 'علی حسینی', 'admin', 'مدیر ارشد', 'admin', 'online'],
  ['u-2', 'مریم رضایی', 'maryam.rezaei', 'سرپرست فروش', 'manager', 'online'],
  ['u-3', 'امیر کاظمی', 'amir.kazemi', 'کارشناس فروش', 'sales', 'online'],
  ['u-4', 'نرگس موسوی', 'narges.mousavi', 'کارشناس فروش', 'sales', 'away'],
  ['u-5', 'حسین بهرامی', 'hossein.bahrami', 'مسئول انبار', 'warehouse', 'offline'],
  ['u-6', 'الهام صادقی', 'elham.sadeghi', 'پشتیبان مشتریان', 'support', 'online'],
  ['u-7', 'پوریا نظری', 'pouria.nazari', 'مدیر مالی', 'finance', 'offline'],
  ['u-8', 'سمیرا اکبری', 'samira.akbari', 'کارشناس بازاریابی', 'marketing', 'away'],
].map(([id, name, handle, title, role, presence], i) => ({
  id,
  name,
  email: `${handle}@nikan.ir`,
  password: '123456',
  title,
  role,
  presence,
  phone: `0912${int(1000000, 9999999)}`,
  joinedAt: daysAgo(400 - i * 30),
}))
const salesUsers = ['u-2', 'u-3', 'u-4']

/* -------------------------------------------------------------- customers */
const FIRST = [
  ['علی', 'ali'], ['محمد', 'mohammad'], ['رضا', 'reza'], ['حسین', 'hossein'], ['مهدی', 'mahdi'],
  ['امیر', 'amir'], ['سعید', 'saeed'], ['کامران', 'kamran'], ['بهزاد', 'behzad'], ['پیمان', 'peyman'],
  ['سارا', 'sara'], ['مریم', 'maryam'], ['فاطمه', 'fatemeh'], ['زهرا', 'zahra'], ['نگین', 'negin'],
  ['الناز', 'elnaz'], ['شیرین', 'shirin'], ['مینا', 'mina'], ['لیلا', 'leila'], ['پریسا', 'parisa'],
  ['نسترن', 'nastaran'], ['آرزو', 'arezoo'],
]
const LAST = [
  ['محمدی', 'mohammadi'], ['احمدی', 'ahmadi'], ['رضایی', 'rezaei'], ['حسینی', 'hosseini'], ['کریمی', 'karimi'],
  ['موسوی', 'mousavi'], ['جعفری', 'jafari'], ['صادقی', 'sadeghi'], ['نوری', 'nouri'], ['قاسمی', 'ghasemi'],
  ['اکبری', 'akbari'], ['یوسفی', 'yousefi'], ['فرهادی', 'farhadi'], ['رحیمی', 'rahimi'], ['زارعی', 'zarei'],
  ['مرادی', 'moradi'], ['شریفی', 'sharifi'], ['طاهری', 'taheri'], ['عباسی', 'abbasi'], ['سلطانی', 'soltani'],
  ['بهرامی', 'bahrami'], ['کاظمی', 'kazemi'], ['امینی', 'amini'], ['تقوی', 'taghavi'],
]
const COMPANIES = [
  ['شرکت فناوری پارس', 'parsfanavar'], ['گروه صنعتی البرز', 'alborzgroup'], ['داده‌پردازان آریا', 'ariadata'],
  ['نوآوران شریف', 'sharifnovin'], ['کیان الکترونیک', 'kianelec'], ['آرتا تجارت', 'artatejarat'],
  ['سپهر ارتباط', 'sepehrertebat'], ['پیشگامان رایان', 'pishgamanrayan'], ['تدبیر سامانه', 'tadbirsamaneh'],
  ['بهین‌رایانه', 'behinrayaneh'], ['مهرگان صنعت', 'mehregansanat'], ['ماهان نرم‌افزار', 'mahansoft'],
  ['دیجی‌تجارت آسیا', 'digitejarat'], ['سروش شبکه', 'soroushnet'], ['آسمان‌گستر', 'asemangostar'],
  ['فرادید ایرانیان', 'faradid'], ['پویا الکترونیک', 'pouyaelec'], ['زرین‌پارت', 'zarinpart'],
  ['آوا سیستم', 'avasystem'], ['هیراد تجارت', 'hiradtrade'], ['نگین شمال', 'neginshomal'],
  ['رهیافت داده', 'rahyaftdata'], ['برنا ماشین', 'bornamachine'], ['کوروش پخش', 'koroushpakhsh'],
]
const CITIES = [
  ['تهران', 10], ['اصفهان', 4], ['شیراز', 4], ['مشهد', 4], ['تبریز', 3], ['کرج', 3], ['اهواز', 2],
  ['قم', 2], ['رشت', 2], ['یزد', 1], ['کرمان', 1], ['ارومیه', 1], ['ساری', 1], ['همدان', 1],
]
const STREETS = ['ولیعصر', 'شریعتی', 'مطهری', 'کارگر', 'آزادی', 'انقلاب', 'فردوسی', 'چهارباغ', 'زند', 'امام خمینی', 'بهار', 'گلستان']
const TAGS = ['وفادار', 'عمده‌فروش', 'خرده‌فروش', 'سازمانی', 'نیازمند پیگیری', 'تخفیف‌دار', 'پرمشتری']
const SOURCES = ['وب‌سایت', 'معرفی مشتری', 'نمایشگاه', 'اینستاگرام', 'تماس سرد', 'تبلیغات گوگل']
const NOTES = [
  'ترجیح می‌دهد تماس‌ها در ساعات صبح انجام شود.',
  'به محصولات سازمانی و خرید عمده علاقه‌مند است.',
  'پرداخت‌ها معمولاً به‌صورت چک و بازه ۳۰ روزه انجام می‌شود.',
  'برای خرید بعدی منتظر ارائه پیش‌فاکتور است.',
  'مشتری حساس به قیمت؛ پیشنهاد تخفیف حجمی داده شود.',
  'سابقه همکاری عالی و پرداخت به‌موقع.',
  'نیازمند پشتیبانی فنی بیشتر پس از فروش.',
  '',
]

const customers = Array.from({ length: 64 }, (_, i) => {
  const [fn, fnEn] = pick(FIRST)
  const [ln, lnEn] = pick(LAST)
  const type = chance(0.45) ? 'company' : 'individual'
  const [companyName, domain] = pick(COMPANIES)
  const status = weighted([['active', 50], ['vip', 14], ['new', 16], ['inactive', 20]])
  return {
    id: `cus-${pad(i + 1)}`,
    firstName: fn,
    lastName: ln,
    type,
    company: type === 'company' ? companyName : '',
    email: type === 'company' ? `${fnEn}.${lnEn}@${domain}.ir` : `${fnEn}.${lnEn}${int(1, 99)}@gmail.com`,
    phone: `09${pick(['12', '91', '35', '36', '19', '30'])}${int(1000000, 9999999)}`,
    city: weighted(CITIES),
    address: `خیابان ${pick(STREETS)}، پلاک ${int(1, 120)}`,
    status,
    source: pick(SOURCES),
    tags: sample(TAGS, int(0, 2)),
    assignedTo: pick(salesUsers),
    notes: pick(NOTES),
    createdAt: daysAgo(status === 'new' ? int(1, 25) : int(30, 430)),
    lastContact: daysAgo(status === 'inactive' ? int(60, 160) : int(0, 40)),
    totalSpent: 0,
    ordersCount: 0,
  }
})

/* --------------------------------------------------------------- products */
const WAREHOUSES = ['انبار مرکزی تهران', 'انبار شمال (ساری)', 'انبار جنوب (شیراز)']
const productSeed = [
  ['لپ‌تاپ ایسوس ZenBook 14', 'لپ‌تاپ و رایانه', 62000000, 51000000],
  ['لپ‌تاپ لنوو ThinkPad E15', 'لپ‌تاپ و رایانه', 54000000, 44500000],
  ['مینی‌پی‌سی اینتل NUC', 'لپ‌تاپ و رایانه', 31000000, 25000000],
  ['مانیتور ۲۷ اینچ ال‌جی 4K', 'لپ‌تاپ و رایانه', 19500000, 15800000],
  ['کیس گیمینگ حرفه‌ای', 'لپ‌تاپ و رایانه', 28000000, 22400000],
  ['روتر مایکروتیک RB4011', 'شبکه', 9800000, 7600000],
  ['سوییچ ۲۴ پورت سیسکو', 'شبکه', 38000000, 31000000],
  ['اکسس‌پوینت یوبیکوییتی U6', 'شبکه', 8400000, 6700000],
  ['کابل شبکه CAT6 رول ۳۰۵ متری', 'شبکه', 6200000, 4900000],
  ['فایروال فورتی‌گیت 60F', 'شبکه', 45000000, 37000000],
  ['کیبورد مکانیکی لاجیتک', 'لوازم جانبی', 3600000, 2700000],
  ['ماوس بی‌سیم لاجیتک MX Master', 'لوازم جانبی', 4800000, 3700000],
  ['هدست بی‌سیم جبرا', 'لوازم جانبی', 7200000, 5600000],
  ['وب‌کم ۴K رپتور', 'لوازم جانبی', 3900000, 2900000],
  ['هاب USB-C هفت‌پورت', 'لوازم جانبی', 1900000, 1300000],
  ['پرینتر لیزری HP LaserJet', 'چاپ و اداری', 14500000, 11700000],
  ['کارتریج اورجینال HP 17A', 'چاپ و اداری', 2400000, 1800000],
  ['کاغذ A4 کارتن ۵ بسته‌ای', 'چاپ و اداری', 1850000, 1500000],
  ['اسکنر اسنوی فوجیتسو', 'چاپ و اداری', 22000000, 17900000],
  ['SSD سامسونگ ۱ ترابایت', 'ذخیره‌سازی', 6800000, 5400000],
  ['هارد اکسترنال وسترن ۴TB', 'ذخیره‌سازی', 8900000, 7200000],
  ['فلش مموری ۱۲۸ گیگ سن‌دیسک', 'ذخیره‌سازی', 1250000, 880000],
  ['NAS سینولوژی DS923+', 'ذخیره‌سازی', 52000000, 43000000],
  ['لایسنس آنتی‌ویروس سازمانی (۱ ساله)', 'نرم‌افزار و لایسنس', 5400000, 3800000],
  ['لایسنس Microsoft 365 Business', 'نرم‌افزار و لایسنس', 7800000, 6200000],
  ['لایسنس نرم‌افزار حسابداری سازمانی', 'نرم‌افزار و لایسنس', 15000000, 9500000],
  ['دوربین مداربسته IP هایک‌ویژن', 'امنیت و نظارت', 5600000, 4300000],
  ['دستگاه حضور و غیاب بیومتریک', 'امنیت و نظارت', 9200000, 7300000],
]
const products = productSeed.map(([name, category, price, cost], i) => {
  const minStock = int(4, 15)
  const roll = rnd()
  const stock = roll < 0.08 ? 0 : roll < 0.28 ? int(1, minStock) : int(minStock + 4, 90)
  return {
    id: `prd-${pad(i + 1)}`,
    sku: `NK-${1001 + i}`,
    name,
    category,
    price,
    cost,
    stock,
    minStock,
    unit: category === 'نرم‌افزار و لایسنس' ? 'لایسنس' : category === 'چاپ و اداری' && name.includes('کاغذ') ? 'کارتن' : 'عدد',
    warehouse: pick(WAREHOUSES),
    supplier: pick(['پخش رایان‌سازان', 'تجارت الکترونیک ایران', 'واردات نوین‌تک', 'شرکت داده‌گستر', 'بازرگانی آریا']),
    createdAt: daysAgo(int(60, 420)),
  }
})

/* ------------------------------------------------------------------ sales */
const payMethods = ['کارت به کارت', 'پوز فروشگاهی', 'چک', 'نقدی', 'پرداخت اینترنتی']
const buyers = customers.filter((c) => c.status !== 'new')
const rawSales = []
const SALES_COUNT = 170
for (let i = 0; i < SALES_COUNT; i++) {
  const d = Math.floor(365 * Math.pow(rnd(), 1.5)) // recent days are denser => growth trend
  const customer = chance(0.93) ? pick(buyers) : pick(customers)
  const lines = sample(products, int(1, 4)).map((p) => {
    const qty = p.price > 20000000 ? int(1, 3) : p.price > 5000000 ? int(1, 6) : int(2, 20)
    return { productId: p.id, name: p.name, quantity: qty, price: p.price }
  })
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0)
  const discountPct = pick([0, 0, 0, 3, 5, 8, 10])
  const discount = Math.round((subtotal * discountPct) / 100 / 1000) * 1000
  const status = weighted([
    ['paid', d < 30 ? 62 : 82],
    ['pending', d < 30 ? 22 : 0],
    ['overdue', d >= 30 ? 8 : 0],
    ['cancelled', 8],
  ])
  rawSales.push({
    date: daysAgo(d),
    d,
    customerId: customer.id,
    userId: customer.assignedTo,
    status,
    paymentMethod: pick(payMethods),
    items: lines,
    discount,
    total: subtotal - discount,
  })
}
rawSales.sort((a, b) => new Date(a.date) - new Date(b.date))
const sales = rawSales.map(({ d, ...s }, i) => ({ id: `INV-${1001 + i}`, number: `INV-${1001 + i}`, ...s }))

for (const c of customers) {
  const paid = sales.filter((s) => s.customerId === c.id && s.status === 'paid')
  c.totalSpent = paid.reduce((sum, s) => sum + s.total, 0)
  c.ordersCount = paid.length
  if (paid.length) c.lastPurchase = paid[paid.length - 1].date
}

/* -------------------------------------------------------- stock movements */
const stockMovements = Array.from({ length: 46 }, (_, i) => {
  const p = pick(products)
  const type = weighted([['in', 40], ['out', 45], ['adjust', 15]])
  return {
    id: `mov-${pad(i + 1)}`,
    productId: p.id,
    type,
    quantity: type === 'adjust' ? int(1, 4) : int(2, 25),
    date: daysAgo(int(0, 60)),
    userId: 'u-5',
    note: type === 'in' ? 'ورود کالا از تأمین‌کننده' : type === 'out' ? `خروج بابت فاکتور ${pick(sales).id}` : 'اصلاح موجودی پس از انبارگردانی',
  }
}).sort((a, b) => new Date(b.date) - new Date(a.date))

/* ------------------------------------------------------------------ leads */
const STAGES = [
  ['new', 12], ['contacted', 25], ['proposal', 45], ['negotiation', 70], ['won', 100], ['lost', 0],
]
const LEAD_TITLES = [
  'تجهیز دفتر جدید', 'قرارداد شبکه سازمانی', 'خرید لایسنس نرم‌افزار', 'راه‌اندازی سالن سرور',
  'تأمین لپ‌تاپ برای تیم فروش', 'پروژه دوربین مداربسته', 'تجدید قرارداد پشتیبانی', 'خرید عمده تجهیزات جانبی',
]
const stageCounters = {}
const leads = Array.from({ length: 24 }, (_, i) => {
  const [fn] = pick(FIRST)
  const [ln] = pick(LAST)
  const [company] = pick(COMPANIES)
  const [stage, probability] = weighted([
    [STAGES[0], 5], [STAGES[1], 5], [STAGES[2], 5], [STAGES[3], 4], [STAGES[4], 3], [STAGES[5], 2],
  ])
  stageCounters[stage] = (stageCounters[stage] || 0) + 1
  return {
    id: `lead-${pad(i + 1)}`,
    title: pick(LEAD_TITLES),
    contactName: `${fn} ${ln}`,
    company,
    phone: `0912${int(1000000, 9999999)}`,
    value: int(8, 420) * 1000000,
    stage,
    probability,
    source: pick(SOURCES),
    assignedTo: pick(salesUsers),
    expectedClose: at(int(3, 45), 12, 0),
    createdAt: daysAgo(int(2, 50)),
    order: stageCounters[stage],
  }
})

/* ------------------------------------------------------------- activities */
const ACT = {
  call: ['تماس تلفنی پیگیری', 'تماس برای هماهنگی تحویل', 'تماس معرفی محصول جدید', 'تماس بررسی رضایت'],
  meeting: ['جلسه حضوری معرفی خدمات', 'جلسه بررسی پیش‌فاکتور', 'بازدید از محل مشتری'],
  email: ['ارسال کاتالوگ محصولات', 'ارسال پیش‌فاکتور', 'ارسال پیشنهاد قیمت ویژه'],
  note: ['ثبت یادداشت پس از مذاکره', 'به‌روزرسانی نیازمندی‌های مشتری', 'ثبت درخواست مشتری برای تخفیف'],
}
const activities = Array.from({ length: 90 }, (_, i) => {
  const type = pick(['call', 'call', 'meeting', 'email', 'note'])
  return {
    id: `act-${pad(i + 1)}`,
    customerId: pick(customers).id,
    type,
    title: pick(ACT[type]),
    description: pick([
      'مشتری تمایل به ادامه همکاری دارد.',
      'قرار شد هفته آینده مجدداً تماس گرفته شود.',
      'درخواست ارسال نمونه قیمت ثبت شد.',
      'موضوع به واحد مالی ارجاع داده شد.',
      'مشتری از کیفیت خدمات ابراز رضایت کرد.',
    ]),
    date: daysAgo(int(0, 75)),
    userId: pick(salesUsers),
  }
}).sort((a, b) => new Date(b.date) - new Date(a.date))

/* ------------------------------------------------------------------ tasks */
const TASK_TITLES = [
  'ارسال پیش‌فاکتور به شرکت فناوری پارس', 'پیگیری چک‌های برگشتی', 'تهیه گزارش فروش ماهانه',
  'تماس با مشتریان غیرفعال', 'بروزرسانی لیست قیمت محصولات', 'هماهنگی تحویل سفارش عمده',
  'انبارگردانی قفسه شبکه', 'آماده‌سازی ارائه برای جلسه هفته آینده', 'بررسی تیکت‌های باز پشتیبانی',
  'ثبت مشتریان نمایشگاه در سیستم', 'ارسال پیامک تبریک به مشتریان وی‌آی‌پی', 'مذاکره قرارداد سالانه با تأمین‌کننده',
  'بررسی رضایت‌سنجی مشتریان', 'تنظیم تخفیف‌های فصلی', 'پیگیری مطالبات معوق',
  'بازبینی سطح حداقل موجودی', 'طراحی کمپین ایمیلی', 'تهیه پیشنهاد قیمت پروژه دوربین',
]
const tasks = TASK_TITLES.map((title, i) => ({
  id: `task-${pad(i + 1)}`,
  title,
  description: 'جزئیات انجام کار با هماهنگی تیم مربوطه تکمیل شود.',
  status: weighted([['todo', 6], ['in-progress', 5], ['done', 6]]),
  priority: weighted([['high', 4], ['medium', 6], ['low', 3]]),
  dueDate: at(int(-4, 12), 17, 0),
  assignedTo: pick(users.slice(0, 8)).id,
  customerId: chance(0.5) ? pick(customers).id : null,
  createdAt: daysAgo(int(1, 15)),
}))

/* ----------------------------------------------------------------- events */
const EVENT_SEED = [
  ['جلسه معرفی محصول', 'meeting'], ['تماس پیگیری قرارداد', 'call'], ['دموی نرم‌افزار', 'meeting'],
  ['سررسید پرداخت فاکتور', 'deadline'], ['بازدید حضوری از دفتر مشتری', 'meeting'], ['یادآوری ارسال پیش‌فاکتور', 'reminder'],
  ['وبینار معرفی محصولات جدید', 'meeting'], ['جلسه مذاکره قیمت', 'meeting'], ['تماس رضایت‌سنجی', 'call'],
]
const events = [
  ...Array.from({ length: 22 }, (_, i) => {
    const [title, type] = pick(EVENT_SEED)
    const c = pick(customers)
    const start = at(int(-6, 26))
    return {
      id: `evt-${pad(i + 1)}`,
      title: type === 'deadline' || type === 'reminder' ? title : `${title} - ${c.company || c.lastName}`,
      type,
      start,
      end: new Date(new Date(start).getTime() + pick([30, 45, 60, 90]) * 60000).toISOString(),
      customerId: c.id,
      userId: pick(users.slice(0, 4)).id,
      location: type === 'meeting' ? pick(['دفتر مرکزی', 'دفتر مشتری', 'آنلاین (Google Meet)']) : '',
    }
  }),
  ...[1, 8, 15, 22].map((off, i) => ({
    id: `evt-w${i + 1}`,
    title: 'جلسه هفتگی تیم فروش',
    type: 'meeting',
    start: at(off - new Date(NOW).getDay() + 1, 9, 0),
    end: at(off - new Date(NOW).getDay() + 1, 10, 0),
    customerId: null,
    userId: 'u-2',
    location: 'اتاق جلسات',
  })),
]

/* ---------------------------------------------------------------- tickets */
const TICKETS = [
  ['عدم اتصال روتر پس از بروزرسانی فریمور', 'فنی'], ['درخواست صدور فاکتور رسمی', 'مالی'],
  ['خرابی هارد در دوره گارانتی', 'گارانتی'], ['راهنمایی نصب لایسنس', 'پشتیبانی'],
  ['تأخیر در تحویل سفارش', 'پشتیبانی'], ['افزودن قابلیت گزارش‌گیری سفارشی', 'درخواست قابلیت'],
  ['مغایرت مبلغ فاکتور با پیش‌فاکتور', 'مالی'], ['مشکل در شناسایی مانیتور', 'فنی'],
  ['درخواست مرجوعی کالا', 'گارانتی'], ['آموزش راه‌اندازی NAS', 'پشتیبانی'],
  ['قطع و وصل شدن اکسس‌پوینت', 'فنی'], ['استعلام وضعیت گارانتی لپ‌تاپ', 'گارانتی'],
  ['درخواست تمدید لایسنس', 'مالی'], ['خطای نصب درایور پرینتر', 'فنی'],
]
const tickets = TICKETS.map(([subject, category], i) => {
  const c = pick(customers)
  const created = int(0, 30)
  const status = weighted([['open', 5], ['pending', 4], ['resolved', 4], ['closed', 3]])
  const agent = pick(['u-6', 'u-6', 'u-3'])
  const messages = [
    { from: 'customer', text: `سلام، وقت بخیر. ${subject}. لطفاً راهنمایی بفرمایید.`, date: daysAgo(created, 10, 5) },
    ...(status !== 'open'
      ? [{ from: 'agent', text: 'سلام و احترام، مورد شما ثبت شد و در حال بررسی توسط تیم فنی است.', date: daysAgo(Math.max(created - 1, 0), 11, 20) }]
      : []),
    ...(status === 'resolved' || status === 'closed'
      ? [
          { from: 'customer', text: 'ممنون از پیگیری شما.', date: daysAgo(Math.max(created - 1, 0), 14, 0) },
          { from: 'agent', text: 'مشکل برطرف شد. در صورت نیاز مجدد در خدمت شما هستیم.', date: daysAgo(Math.max(created - 2, 0), 9, 40) },
        ]
      : []),
  ]
  return {
    id: `TKT-${2001 + i}`,
    number: `TKT-${2001 + i}`,
    subject,
    category,
    customerId: c.id,
    priority: weighted([['high', 3], ['medium', 6], ['low', 4]]),
    status,
    assignedTo: agent,
    createdAt: daysAgo(created, 10, 5),
    messages,
  }
}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

/* ------------------------------------------------------------------- chat */
const rooms = [
  { id: 'room-group', name: 'تیم فروش', type: 'group', members: ['u-1', 'u-2', 'u-3', 'u-4', 'u-8'], unread: 3 },
  ...['u-2', 'u-3', 'u-4', 'u-5', 'u-6', 'u-7'].map((uid, i) => ({
    id: `room-dm-${uid}`,
    name: users.find((u) => u.id === uid).name,
    type: 'dm',
    members: ['u-1', uid],
    unread: i === 0 ? 2 : i === 3 ? 1 : 0,
  })),
]
const SCRIPTS = {
  'room-group': [
    ['u-2', 'سلام تیم، هدف فروش این ماه ۱۲٪ بیشتر از ماه قبله 💪'],
    ['u-3', 'سلام. من دو تا پیش‌فاکتور بزرگ در مرحله مذاکره دارم.'],
    ['u-4', 'منم با سه تا مشتری جدید جلسه دارم، گزارشش رو شنبه می‌فرستم.'],
    ['u-1', 'عالیه! لطفاً لیدها رو تو کاریز فروش بروز نگه دارید.'],
    ['u-8', 'کمپین ایمیلی هفته آینده آماده‌ست، لیست مشتریان وی‌آی‌پی رو لازم دارم.'],
    ['u-2', 'لیست رو تا فردا از بخش مشتریان اکسپورت می‌کنم.'],
    ['u-3', 'یادتون نره جلسه هفتگی فردا ساعت ۹ صبحه 🕘'],
  ],
  'room-dm-u-2': [
    ['u-1', 'مریم جان، گزارش فروش هفته رو آماده کردی؟'],
    ['u-2', 'بله، همین الان تو بخش گزارش‌ها بروزرسانی کردم.'],
    ['u-1', 'ممنون. فروش گروه صنعتی البرز چطور پیش میره؟'],
    ['u-2', 'پیش‌فاکتور رو فرستادیم، منتظر تایید مدیرعامل‌شونن.'],
    ['u-2', 'فردا ساعت ۱۰ هم تماس پیگیری دارم.'],
  ],
  'room-dm-u-3': [
    ['u-3', 'سلام آقای حسینی، مشتری تخفیف ۱۰ درصدی برای خرید عمده می‌خواد.'],
    ['u-1', 'تا ۸ درصد اوکیه، بیشتر از اون با مدیر مالی هماهنگ کن.'],
    ['u-3', 'چشم، ممنون.'],
  ],
  'room-dm-u-4': [
    ['u-1', 'نرگس خانم، لیدهای نمایشگاه رو ثبت کردی؟'],
    ['u-4', 'بله، ۱۲ تا لید جدید ثبت شد و به کاریز فروش اضافه کردم.'],
    ['u-1', 'عالی 👏'],
    ['u-4', 'فقط چند تاشون نیاز به پیگیری فوری دارن.'],
  ],
  'room-dm-u-5': [
    ['u-5', 'سلام، موجودی ماوس MX Master به حداقل رسیده.'],
    ['u-1', 'سفارش خرید ثبت کنید، ۴۰ عدد.'],
    ['u-5', 'باشه، همین امروز به تأمین‌کننده اعلام می‌کنم.'],
  ],
  'room-dm-u-6': [
    ['u-6', 'سلام. سه تیکت فنی باز داریم که اولویت بالا دارن.'],
    ['u-1', 'لطفاً امروز بررسی و به مشتریان اطلاع بدید.'],
    ['u-6', 'حتماً، تا عصر جواب می‌دم.'],
  ],
  'room-dm-u-7': [
    ['u-7', 'فاکتورهای معوق این ماه رو برای پیگیری فرستادم.'],
    ['u-1', 'دریافت شد، ممنون پوریا.'],
  ],
}
const messages = []
for (const [roomId, lines] of Object.entries(SCRIPTS)) {
  lines.forEach(([senderId, text], i) => {
    messages.push({
      id: `msg-${pad(messages.length + 1, 4)}`,
      roomId,
      senderId,
      text,
      date: at(-(lines.length - i) > -3 ? 0 : -1, 8 + Math.min(i, 8), (i * 7) % 60),
    })
  })
}
messages.sort((a, b) => new Date(a.date) - new Date(b.date))

/* ---------------------------------------------------------- notifications */
const lowStock = products.filter((p) => p.stock <= p.minStock).slice(0, 2)
const overdue = sales.filter((s) => s.status === 'overdue').slice(-1)
const notifications = [
  { type: 'lead', title: 'لید جدید به شما اختصاص یافت', description: leads[0].title, link: '/pipeline', minutes: 12 },
  ...lowStock.map((p) => ({ type: 'stock', title: 'هشدار موجودی کم', description: `${p.name} (${p.stock} ${p.unit})`, link: '/inventory', minutes: 55 })),
  ...overdue.map((s) => ({ type: 'invoice', title: 'فاکتور سررسیدشده', description: `فاکتور ${s.id} نیاز به پیگیری دارد`, link: '/sales', minutes: 180 })),
  { type: 'ticket', title: 'تیکت جدید ثبت شد', description: tickets[0].subject, link: '/tickets', minutes: 300 },
  { type: 'task', title: 'سررسید وظیفه امروز', description: 'تهیه گزارش فروش ماهانه', link: '/tasks', minutes: 520 },
  { type: 'system', title: 'به نیکان خوش آمدید 👋', description: 'برای شروع، داشبورد را بررسی کنید.', link: '/', minutes: 1500 },
].map((n, i) => ({
  id: `ntf-${pad(i + 1)}`,
  userId: 'u-1',
  type: n.type,
  title: n.title,
  description: n.description,
  link: n.link,
  read: i > 3,
  date: new Date(NOW.getTime() - n.minutes * 60000).toISOString(),
}))

/* ------------------------------------------------------------------ write */
const db = { users, customers, leads, products, stockMovements, sales, activities, tasks, events, tickets, rooms, messages, notifications }
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'db.json')
writeFileSync(out, JSON.stringify(db, null, 2))
console.log(
  `db.json written: ${Object.entries(db).map(([k, v]) => `${k}=${v.length}`).join(', ')}`,
)
