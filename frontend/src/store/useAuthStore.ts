import { create } from 'zustand'
import { authApi } from '../services/api'
import { queryClient } from './queryClient'
import type { User, UserType } from '../types'

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
  hasRole: (role: UserType) => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isInitialized: false,

  async initAuth() {
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
      queryClient.clear()
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
      queryClient.clear()
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
      queryClient.clear()
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
    if (u.user_type === 'administrator' || u.email === 'admin@crm.local') return true
    return u.permissions?.includes(permission) || false
  },

  isAdministrator() {
    const u = get().user
    if (!u) return false
    return u.user_type === 'administrator' || u.email === 'admin@crm.local'
  },

  hasRole(role: UserType) {
    return get().user?.user_type === role
  },
}))
