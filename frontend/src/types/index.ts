export type Role = 'admin' | 'manager' | 'sales' | 'support' | 'warehouse' | 'finance' | 'marketing'
export type Presence = 'online' | 'away' | 'offline'
export type UserType = 'administrator' | 'manager' | 'salesperson' | 'installer' | 'customer'
export type CustomerScope = 'own' | 'selected' | 'all'
export type InventoryOperationType = 'in' | 'out_manual' | 'out_assign' | 'return' | 'adjustment'
export type AssignmentStrategy = 'round_robin' | 'least_loaded' | 'random'
export type TicketType = 'repair_request' | 'sales_inquiry' | 'technical_support' | 'general'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'answered' | 'customer_reply' | 'resolved' | 'closed'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
  avatar_url?: string
  title?: string
  role?: Role
  presence?: Presence
  joinedAt?: string
  is_active?: boolean
  is_primary_admin?: boolean
  is_customer_portal?: boolean
  customer_id?: number | null
  permissions: string[]
  created_at?: string
  user_type?: UserType
  role_label?: string
  user_type_label?: string
  customer_scope?: CustomerScope
  granted_staff_ids?: number[]
  granted_staff?: Array<{ id: number; name: string }>
  granted_customer_ids?: number[]
  granted_customers?: Array<{ id: number; display_name: string; type: CustomerPersonType }>
}

export interface RoleOption {
  key: UserType
  label: string
  description: string
  default_customer_scope: CustomerScope
  default_permissions: string[]
}

export interface CompanySettings {
  company_name: string | null
  company_logo_url: string | null
  app_version?: string
}

export type CustomerType = 'potential' | 'effective'
export type CustomerPersonType = 'individual' | 'company'
export type CustomerStatus = 'active' | 'vip' | 'new' | 'inactive'

export interface Customer {
  id: number | string
  customer_type: CustomerType // potential (بالقوه) | effective (بالفعل)
  type: CustomerPersonType    // individual (حقیقی) | company (حقوقی)
  first_name?: string | null
  last_name?: string | null
  full_name?: string
  display_name?: string
  company_name?: string | null
  national_code?: string | null
  mobile?: string | null
  phone?: string | null
  email?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
  portal_enabled?: boolean
  created_by_user_id?: number | null
  sales_manager_user_id?: number | null
  creator?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
    user_type?: UserType
    role_label?: string
    avatar_url?: string | null
  } | null
  sales_manager?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
    user_type?: UserType
    role_label?: string
    avatar_url?: string | null
  } | null
  portal_user?: {
    id: number
    customer_id: number
    name: string
    email: string
    phone?: string | null
    is_active: boolean
  } | null
  created_at?: string
  updated_at?: string
  customer_parts_count?: number
  total_devices_qty?: number | string | null
  customer_parts?: CustomerPart[]
  histories?: CustomerHistory[]
  sms_logs?: SmsLog[]
  tickets?: Ticket[]

  // Legacy demo compatibility fields
  firstName?: string
  lastName?: string
  company?: string
  status?: CustomerStatus
  source?: string
  tags?: string[]
  assignedTo?: string
  createdAt?: string
  lastContact?: string
  lastPurchase?: string
  totalSpent?: number
  ordersCount?: number
}

export interface CustomerLookupItem {
  id: number
  display_name: string
  type: CustomerPersonType
  mobile?: string | null
  creator_name?: string | null
}

export interface Part {
  id: number | string
  name: string
  code: string
  periodic_service_months: number
  stock_quantity?: number
  min_stock?: number
  unit?: string
  is_low_stock?: boolean
  description?: string | null
  is_active: boolean
  customer_parts_count?: number
  assigned_quantity_sum?: number | string | null
  customer_parts?: CustomerPart[]
  created_at?: string
}

export interface PartInventoryLog {
  id: number
  part_id: number
  customer_part_id?: number | null
  customer_id?: number | null
  user_id?: number | null
  type: InventoryOperationType
  type_label?: string
  quantity: number
  balance_before?: number
  balance_after: number
  description?: string | null
  created_at: string
  part?: Pick<Part, 'id' | 'name' | 'code' | 'stock_quantity' | 'unit' | 'min_stock'>
  user?: {
    id: number
    name: string
    email?: string
    user_type?: UserType
  } | null
  customer?: {
    id: number
    first_name?: string | null
    last_name?: string | null
    company_name?: string | null
    type?: CustomerPersonType
    full_name?: string
    display_name?: string
  } | null
}

export type CustomerPartStatus = 'active' | 'under_repair' | 'replaced' | 'retired'

export interface CustomerPart {
  id: number | string
  customer_id: number | string
  part_id: number | string
  serial_number?: string | null
  quantity?: number
  invoice_amount?: number | string | null
  invoice_number?: string | null
  installation_date?: string | null
  warranty_expire_date?: string | null
  status: CustomerPartStatus
  notes?: string | null
  part?: Part
  service_histories?: PartServiceHistory[]
  created_at?: string
}

export interface PartServiceHistory {
  id: number | string
  customer_part_id: number | string
  performed_by_user_id?: number | string
  service_date: string
  service_type: 'periodic' | 'repair' | 'overhaul'
  description: string
  cost?: number | string | null
  performed_by?: User
  created_at?: string
}

export interface CustomerHistory {
  id: number | string
  customer_id: number | string
  user_id?: number | string
  action: string
  description: string
  metadata?: Record<string, any>
  created_at: string
  user?: User
  customer?: Customer
}

export interface SmsLog {
  id: number | string
  customer_id?: number | string
  recipient_mobile: string
  pattern_code: string
  tokens: Record<string, any> | string[]
  status: 'sent' | 'failed' | 'pending'
  provider_message_id?: string
  error_message?: string
  created_at: string
  customer?: Customer
}

export interface SmsSettings {
  melipayamak_username: string
  melipayamak_has_password: boolean
  melipayamak_from: string
  melipayamak_sandbox: boolean
}

export interface SystemPermission {
  name: string
  label: string
}

export interface DashboardStats {
  stats: {
    total_customers: number
    effective_customers: number
    potential_customers: number
    total_parts: number
    total_stock_quantity?: number
    assigned_parts: number
    total_sms_sent: number
    low_stock_parts_count?: number
    open_tickets_count?: number
    pending_repair_tickets_count?: number
  }
  low_stock_parts?: Part[]
  recent_activities: CustomerHistory[]
  recent_sms: SmsLog[]
}

export interface InventorySummary {
  total_models: number
  active_models: number
  total_units_in_stock: number
  out_of_stock_count: number
  low_stock_count: number
  low_stock_parts: Part[]
  recent_movements: PartInventoryLog[]
}

export interface StaffOption {
  id: number
  name: string
  email: string
  phone?: string | null
  user_type: UserType
  role_label: string
  avatar_url?: string | null
  open_tickets_count?: number
}

export interface TicketDepartmentAgent {
  id: number
  name: string
  email?: string
  user_type?: UserType
  role_label?: string
  is_active?: boolean
  avatar_url?: string | null
  open_tickets_count?: number
}

export interface TicketDepartment {
  id: number
  name: string
  description?: string | null
  assignment_strategy: AssignmentStrategy
  assignment_strategy_label?: string
  is_default_repair: boolean
  is_active: boolean
  sort_order?: number
  last_assigned_user_id?: number | null
  last_assigned_user?: { id: number; name: string } | null
  tickets_count?: number
  open_tickets_count?: number
  agent_ids?: number[]
  agents?: TicketDepartmentAgent[]
}

export interface TicketMessage {
  id: number
  ticket_id: number
  user_id?: number | null
  sender_type: 'customer' | 'staff' | 'system'
  is_internal_note: boolean
  body: string
  attachment_path?: string | null
  attachment_name?: string | null
  attachment_url?: string | null
  created_at: string
  user?: {
    id: number
    name: string
    user_type?: UserType
    role_label?: string
    avatar_url?: string | null
  } | null
}

export interface Ticket {
  id: number
  tracking_code: string
  customer_id: number
  customer_part_id?: number | null
  department_id?: number | null
  created_by_user_id?: number | null
  assigned_to_user_id?: number | null
  ticket_type: TicketType
  priority: TicketPriority
  status: TicketStatus
  subject: string
  last_reply_at?: string | null
  closed_at?: string | null
  created_at: string
  updated_at?: string
  messages_count?: number
  customer?: Customer
  customer_part?: CustomerPart | null
  department?: TicketDepartment | null
  assignee?: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
    user_type?: UserType
    role_label?: string
    avatar_url?: string | null
  } | null
  creator?: {
    id: number
    name: string
    user_type?: UserType
    role_label?: string
  } | null
  messages?: TicketMessage[]
}

export interface TicketSummary {
  total: number
  open_active: number
  waiting_staff: number
  repair_requests: number
  urgent_high: number
  assigned_to_me: number
  unassigned: number
}

export interface PortalSalesContact {
  id: number
  name: string
  title: string
  role_label: string
  phone?: string | null
  email?: string | null
  avatar_url?: string | null
}

export interface PortalDevice {
  id: number
  part_id: number
  serial_number?: string | null
  quantity: number
  installation_date?: string | null
  warranty_expire_date?: string | null
  is_under_warranty: boolean
  warranty_days_remaining?: number | null
  status: CustomerPartStatus
  notes?: string | null
  open_repair_tickets_count: number
  part?: {
    id: number
    name: string
    code: string
    unit: string
    periodic_service_months: number
    description?: string | null
  } | null
  service_histories: Array<{
    id: number
    service_date: string
    service_type: 'periodic' | 'repair' | 'overhaul'
    description: string
    cost?: number | string | null
    performed_by_name: string
  }>
}

export interface PortalOverview {
  customer: Customer
  sales_team: {
    sales_manager: PortalSalesContact | null
    sales_rep: PortalSalesContact | null
  }
  stats: {
    devices_count: number
    total_devices_qty: number
    active_warranty_count: number
    open_tickets_count: number
    answered_tickets_count: number
  }
  devices: PortalDevice[]
  departments: Array<Pick<TicketDepartment, 'id' | 'name' | 'description' | 'is_default_repair'>>
  recent_tickets: Ticket[]
}

