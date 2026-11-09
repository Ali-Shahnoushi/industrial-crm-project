export type Role = 'admin' | 'manager' | 'sales' | 'support' | 'warehouse' | 'finance' | 'marketing'
export type Presence = 'online' | 'away' | 'offline'
export type UserType = 'administrator' | 'manager' | 'salesperson' | 'installer'
export type CustomerScope = 'own' | 'selected' | 'all'
export type InventoryOperationType = 'in' | 'out_manual' | 'out_assign' | 'return'

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
  permissions: string[]
  created_at?: string
  user_type?: UserType
  role_label?: string
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
  created_by_user_id?: number | null
  creator?: { id: number; name: string } | null
  created_at?: string
  updated_at?: string
  customer_parts_count?: number
  total_devices_qty?: number | string | null
  customer_parts?: CustomerPart[]
  histories?: CustomerHistory[]
  sms_logs?: SmsLog[]

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
  balance_after: number
  description?: string | null
  created_at: string
  part?: Pick<Part, 'id' | 'name' | 'code' | 'stock_quantity'>
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
  serial_number: string
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
  }
  recent_activities: CustomerHistory[]
  recent_sms: SmsLog[]
}

// Legacy demo types for compatibility
export type LeadStage = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost'
export interface Lead {
  id: string
  title: string
  contactName: string
  company: string
  phone: string
  value: number
  stage: LeadStage
  probability: number
  source: string
  assignedTo: string
  expectedClose: string
  createdAt: string
  order: number
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  minStock: number
  unit: string
  warehouse: string
  supplier: string
  createdAt: string
}

export interface StockMovement {
  id: string
  productId: string
  type: 'in' | 'out' | 'adjust'
  quantity: number
  date: string
  userId: string
  note: string
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'
export interface SaleItem {
  productId: string
  name: string
  quantity: number
  price: number
}
export interface Sale {
  id: string
  number: string
  date: string
  customerId: string
  userId: string
  status: InvoiceStatus
  paymentMethod: string
  items: SaleItem[]
  discount: number
  total: number
}

export type ActivityType = 'call' | 'meeting' | 'email' | 'note'
export interface Activity {
  id: string
  customerId: string
  type: ActivityType
  title: string
  description: string
  date: string
  userId: string
}

export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type Priority = 'low' | 'medium' | 'high'
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: string
  assignedTo: string
  customerId: string | null
  createdAt: string
}

export type EventType = 'meeting' | 'call' | 'deadline' | 'reminder'
export interface CalendarEvent {
  id: string
  title: string
  type: EventType
  start: string
  end: string
  customerId: string | null
  userId: string
  location: string
}

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export interface TicketMessage {
  from: 'customer' | 'agent'
  text: string
  date: string
}
export interface Ticket {
  id: string
  number: string
  subject: string
  category: string
  customerId: string
  priority: Priority
  status: TicketStatus
  assignedTo: string
  createdAt: string
  messages: TicketMessage[]
}

export interface ChatRoom {
  id: string
  name: string
  type: 'dm' | 'group'
  members: string[]
  unread: number
}
export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  text: string
  date: string
}

export interface AppNotification {
  id: string
  userId: string
  type: 'lead' | 'stock' | 'invoice' | 'ticket' | 'task' | 'system'
  title: string
  description: string
  link: string
  read: boolean
  date: string
}

export interface Resources {
  users: User
  customers: Customer
  leads: Lead
  products: Product
  stockMovements: StockMovement
  sales: Sale
  activities: Activity
  tasks: Task
  events: CalendarEvent
  tickets: Ticket
  rooms: ChatRoom
  messages: ChatMessage
  notifications: AppNotification
}
export type ResourceName = keyof Resources
