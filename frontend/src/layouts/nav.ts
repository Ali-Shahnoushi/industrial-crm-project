import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  Cpu,
  Database,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Palette,
  Receipt,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import type { SystemFeatureKey } from '../types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string | number
  permission?: string | string[]
  feature?: SystemFeatureKey
  end?: boolean
}

export interface NavGroup {
  title?: string
  items: NavItem[]
}

export const MAIN_NAV: NavGroup[] = [
  {
    items: [{ to: '/', label: 'داشبورد مدیریت', icon: LayoutDashboard }],
  },
  {
    title: 'مشتریان و دستگاه‌ها',
    items: [
      { to: '/customers', label: 'مدیریت مشتریان', icon: Users, permission: 'customers.view' },
      { to: '/parts', label: 'کاتالوگ دستگاه‌ها', icon: Cpu, permission: 'parts.view', feature: 'parts' },
      { to: '/inventory', label: 'انبار و کاردکس موجودی', icon: Boxes, permission: 'parts.view', feature: 'parts' },
    ],
  },
  {
    title: 'فروش و مالی',
    items: [
      { to: '/sales', label: 'فروش و گزارش‌ها', icon: TrendingUp, permission: 'sales.view', feature: 'sales' },
      { to: '/finance', label: 'مالی و فاکتورها', icon: Receipt, permission: 'sales.view', feature: 'sales' },
    ],
  },
  {
    title: 'پشتیبانی و ارتباطات',
    items: [
      { to: '/tickets', label: 'تیکت‌ها و درخواست تعمیر', icon: LifeBuoy, permission: 'tickets.view', feature: 'tickets' },
      { to: '/sms', label: 'سامانه پیامک (ملی‌پیامک)', icon: MessageSquare, permission: ['sms.send', 'sms.logs'], feature: 'sms' },
    ],
  },
]

export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings/ticketing', label: 'تیکتینگ و دپارتمان‌ها', icon: LifeBuoy, permission: 'settings.manage', feature: 'tickets' },
  { to: '/settings/sms', label: 'سامانه ملی‌پیامک', icon: MessageSquare, permission: 'settings.manage', feature: 'sms' },
  { to: '/settings/users', label: 'کارمندان، نقش‌ها و دسترسی‌ها', icon: ShieldCheck, permission: ['users.manage', 'users.sessions'] },
  { to: '/settings/backup', label: 'پشتیبان‌گیری و بازیابی داده‌ها', icon: Database, permission: 'settings.manage', feature: 'backup' },
  { to: '/settings/profile', label: 'پروفایل کاربری من', icon: User },
  { to: '/settings/system', label: 'تنظیمات سیستم و پوسته', icon: Palette },
]
