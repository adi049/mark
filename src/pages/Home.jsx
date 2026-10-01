import { useSEO } from '@/hooks/useSEO'
import { SITE } from '@/lib/constants'
import {
  Hero,
  BrandIntro,
  ServicesOverview,
  FeaturedWork,
  Packages,
  WhyMarkipie,
  MarketingCta,
  ClientAccessCta,
  LatestBlogs,
  ContactCta,
} from '@/sections/home'

/**
 * Home, as a journey: hero, brand introduction, services, featured work,
 * packages, why Markipie, creative services, client access, the journal
 * and the closing call to action.
 */
export default function Home() {
  useSEO({
    title: 'MARKIPIE | Photography & Cinematography',
    description: SITE.description,
    path: '/',
  })

  return (
    <>
      <Hero />
      <BrandIntro />
      <ServicesOverview />
      <FeaturedWork />
      <Packages />
      <WhyMarkipie />
      <MarketingCta />
      <ClientAccessCta />
      <LatestBlogs />
      <ContactCta />
    </>
  )
}
