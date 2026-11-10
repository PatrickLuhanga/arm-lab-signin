import { Loader2, Lock } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import AdminPasswordSetup from '../components/AdminPasswordSetup'
import {
  changeAdminPassword,
  isAdminPasswordConfigured,
  setAdminPassword,
  verifyAdminPassword,
} from '../db/adminAuth'
import { errorMessage } from '../lib/errors'

interface AdminAuthContextValue {
  isAdminUnlocked: boolean
  unlock: (password: string) => Promise<boolean>
  lock: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

function StartupScreen({ error }: { error: string | null }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface text-slate-500 dark:text-slate-400">
        {error ? (
          <Lock size={24} aria-hidden="true" />
        ) : (
          <Loader2 size={24} aria-hidden="true" className="animate-spin" />
        )}
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-ink">
        {error ? 'Could not load Admin security settings' : 'Preparing Arm Lab'}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        {error ?? 'Loading the local SQLite database and checking Admin protection...'}
      </p>
    </div>
  )
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    isAdminPasswordConfigured()
      .then((configured) => {
        if (active) {
          setNeedsSetup(!configured)
        }
      })
      .catch((loadError) => {
        if (active) {
          setStartupError(errorMessage(loadError))
          setNeedsSetup(true)
        }
      })
      .finally(() => {
        if (active) {
          setReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const completeSetup = useCallback(async (password: string) => {
    await setAdminPassword(password)
    setNeedsSetup(false)
    setIsAdminUnlocked(false)
  }, [])

  const unlock = useCallback(async (password: string) => {
    const isValid = await verifyAdminPassword(password)

    if (isValid) {
      setIsAdminUnlocked(true)
    }

    return isValid
  }, [])

  const lock = useCallback(() => {
    setIsAdminUnlocked(false)
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changeAdminPassword(currentPassword, newPassword)
    },
    [],
  )

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAdminUnlocked,
      unlock,
      lock,
      changePassword,
    }),
    [isAdminUnlocked, unlock, lock, changePassword],
  )

  if (!ready) {
    return <StartupScreen error={startupError} />
  }

  if (needsSetup) {
    return <AdminPasswordSetup onComplete={completeSetup} initialError={startupError} />
  }

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)

  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }

  return context
}
