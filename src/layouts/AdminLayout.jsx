import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { RouteLoading } from '@/components/system/RouteLoading'
import { AdminAuthProvider } from '@/hooks/useAdminAuth'
import { useSEO } from '@/hooks/useSEO'

/**
 * Admin area frame. It provides the auth context (session, login, logout,
 * configuration state) and nothing else: the login screen renders bare,
 * and protected pages render inside the AdminShell from AdminProtected.
 * The public navbar and footer never appear here.
 */
export function AdminLayout() {
  // The whole admin area stays out of search results.
  useSEO({ title: 'Admin', noindex: true })

  return (
    <AdminAuthProvider>
      <main className="mp-admin-area" id="main-content">
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </AdminAuthProvider>
  )
}
