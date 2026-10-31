import { create } from 'zustand'
import { authApi } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isInitialized: boolean
  initAuth: () => Promise<void>
  login: (login: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  loginWithOtp: (phone: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  setUser: (user: User | null) => void
  hasPermission: (permission: string) => boolean
  isAdministrator: () => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isInitialized: false,

  /**
   * Initializes authentication state on application startup.
   * Fetches the current user and ACLs directly from the backend API using httpOnly cookies.
   * Wipes any legacy sensitive data from localStorage to ensure clean memory-only state.
   */
  async initAuth() {
    // Purge any legacy localStorage items from previous versions
    try {
      localStorage.removeItem('crm_token')
      localStorage.removeItem('crm_user')
      localStorage.removeItem('crm-auth')
    } catch {
      // Ignore in environments where localStorage might be restricted
    }

    try {
      const user = await authApi.me()
      set({ user, isInitialized: true })
    } catch {
      set({ user: null, isInitialized: true })
    }
  },

  async login(login, password) {
    try {
      const res = await authApi.login(login, password)
      set({ user: res.user, isInitialized: true })
      return { ok: true }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.login?.[0] ||
        'نام کاربری یا رمز عبور اشتباه است.'
      return { ok: false, error: msg }
    }
  },

  async loginWithOtp(phone, code) {
    try {
      const res = await authApi.verifyOtp(phone, code)
      set({ user: res.user, isInitialized: true })
      return { ok: true }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.code?.[0] ||
        err.response?.data?.errors?.phone?.[0] ||
        'کد وارد شده اشتباه است یا منقضی شده است.'
      return { ok: false, error: msg }
    }
  },

  async logout() {
    try {
      await authApi.logout()
    } catch {
      // Proceed with local logout regardless of network error
    } finally {
      set({ user: null, isInitialized: true })
    }
  },

  async refreshMe() {
    try {
      const user = await authApi.me()
      set({ user })
    } catch {
      set({ user: null })
    }
  },

  setUser(user) {
    set({ user })
  },

  hasPermission(permission: string) {
    const u = get().user
    if (!u) return false
    return u.permissions?.includes(permission) || false
  },

  isAdministrator() {
    return get().user?.user_type === 'administrator'
  },
}))
