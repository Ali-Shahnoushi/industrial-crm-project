import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../services/api'
import type { SystemFeatureKey, SystemFeatureMap } from '../types'

const DEFAULT_FEATURES: SystemFeatureMap = {
  parts: true,
  sales: true,
  tickets: true,
  sms: true,
  customer_portal: true,
  backup: true,
  otp_login: true,
}

export function useSystemConfig() {
  const { data: companySettings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: settingsApi.getCompanySettings,
    staleTime: 5 * 60 * 1000,
  })

  const features: SystemFeatureMap = {
    ...DEFAULT_FEATURES,
    ...(companySettings?.features ?? {}),
  }

  const appVersion =
    companySettings?.app_version ||
    (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.5.0')

  const isFeatureEnabled = (key: SystemFeatureKey): boolean => {
    return features[key] !== false
  }

  return {
    companySettings,
    isLoading,
    appVersion,
    features,
    maxSessions: companySettings?.max_sessions ?? 3,
    isFeatureEnabled,
  }
}
