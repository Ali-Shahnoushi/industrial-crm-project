import { useEffect, useState } from 'react'

export function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') === 'nikan-dark'
      : false,
  )

  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      setDark(el.getAttribute('data-theme') === 'nikan-dark')
    })
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return dark
}
