import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Footer } from '@/components/navigation/Footer'
import { Navbar } from '@/components/navigation/Navbar'
import { FloatingContact } from '@/components/contact/FloatingContact'
import { PageTransition } from '@/components/system/PageTransition'
import { RouteLoading } from '@/components/system/RouteLoading'
import { SkipLink } from '@/components/system/SkipLink'

/**
 * Public site shell: skip link, sticky navbar, animated page content,
 * footer and the fixed contact rail. One layout, every public page.
 */
export function MainLayout() {
  return (
    <div className="mp-app">
      <SkipLink />
      <Navbar />
      <main className="mp-app__main" id="main-content">
        <Suspense fallback={<RouteLoading />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>
      <Footer />
      <FloatingContact />
    </div>
  )
}
