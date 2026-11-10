import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ProtectedRoute } from './layouts/MainLayout'
import { PortalProtectedRoute } from './layouts/CustomerPortalLayout'
import { PermissionRoute } from './components/common/PermissionRoute'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { useAuthStore } from './store/useAuthStore'
import { queryClient } from './store/queryClient'

// Route-level code splitting — Staff & Admin CRM
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Parts = lazy(() => import('./pages/Parts'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Tickets = lazy(() => import('./pages/Tickets'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const SmsCenter = lazy(() => import('./pages/SmsCenter'))
const TicketingSettingsPage = lazy(() => import('./pages/settings/TicketingSettingsPage'))
const SmsSettingsPage = lazy(() => import('./pages/settings/SmsSettingsPage'))
const UsersAclPage = lazy(() => import('./pages/settings/UsersAclPage'))
const CreateUserPage = lazy(() => import('./pages/settings/CreateUserPage'))
const EditUserPage = lazy(() => import('./pages/settings/EditUserPage'))
const MyProfilePage = lazy(() => import('./pages/settings/MyProfilePage'))
const SystemSettingsPage = lazy(() => import('./pages/settings/SystemSettingsPage'))
const BackupPage = lazy(() => import('./pages/settings/BackupPage'))

// Route-level code splitting — Isolated Customer Portal
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'))
const PortalDevices = lazy(() => import('./pages/portal/PortalDevices'))
const PortalTickets = lazy(() => import('./pages/portal/PortalTickets'))
const PortalTicketDetail = lazy(() => import('./pages/portal/PortalTicketDetail'))
const PortalProfile = lazy(() => import('./pages/portal/PortalProfile'))

import AccessDenied from './pages/AccessDenied'
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Strictly Isolated Customer Portal Subtree (`/portal/*`) */}
            <Route path="/portal" element={<PortalProtectedRoute />}>
              <Route index element={<PortalDashboard />} />
              <Route path="devices" element={<PortalDevices />} />
              <Route path="tickets" element={<PortalTickets />} />
              <Route path="tickets/:id" element={<PortalTicketDetail />} />
              <Route path="profile" element={<PortalProfile />} />
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Route>

            {/* Staff & Admin CRM Subtree */}
            <Route element={<ProtectedRoute />}>
              <Route index element={<Dashboard />} />

              <Route
                path="customers"
                element={
                  <PermissionRoute permission="customers.view">
                    <Customers />
                  </PermissionRoute>
                }
              />
              <Route
                path="customers/:id"
                element={
                  <PermissionRoute permission="customers.view">
                    <CustomerDetail />
                  </PermissionRoute>
                }
              />
              <Route
                path="parts"
                element={
                  <PermissionRoute permission="parts.view">
                    <Parts />
                  </PermissionRoute>
                }
              />
              <Route
                path="inventory"
                element={
                  <PermissionRoute permission="parts.view">
                    <Inventory />
                  </PermissionRoute>
                }
              />
              <Route
                path="tickets"
                element={
                  <PermissionRoute permission="tickets.view">
                    <Tickets />
                  </PermissionRoute>
                }
              />
              <Route
                path="tickets/:id"
                element={
                  <PermissionRoute permission="tickets.view">
                    <TicketDetail />
                  </PermissionRoute>
                }
              />
              <Route
                path="sms"
                element={
                  <PermissionRoute permission={['sms.send', 'sms.logs']}>
                    <SmsCenter />
                  </PermissionRoute>
                }
              />

              {/* Separated Settings Pages */}
              <Route path="settings" element={<Navigate to="/settings/ticketing" replace />} />
              <Route
                path="settings/ticketing"
                element={
                  <PermissionRoute permission="settings.manage">
                    <TicketingSettingsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="settings/sms"
                element={
                  <PermissionRoute permission="settings.manage">
                    <SmsSettingsPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="settings/users"
                element={
                  <PermissionRoute permission="users.manage">
                    <UsersAclPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="settings/users/create"
                element={
                  <PermissionRoute permission="users.manage">
                    <CreateUserPage />
                  </PermissionRoute>
                }
              />
              <Route
                path="settings/users/:id/edit"
                element={
                  <PermissionRoute permission="users.manage">
                    <EditUserPage />
                  </PermissionRoute>
                }
              />
              <Route path="settings/profile" element={<MyProfilePage />} />
              <Route path="settings/system" element={<SystemSettingsPage />} />
              <Route
                path="settings/backup"
                element={
                  <PermissionRoute permission="settings.manage">
                    <BackupPage />
                  </PermissionRoute>
                }
              />
              <Route path="backup" element={<Navigate to="/settings/backup" replace />} />
              <Route path="profile" element={<Navigate to="/settings/profile" replace />} />

              <Route path="403" element={<AccessDenied />} />
              <Route path="access-denied" element={<AccessDenied />} />
              <Route path="404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-left"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily: 'var(--font-sans)',
              background: 'var(--color-base-100)',
              color: 'var(--color-base-content)',
              border: '1px solid var(--color-base-300)',
              borderRadius: '14px',
              direction: 'rtl',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
