import { useEffect, useState } from 'react'

/** useState that persists to localStorage (per browser, best effort). */
export function useLocalState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // Fall through to the default.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Not persisted; the value still works for this session.
    }
  }, [key, value])

  return [value, setValue] as const
}
