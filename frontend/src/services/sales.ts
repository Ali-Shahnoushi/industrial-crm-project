import { http } from './api'
import type {
  Invoice,
  InvoiceSummary,
  Sale,
  SalesChartsData,
  SalesSettings,
  SalesSummary,
  SellerOption,
} from '../types/sales'

export const salesApi = {
  list: async (params?: {
    q?: string
    from?: string
    to?: string
    status?: string
    payment_status?: string
    user_id?: number | string
    customer_id?: number | string
    uninvoiced_only?: boolean
    sort_by?: string
    sort_direction?: 'asc' | 'desc'
    page?: number
    per_page?: number
  }) => {
    const { data } = await http.get<{
      data: Sale[]
      current_page: number
      last_page: number
      total: number
      per_page: number
    }>('/sales', { params })
    return data
  },

  get: async (id: number | string) => {
    const { data } = await http.get<Sale>(`/sales/${id}`)
    return data
  },

  create: async (body: {
    customer_id: number | string
    part_id: number | string
    quantity: number
    serial_number?: string | null
    unit_price?: number | null
    discount_amount?: number
    tax_percent?: number
    sale_date?: string
    status?: 'draft' | 'confirmed'
    payment_status?: 'unpaid' | 'partial' | 'paid'
    paid_amount?: number | null
    user_id?: number | string | null
    notes?: string | null
    send_sms?: boolean
  }) => {
    const { data } = await http.post<{ message: string; sale: Sale }>('/sales', body)
    return data
  },

  update: async (
    id: number | string,
    body: {
      sale_date?: string
      status?: 'draft' | 'confirmed'
      payment_status?: 'unpaid' | 'partial' | 'paid'
      unit_price?: number
      item_discount_amount?: number
      discount_amount?: number
      tax_percent?: number
      paid_amount?: number | null
      user_id?: number | string | null
      notes?: string | null
      send_sms?: boolean
      items?: Array<{ id: number; unit_price?: number; discount_amount?: number }>
    },
  ) => {
    const { data } = await http.put<{ message: string; sale: Sale }>(`/sales/${id}`, body)
    return data
  },

  cancel: async (id: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/sales/${id}`)
    return data
  },

  summary: async (params?: { from?: string; to?: string }) => {
    const { data } = await http.get<SalesSummary>('/sales/summary', { params })
    return data
  },

  charts: async (params?: {
    from?: string
    to?: string
    granularity?: 'day' | 'week' | 'month'
  }) => {
    const { data } = await http.get<SalesChartsData>('/sales/charts', { params })
    return data
  },

  customerSales: async (customerId: number | string) => {
    const { data } = await http.get<Sale[]>(`/customers/${customerId}/sales`)
    return data
  },

  sellerOptions: async () => {
    const { data } = await http.get<SellerOption[]>('/sales/seller-options')
    return data
  },

  exportExcelUrl: (params?: {
    from?: string
    to?: string
    status?: string
    payment_status?: string
    user_id?: number | string
    customer_id?: number | string
  }) => {
    const sp = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          sp.set(k, String(v))
        }
      })
    }
    const qs = sp.toString()
    return `/api/v1/sales/export${qs ? `?${qs}` : ''}`
  },
}

export const invoiceApi = {
  list: async (params?: {
    q?: string
    status?: string
    from?: string
    to?: string
    page?: number
    per_page?: number
  }) => {
    const { data } = await http.get<{
      data: Invoice[]
      current_page: number
      last_page: number
      total: number
      per_page: number
    }>('/invoices', { params })
    return data
  },

  summary: async () => {
    const { data } = await http.get<InvoiceSummary>('/invoices/summary')
    return data
  },

  generate: async (
    saleId: number | string,
    body?: { due_at?: string | null; notes?: string | null },
  ) => {
    const { data } = await http.post<{ message: string; invoice: Invoice }>(
      `/sales/${saleId}/invoice`,
      body ?? {},
    )
    return data
  },

  get: async (id: number | string) => {
    const { data } = await http.get<{
      invoice: Invoice
      company: { name: string | null; logo_url: string | null }
    }>(`/invoices/${id}`)
    return data
  },

  void: async (id: number | string) => {
    const { data } = await http.patch<{ message: string; invoice: Invoice }>(
      `/invoices/${id}/void`,
    )
    return data
  },
}

export const salesSettingsApi = {
  get: async () => {
    const { data } = await http.get<SalesSettings>('/settings/sales')
    return data
  },
  update: async (body: SalesSettings) => {
    const { data } = await http.put<SalesSettings & { message: string }>('/settings/sales', body)
    return data
  },
}
