# Unified Enterprise CRM Merge Implementation Plan

> **Goal:** Merge all features, enhancements, and security hardening from branch `arena/5bcc3042-industrial-crm-project` into `main` (`c:\laragon\www\partdisel`), while strictly preserving the Full Database Backup & Restore module (`BackupController` & `BackupPage`), dynamic table sorting, and quick filters from `main`.

---

## Proposed Changes

### Backend Subsystem

#### 1. Database Migrations
- Keep existing `2026_11_09_000016_make_serial_number_nullable_in_customer_parts.php`.
- Copy `2026_11_09_000015_upgrade_v2_2_inventory_thresholds.php` adding `min_stock` and `unit` to `parts`.
- Copy ticketing & portal migration as `2026_11_09_000017_upgrade_v2_3_ticketing_and_customer_portal.php`.

#### 2. Models
- Copy `Ticket.php`, `TicketDepartment.php`, `TicketMessage.php`.
- Update `User.php`: add `ROLE_CUSTOMER`, `customer_id`, `isCustomerPortalUser()`, `scopeStaffOnly()`, `hasSafePermission()`, ticketing permissions, relations (`ticketDepartments`, `assignedTickets`, `customer`).
- Update `Customer.php`: add `portal_enabled`, `sales_manager_user_id`, relations (`salesManager`, `portalUser`, `tickets`).
- Update `Part.php`: add `min_stock`, `unit`, `is_low_stock` attribute.
- Update `SmsLog.php`: redact OTP codes (`tokens: ['text' => '[REDACTED]']`).

#### 3. Services & Middleware
- Copy `TicketAssignmentService.php`.
- Update `CustomerService.php`: add `deleteCustomer()` with inventory restoration/checks, `reconcileStock()`, custom warranty calculation, inactive part assignment protection.
- Update `MelipayamakService.php`: normalize mobile numbers (`+98`, `0098`, `98`), sandbox handling.
- Copy `EnsureCustomerPortalUser.php` and `EnsureStaffUser.php` into `app/Http/Middleware/` and register in `bootstrap/app.php`.

#### 4. Controllers & Security
- Copy `TicketController.php`, `TicketDepartmentController.php`, `CustomerPortalController.php`.
- Update `CustomerController.php`: add `staffOptions()`, `updateOwner()`, `managePortalAccess()`, safe `destroy()`, 8-11 digits landline validation, while keeping `sort_by` and all filters from main.
- Update `PartController.php`: add `inventorySummary()`, `low_stock_only`, `active_only`, `min_stock`, `unit`, custom warranty dates.
- Update `UserController.php`: `staffOnly()` query, `isPrimaryAdmin()` protection, `ensureCanMutateTarget()` privilege escalation checks, token revocation on deactivation.
- Update `AuthController.php`: strict OTP lockout and timing-safe verification, current password verification, token rotation.
- Update `SmsController.php`: customer scope guard.
- Update `CustomersExport.php`: CSV/XLSX formula injection protection (`sanitizeCell`, `sanitizeRow`).
- Update `CustomersImport.php`: two-pass Persian header matching, skipped/created/updated counts, permission checks.
- Keep `BackupController.php` unchanged.

#### 5. Routes & Tests
- Update `routes/api.php`: expose all ticketing, portal, inventory summary, owner transfer routes alongside all backup routes.
- Copy all arena test suites into `tests/Feature/` while keeping `BackupAndNullableSerialTest.php`.

---

### Frontend Subsystem

#### 1. State, Types & Utils
- Update `types/index.ts` with all ticketing, portal, inventory summary types.
- Add `store/queryClient.ts` and update `store/useAuthStore.ts` with `queryClient.clear()`.
- Update `utils/meta.ts` with ticketing, portal, and inventory metadata.
- Update `utils/format.ts` with `localTodayYmd()`.
- Add `components/common/ErrorBoundary.tsx`.

#### 2. Layouts & Menus
- Add `layouts/CustomerPortalLayout.tsx`.
- Update `layouts/NotificationsMenu.tsx` with low-stock alerts and owner-changed activity icon.
- Update `layouts/Sidebar.tsx` and `layouts/nav.ts` with `/inventory`, `/tickets`, and both `/settings/backup` and `/settings/ticketing`.

#### 3. Pages
- Add `pages/Inventory.tsx`.
- Add `pages/Tickets.tsx` and `pages/TicketDetail.tsx`.
- Add `pages/settings/TicketingSettingsPage.tsx`.
- Add `pages/portal/PortalDashboard.tsx`, `PortalDevices.tsx`, `PortalTickets.tsx`, `PortalTicketDetail.tsx`, `PortalProfile.tsx`.
- Update `pages/Dashboard.tsx` with low-stock banner and ticketing stat card.
- Update `pages/CustomerDetail.tsx` with owner transfer modal, portal access modal, and tickets tab.
- Update `pages/Customers.tsx`: combine quick filter chips and sorting from main with portal status and safe deletion messaging.
- Update `pages/Parts.tsx`: add min_stock, unit, physical adjustment modal, keeping table sorting.
- Update `pages/settings/MyProfilePage.tsx`: add current password requirement.
- Keep `pages/settings/BackupPage.tsx` active.
- Update `App.tsx` with all routes, permissions, and customer portal routing.
- Update `services/api.ts` with all ticketing, portal, inventory, and backup API calls.

---

## Verification Plan
1. Run `php artisan migrate` in `partdisel/backend`.
2. Run `php artisan test` in `partdisel/backend` to verify all test suites pass.
3. Run `npm run build` in `partdisel/frontend` to verify TypeScript compile and bundling.
4. Verify all live pages in browser using Playwright screenshots.
