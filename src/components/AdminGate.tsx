import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import AdminPasswordPrompt from './AdminPasswordPrompt'

export default function AdminGate({ children }: { children: ReactNode }) {
  const { isAdminUnlocked, unlock, lock } = useAdminAuth()
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      lock()
    }
  }, [lock])

  if (!isAdminUnlocked) {
    return (
      <AdminPasswordPrompt
        onUnlock={unlock}
        onCancel={() => navigate('/sections')}
      />
    )
  }

  return <>{children}</>
}
