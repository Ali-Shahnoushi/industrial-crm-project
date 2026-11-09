import type {
  ActivityType,
  CustomerScope,
  CustomerStatus,
  EventType,
  InventoryOperationType,
  InvoiceStatus,
  LeadStage,
  Priority,
  TaskStatus,
  TicketStatus,
  UserType,
} from '../types'

type Meta = { label: string; badge: string }

export const customerStatus: Record<CustomerStatus, Meta> = {
  active: { label: 'فعال', badge: 'badge-success' },
  vip: { label: 'ویژه', badge: 'badge-primary' },
  new: { label: 'جدید', badge: 'badge-info' },
  inactive: { label: 'غیرفعال', badge: 'badge-ghost' },
}

export const invoiceStatus: Record<InvoiceStatus, Meta> = {
  paid: { label: 'پرداخت‌شده', badge: 'badge-success' },
  pending: { label: 'در انتظار پرداخت', badge: 'badge-warning' },
  overdue: { label: 'سررسید گذشته', badge: 'badge-error' },
  cancelled: { label: 'لغو شده', badge: 'badge-ghost' },
}

export const ticketStatus: Record<TicketStatus, Meta> = {
  open: { label: 'باز', badge: 'badge-error' },
  pending: { label: 'در حال بررسی', badge: 'badge-warning' },
  resolved: { label: 'حل‌شده', badge: 'badge-success' },
  closed: { label: 'بسته', badge: 'badge-ghost' },
}

export const priority: Record<Priority, Meta> = {
  high: { label: 'بالا', badge: 'badge-error' },
  medium: { label: 'متوسط', badge: 'badge-warning' },
  low: { label: 'کم', badge: 'badge-info' },
}

export const taskStatus: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'در انتظار', color: 'bg-base-content/30' },
  'in-progress': { label: 'در حال انجام', color: 'bg-warning' },
  done: { label: 'انجام‌شده', color: 'bg-success' },
}

export const leadStages: { id: LeadStage; label: string; color: string }[] = [
  { id: 'new', label: 'جدید', color: 'bg-info' },
  { id: 'contacted', label: 'تماس گرفته شد', color: 'bg-secondary' },
  { id: 'proposal', label: 'ارسال پیشنهاد', color: 'bg-primary' },
  { id: 'negotiation', label: 'مذاکره', color: 'bg-warning' },
  { id: 'won', label: 'موفق', color: 'bg-success' },
  { id: 'lost', label: 'ازدست‌رفته', color: 'bg-error' },
]
export const stageProbability: Record<LeadStage, number> = {
  new: 12,
  contacted: 25,
  proposal: 45,
  negotiation: 70,
  won: 100,
  lost: 0,
}

export const eventType: Record<EventType, { label: string; dot: string; chip: string }> = {
  meeting: { label: 'جلسه', dot: 'bg-primary', chip: 'bg-primary/15 text-primary' },
  call: { label: 'تماس', dot: 'bg-info', chip: 'bg-info/15 text-info' },
  deadline: { label: 'سررسید', dot: 'bg-error', chip: 'bg-error/15 text-error' },
  reminder: { label: 'یادآوری', dot: 'bg-warning', chip: 'bg-warning/20 text-warning-content' },
}

export const activityType: Record<ActivityType, { label: string }> = {
  call: { label: 'تماس' },
  meeting: { label: 'جلسه' },
  email: { label: 'ایمیل' },
  note: { label: 'یادداشت' },
}

export const roleLabel: Record<string, string> = {
  admin: 'مدیر سیستم',
  administrator: 'مدیر ارشد',
  manager: 'مدیر / سرپرست',
  salesperson: 'کارمند فروش',
  installer: 'نصاب',
  sales: 'فروش',
  support: 'پشتیبانی',
  warehouse: 'انبار',
  finance: 'مالی',
  marketing: 'بازاریابی',
}

export const userTypeMeta: Record<
  UserType,
  { label: string; description: string; badgeClass: string }
> = {
  administrator: {
    label: 'مدیر ارشد',
    description: 'دسترسی کامل به کل سامانه، کارمندان، برندینگ و ارتقای دیتابیس',
    badgeClass:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  manager: {
    label: 'مدیر / سرپرست',
    description: 'مدیریت عملیاتی مشتریان، انبار دستگاه‌ها و گزارش‌های سامانه',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  },
  salesperson: {
    label: 'کارمند فروش',
    description: 'ثبت مشتری، پیگیری فروش و تخصیص دستگاه (پیش‌فرض: مشتریان خودش)',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  installer: {
    label: 'نصاب',
    description: 'مشاهده دستگاه‌های مشتریان، ثبت تحویل/نصب و سوابق سرویس و تعمیرات',
    badgeClass:
      'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  },
}

export const customerScopeMeta: Record<
  CustomerScope,
  { label: string; description: string; badgeClass: string }
> = {
  own: {
    label: 'مشتریان خودش + اشتراکی',
    description: 'فقط مشتریانی که خودش ثبت کرده به علاوه مشتریان کارمندان/موارد انتخاب‌شده در زیر',
    badgeClass: 'badge-warning badge-soft',
  },
  selected: {
    label: 'فقط مشتریان انتخاب‌شده',
    description: 'صرفاً مشتریانِ کارمندان انتخاب‌شده یا مشتریان تکی که مستقیماً تعیین شده‌اند',
    badgeClass: 'badge-info badge-soft',
  },
  all: {
    label: 'همه مشتریان سامانه',
    description: 'مشاهده و دسترسی به تمامی پرونده‌های مشتریان ثبت‌شده در سیستم',
    badgeClass: 'badge-success badge-soft',
  },
}

export const inventoryTypeMeta: Record<
  InventoryOperationType,
  { label: string; badgeClass: string; sign: '+' | '-' }
> = {
  in: {
    label: 'ورود به انبار',
    badgeClass: 'badge-success badge-soft',
    sign: '+',
  },
  out_manual: {
    label: 'خروج دستی از انبار',
    badgeClass: 'badge-warning badge-soft',
    sign: '-',
  },
  out_assign: {
    label: 'خروج بابت تخصیص به مشتری',
    badgeClass: 'badge-error badge-soft',
    sign: '-',
  },
  return: {
    label: 'بازگشت به انبار',
    badgeClass: 'badge-info badge-soft',
    sign: '+',
  },
}

export const PAYMENT_METHODS = ['کارت به کارت', 'پوز فروشگاهی', 'چک', 'نقدی', 'پرداخت اینترنتی']
export const CITIES = ['تهران', 'اصفهان', 'شیراز', 'مشهد', 'تبریز', 'کرج', 'اهواز', 'قم', 'رشت', 'یزد', 'کرمان', 'ارومیه', 'ساری', 'همدان']
export const SOURCES = ['وب‌سایت', 'معرفی مشتری', 'نمایشگاه', 'اینستاگرام', 'تماس سرد', 'تبلیغات گوگل']
export const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
