import type { LucideIcon } from 'lucide-react'
import {
  Cpu,
  Database,
  LayoutDashboard,
  MessageSquare,
  Palette,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  permission?: string | string[]
  external?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const MAIN_NAV: NavGroup[] = [
  {
    title: 'اصلی',
    items: [
      { to: '/', label: 'داشبورد مدیریت', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'مشتریان و دستگاه‌ها',
    items: [
      { to: '/customers', label: 'مدیریت مشتریان', icon: Users, permission: 'customers.view' },
      { to: '/parts', label: 'کاتالوگ و انبار دستگاه‌ها', icon: Cpu, permission: 'parts.view' },
    ],
  },
  {
    title: 'ارتباطات و پیام‌رسانی',
    items: [
      { to: '/sms', label: 'سامانه پیامک (ملی‌پیامک)', icon: MessageSquare, permission: ['sms.send', 'sms.logs'] },
    ],
  },
]

export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings/sms', label: 'سامانه ملی‌پیامک', icon: MessageSquare, permission: 'settings.manage' },
  { to: '/settings/users', label: 'کارمندان، نقش‌ها و دسترسی‌ها', icon: ShieldCheck, permission: 'users.manage' },
  { to: '/settings/backup', label: 'پشتیبان‌گیری و بازیابی داده‌ها', icon: Database, permission: 'settings.manage' },
  { to: '/settings/profile', label: 'پروفایل کاربری من', icon: User },
  { to: '/settings/system', label: 'تنظیمات سیستم و پوسته', icon: Palette },
]
