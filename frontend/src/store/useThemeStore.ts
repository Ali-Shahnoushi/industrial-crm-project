import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeName = 'nikan-light' | 'nikan-dark'
export type ThemeColor = 'default' | 'blue' | 'green' | 'red'

interface ThemeState {
  theme: ThemeName
  color: ThemeColor
  setTheme: (t: ThemeName) => void
  setColor: (c: ThemeColor) => void
  toggle: () => void
}

const applyTheme = (t: ThemeName) => {
  document.documentElement.setAttribute('data-theme', t)
  if (t === 'nikan-dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
const applyColor = (c: ThemeColor) => document.documentElement.setAttribute('data-color', c)

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: document.documentElement.getAttribute('data-theme') === 'nikan-dark' ? 'nikan-dark' : 'nikan-light',
      color: (document.documentElement.getAttribute('data-color') as ThemeColor) || 'default',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setColor: (color) => {
        applyColor(color)
        set({ color })
      },
      toggle: () => get().setTheme(get().theme === 'nikan-light' ? 'nikan-dark' : 'nikan-light'),
    }),
    {
      name: 'nikan-theme-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          applyColor(state.color)
        }
      },
    },
  ),
)
