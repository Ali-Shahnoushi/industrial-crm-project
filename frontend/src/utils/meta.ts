import type { CustomerScope, InventoryOperationType, UserType } from '../types'

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
