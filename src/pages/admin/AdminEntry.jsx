import { Navigate } from 'react-router-dom'
import { AdminLogin } from '@/pages/admin/AdminLogin'
import { AdminLoading } from '@/components/admin/StatePanels'
import { useAdminAuth } from '@/hooks/useAdminAuth'

/**
 * /admin index. Signed in admins continue to the dashboard; everyone
 * else meets the login screen. No protected content renders here before
 * the session is known.
 */
export default function AdminEntry() {
  const { status, session } = useAdminAuth()

  if (status === 'loading') {
    return (
      <div className="mp-adm-page">
        <AdminLoading label="Checking your session" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <AdminLogin />
}
