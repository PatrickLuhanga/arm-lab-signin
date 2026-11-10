import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getSetting, setSetting, THEME_SETTING_KEY } from '../db/settings'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const userChangedTheme = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    getSetting(THEME_SETTING_KEY)
      .then((storedTheme) => {
        if (mounted.current && isTheme(storedTheme)) {
          setThemeState(storedTheme)
        }
      })
      .catch(() => {
        // The app falls back to light mode when the setting cannot be read.
      })

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme

    if (userChangedTheme.current) {
      setSetting(THEME_SETTING_KEY, theme).catch(() => {
        // Theme still applies for the current session if persistence fails.
      })
    }
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    userChangedTheme.current = true
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    userChangedTheme.current = true
    setThemeState((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
