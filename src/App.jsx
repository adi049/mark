import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { OpeningIntro } from '@/components/intro/OpeningIntro'
import { RouteLoading } from '@/components/system/RouteLoading'
import { ScrollToTop } from '@/components/system/ScrollToTop'
import { MainLayout } from '@/layouts/MainLayout'
import { shouldRunIntro, markIntroSeen } from '@/lib/intro'
import { ROUTES } from '@/lib/constants'
import NotFound from '@/pages/NotFound'

const Home = lazy(() => import('@/pages/Home'))
const About = lazy(() => import('@/pages/About'))
const Services = lazy(() => import('@/pages/Services'))
const ClientAccess = lazy(() => import('@/pages/ClientAccess'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Marketing = lazy(() => import('@/pages/Marketing'))
const Blogs = lazy(() => import('@/pages/Blogs'))
const BlogPost = lazy(() => import('@/pages/BlogPost'))
const Contact = lazy(() => import('@/pages/Contact'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const TermsAndConditions = lazy(() => import('@/pages/TermsAndConditions'))
const AdminEntry = lazy(() => import('@/pages/admin/AdminEntry'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminClients = lazy(() => import('@/pages/admin/AdminClients'))
const AdminEvents = lazy(() => import('@/pages/admin/AdminEvents'))
const AdminGallery = lazy(() => import('@/pages/admin/AdminGallery'))
const AdminEventGallery = lazy(() => import('@/pages/admin/AdminEventGallery'))
const AdminBlogs = lazy(() => import('@/pages/admin/AdminBlogs'))
const AdminServices = lazy(() => import('@/pages/admin/AdminServices'))
const AdminMarketing = lazy(() => import('@/pages/admin/AdminMarketing'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminLayout = lazy(() => import('@/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminProtected = lazy(() =>
  import('@/components/admin/AdminShell').then((m) => ({ default: m.AdminProtected }))
)

function ContentProtection() {
  useEffect(() => {
    const inGallery = (target) => target?.closest?.('.mp-cg, .mp-viewer, .mp-fm')
    const blockContextMenu = (event) => { if (inGallery(event.target)) event.preventDefault() }
    const blockDrag = (event) => { if (inGallery(event.target)) event.preventDefault() }
    const blockShortcuts = (event) => {
      const key = String(event.key || '').toLowerCase()
      if ((event.ctrlKey || event.metaKey) && ['s', 'u', 'p'].includes(key)) event.preventDefault()
      if (event.key === 'PrintScreen') {
        document.body.classList.add('mp-capture-warning')
        window.setTimeout(() => document.body.classList.remove('mp-capture-warning'), 1200)
      }
    }
    const onVisibility = () => document.body.classList.toggle('mp-page-hidden', document.visibilityState === 'hidden')
    document.addEventListener('contextmenu', blockContextMenu)
    document.addEventListener('dragstart', blockDrag)
    document.addEventListener('keydown', blockShortcuts)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu)
      document.removeEventListener('dragstart', blockDrag)
      document.removeEventListener('keydown', blockShortcuts)
      document.removeEventListener('visibilitychange', onVisibility)
      document.body.classList.remove('mp-page-hidden', 'mp-capture-warning')
    }
  }, [])
  return null
}

export default function App() {
  const [showIntro, setShowIntro] = useState(shouldRunIntro)

  const handleIntroComplete = () => {
    markIntroSeen()
    setShowIntro(false)
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ScrollToTop />
      <ContentProtection />
      <div className="mp-app-shell" inert={showIntro}>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path={ROUTES.HOME.path} element={<Home />} />
              <Route path={ROUTES.ABOUT.path} element={<About />} />
              <Route path={ROUTES.SERVICES.path} element={<Services />} />
              <Route path={ROUTES.CLIENT_ACCESS.path} element={<ClientAccess />} />
              <Route path={ROUTES.GALLERY.path} element={<Gallery />} />
              <Route path={ROUTES.MARKETING.path} element={<Marketing />} />
              <Route path={ROUTES.BLOGS.path} element={<Blogs />} />
              <Route path="/blogs/:slug" element={<BlogPost />} />
              <Route path={ROUTES.CONTACT.path} element={<Contact />} />
              <Route path={ROUTES.PRIVACY_POLICY.path} element={<PrivacyPolicy />} />
              <Route path={ROUTES.TERMS_AND_CONDITIONS.path} element={<TermsAndConditions />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path={ROUTES.ADMIN.path} element={<AdminLayout />}>
              <Route index element={<AdminEntry />} />
              <Route element={<AdminProtected />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="clients" element={<AdminClients />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="gallery" element={<AdminGallery />} />
                <Route path="gallery/:eventId" element={<AdminEventGallery />} />
                <Route path="blogs" element={<AdminBlogs />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="marketing" element={<AdminMarketing />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </div>
      {showIntro ? <OpeningIntro onComplete={handleIntroComplete} /> : null}
    </BrowserRouter>
  )
}
