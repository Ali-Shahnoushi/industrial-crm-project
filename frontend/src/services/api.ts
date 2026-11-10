import axios from 'axios'
import type {
  AssignmentStrategy,
  CompanySettings,
  Customer,
  CustomerLookupItem,
  CustomerPart,
  CustomerScope,
  DashboardStats,
  InventoryOperationType,
  InventorySummary,
  Part,
  PartInventoryLog,
  PartServiceHistory,
  PortalDevice,
  PortalOverview,
  RoleOption,
  SmsLog,
  SmsSettings,
  StaffOption,
  SystemPermission,
  Ticket,
  TicketDepartment,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  TicketSummary,
  TicketType,
  User,
  UserType,
} from '../types'

export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Handle FormData Content-Type
http.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type']
  }
  return config
})

// Handle 401 Unauthenticated (preserve return path safely)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const reqUrl = String(err.config?.url ?? '')
    const isAuthCheck = reqUrl.includes('/auth/me') || reqUrl.includes('/auth/login')
    if (err.response?.status === 401 && !isAuthCheck && !window.location.pathname.includes('/login')) {
      const target = `${window.location.pathname}${window.location.search}`
      window.location.href = target && target !== '/' ? `/login?from=${encodeURIComponent(target)}` : '/login'
    }
    return Promise.reject(err)
  },
)

export const authApi = {
  login: async (login: string, password: string) => {
    const { data } = await http.post<{ user: any; token?: string }>('/auth/login', { login, password })
    data.user.id = String(data.user.id)
    return data as { user: User; token?: string }
  },
  sendOtp: async (phone: string) => {
    const { data } = await http.post<{ message: string; expires_in: number; sandbox_code?: string }>(
      '/auth/otp/send',
      { phone },
    )
    return data
  },
  verifyOtp: async (phone: string, code: string) => {
    const { data } = await http.post<{ user: any; token?: string; message: string }>('/auth/otp/verify', {
      phone,
      code,
    })
    data.user.id = String(data.user.id)
    return data as { user: User; token?: string; message: string }
  },
  me: async () => {
    const { data } = await http.get<{ user: any }>('/auth/me')
    data.user.id = String(data.user.id)
    return data.user as User
  },
  logout: async () => {
    await http.post('/auth/logout')
  },
  updateProfile: async (body: FormData) => {
    const { data } = await http.post<{ message: string; user: any }>('/auth/me', body)
    data.user.id = String(data.user.id)
    return data as { message: string; user: User }
  },
}

export const dashboardApi = {
  getStats: async () => {
    const { data } = await http.get<DashboardStats>('/dashboard/stats')
    return data
  },
}

export const customerApi = {
  list: async (params?: {
    customer_type?: string
    type?: string
    province?: string
    city?: string
    has_devices?: string
    sort_by?: string
    sort_direction?: string
    q?: string
    page?: number
    per_page?: number
  }) => {
    const { data } = await http.get<{
      data: Customer[]
      current_page: number
      last_page: number
      total: number
    }>('/customers', { params })
    return data
  },
  lookup: async (q?: string) => {
    const { data } = await http.get<CustomerLookupItem[]>('/customers-lookup', {
      params: q ? { q } : undefined,
    })
    return data
  },
  get: async (id: number | string) => {
    const { data } = await http.get<Customer>(`/customers/${id}`)
    return data
  },
  create: async (body: Partial<Customer>) => {
    const { data } = await http.post<{ message: string; customer: Customer }>('/customers', body)
    return data
  },
  update: async (id: number | string, body: Partial<Customer>) => {
    const { data } = await http.put<{ message: string; customer: Customer }>(`/customers/${id}`, body)
    return data
  },
  delete: async (id: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/customers/${id}`)
    return data
  },
  staffOptions: async () => {
    const { data } = await http.get<{ data: StaffOption[] }>('/customers-staff-options')
    return data.data
  },
  updateOwner: async (
    id: number | string,
    ownerUserId: number | string,
    salesManagerUserId?: number | string | null,
  ) => {
    const payload: Record<string, any> = { owner_user_id: Number(ownerUserId) }
    if (salesManagerUserId !== undefined) {
      payload.sales_manager_user_id = salesManagerUserId ? Number(salesManagerUserId) : null
    }
    const { data } = await http.patch<{ message: string; customer: Customer }>(
      `/customers/${id}/owner`,
      payload,
    )
    return data
  },
  managePortalAccess: async (
    id: number | string,
    body: {
      portal_enabled: boolean
      password?: string
      login_email?: string | null
      login_phone?: string | null
      sales_manager_user_id?: number | null
    },
  ) => {
    const { data } = await http.post<{ message: string; customer: Customer }>(
      `/customers/${id}/portal-access`,
      body,
    )
    return data
  },
  importExcel: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await http.post<{ message: string; imported_count: number; errors: string[] }>(
      '/customers/import',
      formData,
    )
    return data
  },
  exportExcelUrl: (customerType?: string) => {
    const base = '/api/v1/customers/export'
    return customerType ? `${base}?customer_type=${customerType}` : base
  },
  templateExcelUrl: () => '/api/v1/customers/template',
  downloadTemplate: async () => {
    const response = await http.get('/customers/template', { responseType: 'blob' })
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = 'customers-sample-template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  },
  downloadExport: async (customerType?: string, format: 'xlsx' | 'csv' = 'xlsx') => {
    const params: Record<string, string> = { format }
    if (customerType) {
      params.customer_type = customerType
    }
    const response = await http.get('/customers/export', { params, responseType: 'blob' })
    const mime =
      format === 'csv'
        ? 'text/csv;charset=utf-8;'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const blob = new Blob([response.data], { type: mime })
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  },
}

export const partApi = {
  list: async (params?: { q?: string; low_stock_only?: boolean; active_only?: boolean }) => {
    const { data } = await http.get<Part[]>('/parts', { params })
    return data
  },
  inventorySummary: async () => {
    const { data } = await http.get<InventorySummary>('/inventory/summary')
    return data
  },
  create: async (body: Partial<Part>) => {
    const { data } = await http.post<{ message: string; part: Part }>('/parts', body)
    return data
  },
  update: async (id: number | string, body: Partial<Part>) => {
    const { data } = await http.put<{ message: string; part: Part }>(`/parts/${id}`, body)
    return data
  },
  delete: async (id: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/parts/${id}`)
    return data
  },
  adjustStock: async (
    partId: number | string,
    body: {
      type: InventoryOperationType
      quantity: number
      description?: string
      customer_id?: number | null
    },
  ) => {
    const { data } = await http.post<{ message: string; log: PartInventoryLog; part: Part }>(
      `/parts/${partId}/stock`,
      body,
    )
    return data
  },
  inventoryLogs: async (params?: {
    part_id?: number | string
    type?: string
    customer_id?: number | string
    q?: string
    page?: number
    per_page?: number
  }) => {
    const { data } = await http.get<{
      data: PartInventoryLog[]
      current_page: number
      last_page: number
      total: number
    }>('/inventory-logs', { params })
    return data
  },
  assignPart: async (
    customerId: number | string,
    body: {
      part_id: number | string
      serial_number?: string | null
      quantity: number
      invoice_amount?: number | string | null
      invoice_number?: string | null
      installation_date?: string
      warranty_expire_date?: string | null
      notes?: string
    },
  ) => {
    const { data } = await http.post<{
      message: string
      customer_part: CustomerPart
      customer_type: string
    }>(`/customers/${customerId}/parts`, body)
    return data
  },
  updateAssignedPart: async (
    customerPartId: number | string,
    body: {
      part_id?: number | string
      serial_number?: string | null
      quantity?: number
      invoice_amount?: number | string | null
      invoice_number?: string | null
      installation_date?: string | null
      warranty_expire_date?: string | null
      status?: string
      notes?: string | null
    },
  ) => {
    const { data } = await http.put<{ message: string; customer_part: CustomerPart }>(
      `/customer-parts/${customerPartId}`,
      body,
    )
    return data
  },
  deleteAssignedPart: async (customerPartId: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/customer-parts/${customerPartId}`)
    return data
  },
  addServiceHistory: async (
    customerPartId: number | string,
    body: { service_date: string; service_type: string; description: string; cost?: number },
  ) => {
    const { data } = await http.post<{ message: string; history: PartServiceHistory }>(
      `/customer-parts/${customerPartId}/history`,
      body,
    )
    return data
  },
}

export const smsApi = {
  sendPattern: async (body: {
    mobile: string
    pattern_code: string
    tokens: Record<string, any>
    customer_id?: number | string
  }) => {
    const { data } = await http.post<{
      message: string
      success: boolean
      message_id: string
      is_sandbox: boolean
    }>('/sms/send-pattern', body)
    return data
  },
  getLogs: async (params?: { status?: string; q?: string; page?: number }) => {
    const { data } = await http.get<{
      data: SmsLog[]
      current_page: number
      last_page: number
      total: number
    }>('/sms/logs', { params })
    return data
  },
}

export const ticketApi = {
  activeDepartments: async () => {
    const { data } = await http.get<{ departments: TicketDepartment[] }>('/ticket-departments')
    return data.departments
  },
  summary: async () => {
    const { data } = await http.get<TicketSummary>('/tickets-summary')
    return data
  },
  list: async (params?: {
    q?: string
    status?: string
    priority?: string
    ticket_type?: string
    department_id?: number | string
    assigned_to_user_id?: number | string
    customer_id?: number | string
    mine_only?: boolean
    unassigned_only?: boolean
    page?: number
    per_page?: number
  }) => {
    const { data } = await http.get<{
      data: Ticket[]
      current_page: number
      last_page: number
      total: number
    }>('/tickets', { params })
    return data
  },
  get: async (id: number | string) => {
    const { data } = await http.get<{ ticket: Ticket; staff_options: StaffOption[] }>(`/tickets/${id}`)
    return data
  },
  create: async (body: FormData | Record<string, any>) => {
    const { data } = await http.post<{ message: string; ticket: Ticket }>('/tickets', body)
    return data
  },
  update: async (
    id: number | string,
    body: {
      status?: TicketStatus
      priority?: TicketPriority
      department_id?: number | null
      assigned_to_user_id?: number | null
      auto_reassign?: boolean
    },
  ) => {
    const { data } = await http.patch<{ message: string; ticket: Ticket }>(`/tickets/${id}`, body)
    return data
  },
  addMessage: async (id: number | string, body: FormData | Record<string, any>) => {
    const { data } = await http.post<{
      message: string
      ticket_message: TicketMessage
      ticket: Ticket
    }>(`/tickets/${id}/messages`, body)
    return data
  },
}

export const ticketDepartmentAdminApi = {
  list: async () => {
    const { data } = await http.get<{
      departments: TicketDepartment[]
      staff_candidates: StaffOption[]
      strategies: Array<{ key: AssignmentStrategy; label: string; description: string }>
    }>('/settings/ticket-departments')
    return data
  },
  create: async (body: {
    name: string
    description?: string | null
    assignment_strategy: AssignmentStrategy
    is_default_repair?: boolean
    is_active?: boolean
    sort_order?: number
    agent_ids?: number[]
  }) => {
    const { data } = await http.post<{ message: string; department: TicketDepartment }>(
      '/settings/ticket-departments',
      body,
    )
    return data
  },
  update: async (
    id: number | string,
    body: {
      name?: string
      description?: string | null
      assignment_strategy?: AssignmentStrategy
      is_default_repair?: boolean
      is_active?: boolean
      sort_order?: number
      agent_ids?: number[]
    },
  ) => {
    const { data } = await http.put<{ message: string; department: TicketDepartment }>(
      `/settings/ticket-departments/${id}`,
      body,
    )
    return data
  },
  delete: async (id: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/settings/ticket-departments/${id}`)
    return data
  },
}

export const portalApi = {
  overview: async () => {
    const { data } = await http.get<PortalOverview>('/portal/overview')
    return data
  },
  devices: async () => {
    const { data } = await http.get<{ devices: PortalDevice[] }>('/portal/devices')
    return data.devices
  },
  tickets: async (params?: { status?: string; ticket_type?: TicketType | ''; q?: string; page?: number }) => {
    const { data } = await http.get<{
      data: Ticket[]
      current_page: number
      last_page: number
      total: number
    }>('/portal/tickets', { params })
    return data
  },
  getTicket: async (id: number | string) => {
    const { data } = await http.get<{ ticket: Ticket }>(`/portal/tickets/${id}`)
    return data.ticket
  },
  createTicket: async (body: FormData | Record<string, any>) => {
    const { data } = await http.post<{ message: string; ticket: Ticket }>('/portal/tickets', body)
    return data
  },
  replyTicket: async (id: number | string, body: FormData | Record<string, any>) => {
    const { data } = await http.post<{ message: string; ticket_message: TicketMessage }>(
      `/portal/tickets/${id}/messages`,
      body,
    )
    return data
  },
}

export const settingsApi = {
  getSmsSettings: async () => {
    const { data } = await http.get<SmsSettings>('/settings/sms')
    return data
  },
  updateSmsSettings: async (body: Partial<SmsSettings & { melipayamak_password?: string }>) => {
    const { data } = await http.put<{ message: string }>('/settings/sms', body)
    return data
  },
  getCompanySettings: async () => {
    const { data } = await http.get<CompanySettings>('/settings/company')
    return data
  },
  updateCompanySettings: async (body: FormData) => {
    const { data } = await http.post<{
      message: string
      company_name: string | null
      company_logo_url: string | null
    }>('/settings/company', body)
    return data
  },
  upgradeSystem: async () => {
    const { data } = await http.post<{ message: string; version: string; output: string }>(
      '/settings/system/upgrade',
    )
    return data
  },
}

export const usersApi = {
  getRoles: async () => {
    const { data } = await http.get<RoleOption[]>('/roles')
    return data
  },
  list: async () => {
    const { data } = await http.get<any[]>('/users')
    return data.map((u) => ({ ...u, id: String(u.id) })) as User[]
  },
  get: async (id: number | string) => {
    const { data } = await http.get<any>(`/users/${id}`)
    data.id = String(data.id)
    return data as User
  },
  create: async (
    body: FormData | { name: string; email: string; phone?: string; password: string; permissions?: string[] },
  ) => {
    const { data } = await http.post<{ message: string; user: User }>('/users', body)
    return data
  },
  update: async (
    id: number | string,
    body:
      | FormData
      | {
          name: string
          email: string
          phone?: string
          password?: string
          permissions?: string[]
          is_active?: boolean
        },
  ) => {
    const { data } = await http.post<{ message: string; user: User }>(`/users/${id}`, body)
    return data
  },
  delete: async (id: number | string) => {
    const { data } = await http.delete<{ message: string }>(`/users/${id}`)
    return data
  },
  updatePermissions: async (
    userId: number | string,
    payload:
      | string[]
      | {
          permissions: string[]
          user_type?: UserType
          customer_scope?: CustomerScope
          granted_staff_ids?: number[]
          granted_customer_ids?: number[]
        },
  ) => {
    const body = Array.isArray(payload) ? { permissions: payload } : payload
    const { data } = await http.put<{ message: string; permissions: string[]; user?: User }>(
      `/users/${userId}/permissions`,
      body,
    )
    return data
  },
  toggleActive: async (userId: number | string) => {
    const { data } = await http.patch<{ message: string; is_active: boolean }>(
      `/users/${userId}/toggle-active`,
    )
    return data
  },
  getAvailablePermissions: async () => {
    const { data } = await http.get<SystemPermission[]>('/permissions')
    return data
  },
}

export interface BackupStatus {
  database_driver: string
  database_name: string
  database_size: string
  total_customers: number
  total_devices: number
  total_parts: number
  total_users: number
  server_time: string
}

export const backupApi = {
  status: async () => {
    const { data } = await http.get<BackupStatus>('/backup/status')
    return data
  },
  downloadCustomersJson: async () => {
    const res = await http.get('/backup/customers-json', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `crm-customers-devices-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
  restoreCustomersJson: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await http.post<{
      message: string
      stats: {
        created_customers: number
        updated_customers: number
        restored_devices: number
      }
    }>('/backup/customers-restore-json', fd)
    return data
  },
  downloadDatabaseDump: async () => {
    const res = await http.get('/backup/database-dump', { responseType: 'blob' })
    const contentType = String(res.headers['content-type'] ?? '')
    const isSqlite = contentType.includes('sqlite')
    const ext = isSqlite ? 'sqlite' : 'sql'
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `crm-database-backup-${new Date().toISOString().slice(0, 10)}.${ext}`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}
