import type { Customer, CustomerPart, Part, User } from './index'

export type SaleStatus = 'draft' | 'confirmed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type InvoiceStatus = 'issued' | 'paid' | 'void'

export interface SaleItem {
  id: number
  sale_id: number
  part_id: number
  customer_part_id?: number | null
  quantity: number
  unit_price: number
  discount_amount: number
  line_total: number
  part?: Part | null
  customer_part?: CustomerPart | null
}

export interface Invoice {
  id: number
  sale_id: number
  number: string
  jalali_year: number
  sequence_number: number
  issued_at: string
  due_at?: string | null
  status: InvoiceStatus
  notes?: string | null
  created_by_user_id?: number | null
  created_at?: string
  sale?: Sale | null
  creator?: Pick<User, 'id' | 'name'> | null
}

export interface Sale {
  id: number
  customer_id: number
  user_id?: number | null
  sale_date: string
  status: SaleStatus
  payment_status: PaymentStatus
  subtotal: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  total: number
  paid_amount: number
  notes?: string | null
  deleted_at?: string | null
  created_at?: string
  updated_at?: string
  customer?: Customer | null
  seller?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
    user_type?: string
    avatar_url?: string | null
  } | null
  items?: SaleItem[]
  active_invoice?: Invoice | null
  invoices?: Invoice[]
}

export interface SalesSummary {
  period: {
    from: string
    to: string
  }
  total_revenue: number
  revenue_delta_pct: number
  sales_count: number
  sales_count_delta_pct: number
  average_order_value: number
  unpaid_amount: number
  conversion_rate: number
  conversion_delta_pct: number
  converting_customers_count: number
  total_customers_count: number
  top_salesperson: {
    user_id: number
    name: string
    total_revenue: number
    sales_count: number
  } | null
  top_part: {
    part_id: number
    name: string
    code: string
    total_quantity: number
    total_revenue: number
  } | null
}

export interface SalesChartsData {
  period: {
    from: string
    to: string
    granularity: 'day' | 'week' | 'month'
  }
  revenue_series: Array<{
    key: string
    label: string
    total_revenue: number
    sales_count: number
  }>
  by_salesperson: Array<{
    user_id: number
    name: string
    sales_count: number
    total_revenue: number
  }>
  by_part: Array<{
    part_id: number
    name: string
    code: string
    total_quantity: number
    total_revenue: number
  }>
}

export interface InvoiceSummary {
  issued_count: number
  paid_count: number
  void_count: number
  uninvoiced_sales_count: number
  uninvoiced_sales_total: number
  total_invoiced_amount: number
}

export interface SalesSettings {
  sales_default_tax_percent: number
  sales_sms_pattern_id: string
}

export interface SellerOption {
  id: number
  name: string
  user_type: string
}
