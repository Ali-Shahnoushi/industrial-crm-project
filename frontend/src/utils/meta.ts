import type {
  AssignmentStrategy,
  CustomerScope,
  InventoryOperationType,
  TicketPriority,
  TicketStatus,
  TicketType,
  UserType,
} from '../types'

export const roleLabel: Record<string, string> = {
  admin: 'مدیر سیستم',
  administrator: 'مدیر ارشد',
  manager: 'مدیر / سرپرست',
  salesperson: 'کارمند فروش',
  installer: 'نصاب',
  customer: 'مشتری (پنل کاربری)',
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
    description: 'مدیریت عملیاتی مشتریان، انبار دستگاه‌ها، تیکت‌ها و گزارش‌های سامانه',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  },
  salesperson: {
    label: 'کارمند فروش',
    description: 'ثبت مشتری، پیگیری فروش، ارتباط با مشتریان و تخصیص دستگاه',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  installer: {
    label: 'نصاب',
    description: 'مشاهده دستگاه‌های مشتریان، ثبت تحویل/نصب، پاسخگویی تیکت فنی و تعمیرات',
    badgeClass:
      'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
  },
  customer: {
    label: 'مشتری (پنل کاربری)',
    description: 'دسترسی ایزوله به پنل اختصاصی مشتری، مشاهده دستگاه‌ها و ثبت درخواست تعمیر',
    badgeClass:
      'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
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
  { label: string; badgeClass: string; sign: '+' | '-' | '=' }
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
  adjustment: {
    label: 'انبارگردانی (تنظیم دقیق)',
    badgeClass: 'badge-secondary badge-soft',
    sign: '=',
  },
}

export const ticketStatusMeta: Record<TicketStatus, { label: string; badgeClass: string }> = {
  open: {
    label: 'جدید (منتظر بررسی)',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
  },
  customer_reply: {
    label: 'پاسخ مشتری',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30',
  },
  in_progress: {
    label: 'در دست اقدام فنی',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30',
  },
  answered: {
    label: 'پاسخ داده شده',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
  },
  resolved: {
    label: 'رفع‌شده / تکمیل سرویس',
    badgeClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30',
  },
  closed: {
    label: 'بسته شده',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/25',
  },
}

export const ticketPriorityMeta: Record<TicketPriority, { label: string; badgeClass: string }> = {
  low: {
    label: 'عادی',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  medium: {
    label: 'متوسط',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  high: {
    label: 'مهم',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  urgent: {
    label: 'فوری (توقف دستگاه)',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-extrabold',
  },
}

export const ticketTypeMeta: Record<TicketType, { label: string; badgeClass: string }> = {
  repair_request: {
    label: 'اعلام خرابی و درخواست تعمیر',
    badgeClass: 'badge-error badge-soft',
  },
  technical_support: {
    label: 'پشتیبانی فنی و کالیبراسیون',
    badgeClass: 'badge-info badge-soft',
  },
  sales_inquiry: {
    label: 'ارتباط با واحد فروش پروژه',
    badgeClass: 'badge-primary badge-soft',
  },
  general: {
    label: 'سوال و پیگیری عمومی',
    badgeClass: 'badge-ghost',
  },
}

export const assignmentStrategyMeta: Record<
  AssignmentStrategy,
  { label: string; shortLabel: string; description: string }
> = {
  round_robin: {
    label: 'توزیع نوبتی چرخشی (Round-Robin)',
    shortLabel: 'نوبتی (Round-Robin)',
    description: 'تیکت‌ها به ترتیب نوبت عادلانه بین کارشناسان فعال دپارتمان تقسیم می‌شوند.',
  },
  least_loaded: {
    label: 'کمترین تیکت فعال (Least-Loaded)',
    shortLabel: 'کمترین تیکت باز',
    description: 'تیکت جدید به کارشناسی داده می‌شود که در لحظه کمترین تیکت باز را دارد.',
  },
  random: {
    label: 'توزیع تصادفی (Random)',
    shortLabel: 'تصادفی (Random)',
    description: 'تیکت جدید به صورت تصادفی به یکی از نیروهای فعال دپارتمان ارجاع می‌شود.',
  },
}

export const saleStatusMeta: Record<
  'draft' | 'confirmed' | 'cancelled',
  { label: string; badgeClass: string }
> = {
  confirmed: {
    label: 'تایید شده',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  draft: {
    label: 'پیش‌نویس',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  cancelled: {
    label: 'لغو شده',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
}

export const paymentStatusMeta: Record<
  'unpaid' | 'partial' | 'paid',
  { label: string; badgeClass: string }
> = {
  paid: {
    label: 'پرداخت کامل',
    badgeClass: 'badge-success badge-soft',
  },
  partial: {
    label: 'پرداخت جزئی',
    badgeClass: 'badge-warning badge-soft',
  },
  unpaid: {
    label: 'پرداخت‌نشده',
    badgeClass: 'badge-error badge-soft',
  },
}

export const invoiceStatusMeta: Record<
  'issued' | 'paid' | 'void',
  { label: string; badgeClass: string }
> = {
  issued: {
    label: 'صادر شده',
    badgeClass: 'badge-info badge-soft',
  },
  paid: {
    label: 'تسویه‌شده',
    badgeClass: 'badge-success badge-soft',
  },
  void: {
    label: 'باطل‌شده',
    badgeClass: 'badge-error badge-soft',
  },
}
