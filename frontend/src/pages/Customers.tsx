import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  Cpu,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Pagination } from '../components/ui/Pagination'
import { ConfirmDialog } from '../components/ui/Modal'
import { EmptyState, TableSkeleton } from '../components/ui/Field'
import { CustomerFormModal } from '../components/customers/CustomerFormModal'
import { ImportModal } from '../components/customers/ImportModal'
import { Can } from '../components/common/Can'
import { customerApi } from '../services/api'
import { IRAN_PROVINCES, IRAN_PROVINCES_DATA, getCitiesByProvince } from '../data/iranLocations'
import { customerDisplayName, cx, dateShort, num, toEnDigits } from '../utils/format'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import type { Customer, CustomerType } from '../types'

const PAGE_SIZE = 10

type CustomerSortField = 'name' | 'customer_type' | 'contact' | 'city' | 'devices' | 'created_at'

export default function Customers() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const [page, setPage] = useState(1)

  const typeParam = params.get('type')
  const customerType: CustomerType | 'all' =
    typeParam === 'effective' || typeParam === 'potential' ? typeParam : 'all'
  const isNewFromUrl = Boolean(params.get('new'))

  // Advanced Minimal Filters
  const [creatorFilter, setCreatorFilter] = useState<string>('')
  const [entityType, setEntityType] = useState<'all' | 'company' | 'individual'>('all')
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'has_devices' | 'no_devices'>('all')
  const [provinceFilter, setProvinceFilter] = useState<string>('')
  const [cityFilter, setCityFilter] = useState<string>('')
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false)

  // Sorting State
  const [sortField, setSortField] = useState<CustomerSortField>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: CustomerSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'created_at' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const selectCustomerType = (nextType: CustomerType | 'all') => {
    setPage(1)
    const nextParams = new URLSearchParams(params)
    if (nextType === 'all') nextParams.delete('type')
    else nextParams.set('type', nextType)
    setParams(nextParams, { replace: true })
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>()
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'csv' | null>(null)

  const closeFormModal = () => {
    setFormOpen(false)
    if (params.get('new')) {
      const nextParams = new URLSearchParams(params)
      nextParams.delete('new')
      setParams(nextParams, { replace: true })
    }
  }

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportingFormat(format)
    try {
      await customerApi.downloadExport(customerType === 'all' ? undefined : customerType, format)
      toast.success(
        format === 'csv'
          ? 'فایل خروجی CSV (استاندارد UTF-8) با موفقیت دانلود شد.'
          : 'فایل خروجی اکسل (.xlsx) با موفقیت دانلود شد.',
      )
    } catch {
      toast.error('خطا در دانلود فایل خروجی مشتریان')
    } finally {
      setExportingFormat(null)
    }
  }

  const { data: creatorOptions = [] } = useQuery({
    queryKey: ['customer-creator-options'],
    queryFn: customerApi.creatorOptions,
  })

  const creatorSelectOptions = useMemo(
    () =>
      creatorOptions.map((u) => ({
        value: String(u.id),
        label: u.name,
        hint: u.role_label,
      })),
    [creatorOptions],
  )

  const selectedCreatorName = useMemo(
    () => creatorOptions.find((u) => String(u.id) === creatorFilter)?.name,
    [creatorOptions, creatorFilter],
  )

  const cityOptions = useMemo(() => {
    if (provinceFilter) {
      return getCitiesByProvince(provinceFilter)
    }
    const seen = new Set<string>()
    const all: Array<{ value: string; label: string; hint: string }> = []
    for (const prov of IRAN_PROVINCES_DATA) {
      for (const c of prov.cities) {
        if (!seen.has(c)) {
          seen.add(c)
          all.push({ value: c, label: c, hint: prov.name })
        }
      }
    }
    return all
  }, [provinceFilter])

  const activeFiltersCount =
    (customerType !== 'all' ? 1 : 0) +
    (creatorFilter ? 1 : 0) +
    (entityType !== 'all' ? 1 : 0) +
    (deviceFilter !== 'all' ? 1 : 0) +
    (provinceFilter ? 1 : 0) +
    (cityFilter ? 1 : 0)

  const clearAllFilters = () => {
    selectCustomerType('all')
    setCreatorFilter('')
    setEntityType('all')
    setDeviceFilter('all')
    setProvinceFilter('')
    setCityFilter('')
    setQ('')
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'customers',
      customerType,
      creatorFilter,
      entityType,
      deviceFilter,
      provinceFilter,
      cityFilter,
      debouncedQ,
      sortField,
      sortOrder,
      page,
    ],
    queryFn: () =>
      customerApi.list({
        customer_type: customerType === 'all' ? undefined : customerType,
        created_by_user_id: creatorFilter || undefined,
        type: entityType === 'all' ? undefined : entityType,
        has_devices:
          deviceFilter === 'has_devices' ? 'yes' : deviceFilter === 'no_devices' ? 'no' : undefined,
        province: provinceFilter || undefined,
        city: cityFilter || undefined,
        sort_by: sortField,
        sort_direction: sortOrder,
        q: toEnDigits(debouncedQ).trim() || undefined,
        page,
        per_page: PAGE_SIZE,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: customerApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('مشتری با موفقیت حذف شد')
      setDeleting(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'خطا در حذف مشتری')
    },
  })

  const customers = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت مشتریان"
        actions={
          <>
            <Can permission="settings.manage">
              <Link
                to="/settings/backup"
                className="btn btn-sm btn-ghost gap-1.5 border border-base-200"
                title="پشتیبان‌گیری و بازیابی پرونده‌ها (JSON و دیتابیس)"
              >
                <Database className="size-4 text-primary" />
                <span className="hidden sm:inline">پشتیبان‌گیری</span>
              </Link>
            </Can>

            <Can permission="customers.export">
              <div className="dropdown dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  className={cx(
                    'btn btn-sm gap-1.5',
                    exportingFormat && 'btn-disabled opacity-70',
                  )}
                >
                  {exportingFormat ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Download className="size-4 text-emerald-600" />
                  )}
                  خروجی
                  <ChevronDown className="size-3.5 opacity-70" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu z-40 mt-1.5 w-64 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl text-xs"
                >
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        ;(document.activeElement as HTMLElement | null)?.blur()
                        handleExport('xlsx')
                      }}
                      className="flex items-center gap-2 font-semibold"
                    >
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      خروجی اکسل استاندارد (.xlsx)
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        ;(document.activeElement as HTMLElement | null)?.blur()
                        handleExport('csv')
                      }}
                      className="flex items-center gap-2 font-semibold"
                    >
                      <FileText className="size-4 text-sky-600" />
                      خروجی CSV (UTF-8 استاندارد فارسی)
                    </button>
                  </li>
                  <li className="border-t border-base-200 mt-1 pt-1">
                    <Link
                      to="/settings/backup"
                      className="flex items-center gap-2 font-semibold text-primary"
                    >
                      <Database className="size-4" />
                      پشتیبان‌گیری کامل پرونده‌ها (JSON)
                    </Link>
                  </li>
                </ul>
              </div>
            </Can>

            <Can permission="customers.import">
              <button type="button" className="btn btn-sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> ورود از اکسل
              </button>
            </Can>

            <Can permission="customers.create">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" /> مشتری جدید
              </button>
            </Can>
          </>
        }
      />

      {/* Tabs, Search and Minimal Filter Trigger */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-base-100 p-3.5 rounded-2xl border border-base-200 shadow-xs">
          {/* Main Status Tabs */}
          <div role="tablist" className="tabs tabs-box w-fit">
            <button
              role="tab"
              className={cx('tab gap-2 text-xs font-bold', customerType === 'all' && 'tab-active')}
              onClick={() => selectCustomerType('all')}
            >
              <Users className="size-3.5" />
              همه
            </button>
            <button
              role="tab"
              className={cx(
                'tab gap-2 text-xs font-bold',
                customerType === 'effective' && 'tab-active',
              )}
              onClick={() => selectCustomerType('effective')}
            >
              <UserCheck className="size-3.5 text-emerald-600" />
              بالفعل
            </button>
            <button
              role="tab"
              className={cx(
                'tab gap-2 text-xs font-bold',
                customerType === 'potential' && 'tab-active',
              )}
              onClick={() => selectCustomerType('potential')}
            >
              <UserPlus className="size-3.5 text-amber-600" />
              بالقوه
            </button>
          </div>

          {/* Search + Filter Toggle Button */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex-1 lg:w-80">
              <SearchInput
                value={q}
                onChange={(val) => {
                  setQ(toEnDigits(val))
                  setPage(1)
                }}
                placeholder="جستجو (نام، همراه، شرکت، کد ملی، کارشناس...)"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={cx(
                'btn btn-sm gap-1.5 transition-all',
                showFilterPanel || activeFiltersCount > 0
                  ? 'btn-neutral text-white'
                  : 'btn-ghost border border-base-200',
              )}
              title="فیلترهای پیشرفته"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>فیلترها</span>
              {activeFiltersCount > 0 && (
                <span className="badge badge-primary badge-xs font-mono font-bold px-1.5">
                  {num(activeFiltersCount)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Minimal Expandable Filter Panel */}
        {showFilterPanel && (
          <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-xs space-y-4 transition-all">
            <div className="flex items-center justify-between border-b border-base-200/60 pb-2.5">
              <p className="text-xs font-extrabold text-base-content/80 flex items-center gap-2">
                <Filter className="size-3.5 text-primary" />
                فیلتر مشتریان
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn btn-ghost btn-xs text-error gap-1"
                >
                  <RotateCcw className="size-3" />
                  پاک‌سازی همه
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Filter 1: Creator / Expert */}
              <SearchableSelect
                label="کارشناس"
                placeholder="همه کارشناسان"
                searchPlaceholder="جستجوی نام کارشناس..."
                value={creatorFilter}
                options={creatorSelectOptions}
                onChange={(val) => {
                  setCreatorFilter(val)
                  setPage(1)
                }}
              />

              {/* Filter 2: Entity Type */}
              <SearchableSelect
                label="نوع شخصیت"
                placeholder="همه شخصیت‌ها"
                searchPlaceholder="جستجو..."
                value={entityType === 'all' ? '' : entityType}
                options={[
                  { value: 'company', label: 'حقوقی (شرکت)' },
                  { value: 'individual', label: 'حقیقی (شخصی)' },
                ]}
                onChange={(val) => {
                  setEntityType((val || 'all') as 'all' | 'company' | 'individual')
                  setPage(1)
                }}
              />

              {/* Filter 3: Device Assignment Status */}
              <SearchableSelect
                label="وضعیت دستگاه"
                placeholder="همه"
                searchPlaceholder="جستجو..."
                value={deviceFilter === 'all' ? '' : deviceFilter}
                options={[
                  { value: 'has_devices', label: 'دارای دستگاه' },
                  { value: 'no_devices', label: 'بدون دستگاه' },
                ]}
                onChange={(val) => {
                  setDeviceFilter((val || 'all') as 'all' | 'has_devices' | 'no_devices')
                  setPage(1)
                }}
              />

              {/* Filter 4: Province */}
              <SearchableSelect
                label="استان"
                placeholder="همه استان‌ها"
                searchPlaceholder="جستجوی استان..."
                value={provinceFilter}
                options={IRAN_PROVINCES}
                onChange={(val) => {
                  setProvinceFilter(val)
                  setCityFilter('')
                  setPage(1)
                }}
              />

              {/* Filter 5: City */}
              <SearchableSelect
                label="شهر"
                placeholder="همه شهرها"
                searchPlaceholder="جستجوی شهر..."
                value={cityFilter}
                options={cityOptions}
                onChange={(val) => {
                  setCityFilter(val)
                  setPage(1)
                }}
              />
            </div>
          </div>
        )}

        {/* Active Filter Badges */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-base-content/50 text-[11px] font-semibold">فیلترهای فعال:</span>

            {customerType !== 'all' && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                وضعیت: {customerType === 'effective' ? 'بالفعل' : 'بالقوه'}
                <button type="button" onClick={() => selectCustomerType('all')}>
                  <X className="size-3" />
                </button>
              </span>
            )}

            {creatorFilter && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                کارشناس: {selectedCreatorName || creatorFilter}
                <button type="button" onClick={() => setCreatorFilter('')}>
                  <X className="size-3" />
                </button>
              </span>
            )}

            {entityType !== 'all' && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                شخصیت: {entityType === 'company' ? 'حقوقی' : 'حقیقی'}
                <button type="button" onClick={() => setEntityType('all')}>
                  <X className="size-3" />
                </button>
              </span>
            )}

            {deviceFilter !== 'all' && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                دستگاه: {deviceFilter === 'has_devices' ? 'دارای دستگاه' : 'بدون دستگاه'}
                <button type="button" onClick={() => setDeviceFilter('all')}>
                  <X className="size-3" />
                </button>
              </span>
            )}

            {provinceFilter && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                استان: {provinceFilter}
                <button
                  type="button"
                  onClick={() => {
                    setProvinceFilter('')
                    setCityFilter('')
                  }}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}

            {cityFilter && (
              <span className="badge badge-neutral badge-soft text-[11px] gap-1 py-1">
                شهر: {cityFilter}
                <button type="button" onClick={() => setCityFilter('')}>
                  <X className="size-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-error hover:underline mr-1 font-medium"
            >
              حذف همه
            </button>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-xs">
        {isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} cols={6} />
        ) : !customers.length ? (
          <EmptyState
            title="مشتری‌ای یافت نشد"
            subtitle={
              q || activeFiltersCount > 0
                ? 'با فیلترها و عبارت جستجوی فعلی موردی پیدا نشد.'
                : 'هنوز مشتری در این بخش ثبت نشده است.'
            }
            action={
              activeFiltersCount > 0 ? (
                <button className="btn btn-sm btn-outline gap-1" onClick={clearAllFilters}>
                  <RotateCcw className="size-3.5" /> پاک‌سازی فیلترها
                </button>
              ) : (
                <Can permission="customers.create">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setEditing(undefined)
                      setFormOpen(true)
                    }}
                  >
                    <Plus className="size-4" /> ثبت اولین مشتری
                  </button>
                </Can>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr className="bg-base-200/50 text-xs font-bold text-base-content/70">
                  <th
                    onClick={() => handleSort('name')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>مشتری</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('customer_type')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>وضعیت</span>
                      {sortField === 'customer_type' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('contact')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>تماس</span>
                      {sortField === 'contact' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('city')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>شهر / استان</span>
                      {sortField === 'city' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('devices')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>دستگاه‌ها</span>
                      {sortField === 'devices' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('created_at')}
                    className="cursor-pointer select-none group hover:bg-base-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>تاریخ</span>
                      {sortField === 'created_at' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 text-base-content/30 group-hover:text-base-content/70" />
                      )}
                    </div>
                  </th>

                  <th className="text-end">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200/60">
                {customers.map((c) => {
                  const title = customerDisplayName(c)
                  const totalDevices = Number(c.total_devices_qty ?? c.customer_parts_count ?? 0)
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-base-200/50">
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              'flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs border',
                              c.type === 'company'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
                            )}
                          >
                            {c.type === 'company' ? (
                              <Building2 className="size-5" />
                            ) : (
                              <User className="size-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/customers/${c.id}`}
                                className="font-bold text-sm text-base-content hover:text-primary transition-colors"
                              >
                                {title}
                              </Link>
                              {c.portal_user && (
                                <span className="badge badge-xs bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold">
                                  پورتال
                                </span>
                              )}
                            </div>
                            {c.type === 'individual' && c.company_name && (
                              <p className="text-xs text-base-content/50 truncate max-w-[180px]">
                                {c.company_name}
                              </p>
                            )}
                            {c.creator?.name && (
                              <p className="text-[11px] text-base-content/40">ثبت: {c.creator.name}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer Status Badge: strictly single-line */}
                      <td>
                        {c.customer_type === 'effective' ? (
                          <span className="badge badge-success badge-soft font-bold text-xs gap-1.5 whitespace-nowrap inline-flex items-center">
                            <UserCheck className="size-3" /> بالفعل
                          </span>
                        ) : (
                          <span className="badge badge-warning badge-soft font-bold text-xs gap-1.5 whitespace-nowrap inline-flex items-center">
                            <UserPlus className="size-3" /> بالقوه
                          </span>
                        )}
                      </td>

                      {/* Contact Info: strictly two distinct vertical lines */}
                      <td className="text-xs">
                        <div className="flex flex-col gap-1 min-w-[130px]">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-slate-800 dark:text-slate-100 text-start">
                            <PhoneCall className="size-3 text-emerald-600 shrink-0" />
                            <span dir="ltr">{c.mobile || '—'}</span>
                          </div>
                          {c.phone && (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-base-content/60 text-start">
                              <Phone className="size-3 text-base-content/40 shrink-0" />
                              <span dir="ltr">{c.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="text-xs text-base-content/70">
                        {c.city || c.province ? `${c.province ?? ''} ${c.city ?? ''}`.trim() : '—'}
                      </td>

                      <td>
                        <Link
                          to={`/customers/${c.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                        >
                          <Cpu className="size-3.5" />
                          {num(totalDevices)}
                        </Link>
                      </td>

                      <td className="text-xs text-base-content/50">{dateShort(c.created_at ?? '')}</td>

                      <td className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/customers/${c.id}`}
                            className="btn btn-ghost btn-xs btn-square"
                            title="مشاهده پرونده"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <Can permission="customers.edit">
                            <button
                              className="btn btn-ghost btn-xs btn-square"
                              title="ویرایش"
                              onClick={() => {
                                setEditing(c)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </button>
                          </Can>
                          <Can permission="customers.delete">
                            <button
                              className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
                              title="حذف"
                              onClick={() => setDeleting(c)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {customers.length > 0 && (
          <div className="p-4 border-t border-base-200">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onPage={(p: number) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      {(formOpen || isNewFromUrl) && (
        <CustomerFormModal
          open={formOpen || isNewFromUrl}
          customer={isNewFromUrl ? undefined : editing}
          onClose={closeFormModal}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['customers'] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
            closeFormModal()
          }}
        />
      )}

      {/* Import Customers Modal */}
      {importOpen && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['customers'] })
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
            setImportOpen(false)
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف مشتری"
        message={`آیا از حذف پرونده مشتری «${deleting ? customerDisplayName(deleting) : ''}» اطمینان دارید؟ تمامی دستگاه‌ها و سوابق پیوست شده به این مشتری حذف خواهند شد.`}
        confirmText="حذف دائمی"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
