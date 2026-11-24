import { create } from 'zustand'
import { authApi } from '../services/api'
import { queryClient } from './queryClient'
import type { SessionLimitChallenge, User, UserType } from '../types'

type LoginResult =
  | { ok: true }
  | { ok: false; error: string; sessionLimit?: SessionLimitChallenge }

interface AuthState {
  user: User | null
  isInitialized: boolean
  initAuth: () => Promise<void>
  login: (login: string, password: string) => Promise<LoginResult>
  loginWithOtp: (phone: string, code: string) => Promise<LoginResult>
  resolveSessionLimit: (
    challengeToken: string,
    revokeTokenIds: number | number[],
  ) => Promise<LoginResult>
  logout: () => Promise<void>
  forceClearSession: () => void
  refreshMe: () => Promise<void>
  setUser: (user: User | null) => void
  hasPermission: (permission: string) => boolean
  isAdministrator: () => boolean
  hasRole: (role: UserType) => boolean
}

function parseErrorData(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === 'object') {
    return raw as Record<string, any>
  }
  if (typeof raw === 'string') {
    const jsonStart = raw.indexOf('{')
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart))
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, any>
        }
      } catch {
        return null
      }
    }
  }
  return null
}

function extractSessionLimit(err: any): SessionLimitChallenge | undefined {
  const data = parseErrorData(err?.response?.data)
  if (err?.response?.status === 409 && data?.code === 'MAX_SESSIONS_REACHED' && data?.challenge_token) {
    return data as SessionLimitChallenge
  }
  return undefined
}

function formatAuthError(err: any, mode: 'password' | 'otp' | 'resolve'): string {
  if (!err?.response) {
    return 'امکان برقراری ارتباط با سرور وجود ندارد. لطفاً مطمئن شوید سرور بک‌اند در حال اجرا است.'
  }

  const status: number = err.response.status
  const data = parseErrorData(err.response.data)

  const serverMessage =
    data?.message ||
    data?.errors?.login?.[0] ||
    data?.errors?.code?.[0] ||
    data?.errors?.phone?.[0]

  if (serverMessage) {
    return String(serverMessage)
  }

  if (status === 429) {
    return 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً یک دقیقه دیگر مجدداً تلاش کنید.'
  }
  if (status === 403) {
    return 'دسترسی ورود به این حساب کاربری مسدود یا غیرفعال شده است.'
  }
  if (status === 409) {
    return 'تعداد دستگاه‌های فعال شما به حد مجاز رسیده است. لطفاً یکی از نشست‌های قبلی را خارج کنید.'
  }
  if (status >= 500) {
    return 'خطای داخلی سرور هنگام پردازش درخواست ورود رخ داد. لطفاً لاگ سرور را بررسی کنید.'
  }
  if (status === 401 || status === 422) {
    if (mode === 'otp') {
      return 'کد وارد شده اشتباه است یا منقضی شده است.'
    }
    if (mode === 'resolve') {
      return 'نشست انتخاب‌شده معتبر نیست یا منقضی شده است.'
    }
    return 'نام کاربری یا رمز عبور اشتباه است.'
  }

  return 'خطای نامشخص در ورود به سامانه. لطفاً مجدداً تلاش کنید.'
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
      const sessionLimit = extractSessionLimit(err)
      if (sessionLimit) {
        return { ok: false, error: sessionLimit.message, sessionLimit }
      }
      return { ok: false, error: formatAuthError(err, 'password') }
    }
  },

  async loginWithOtp(phone, code) {
    try {
      const res = await authApi.verifyOtp(phone, code)
      queryClient.clear()
      set({ user: res.user, isInitialized: true })
      return { ok: true }
    } catch (err: any) {
      const sessionLimit = extractSessionLimit(err)
      if (sessionLimit) {
        return { ok: false, error: sessionLimit.message, sessionLimit }
      }
      return { ok: false, error: formatAuthError(err, 'otp') }
    }
  },

  async resolveSessionLimit(challengeToken, revokeTokenIds) {
    try {
      const res = await authApi.resolveSessionLimit(challengeToken, revokeTokenIds)
      queryClient.clear()
      set({ user: res.user, isInitialized: true })
      return { ok: true }
    } catch (err: any) {
      const sessionLimit = extractSessionLimit(err)
      if (sessionLimit) {
        return { ok: false, error: sessionLimit.message, sessionLimit }
      }
      return { ok: false, error: formatAuthError(err, 'resolve') }
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

  forceClearSession() {
    queryClient.clear()
    set({ user: null, isInitialized: true })
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
