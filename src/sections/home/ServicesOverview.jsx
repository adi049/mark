import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FEATURED_SERVICES, SERVICES, STANDARD_SERVICES } from '@/data/services'
import { ROUTES } from '@/lib/constants'

import {
  Aperture,
  BookOpen,
  CalendarDays,
  Camera,
  Clapperboard,
  Film,
  Flower2,
  GlassWater,
  Heart,
  Megaphone,
  PenTool,
  Plane,
  Printer,
  Sparkles,
  Sun,
} from 'lucide-react'

const ICONS = {
  Camera,
  Clapperboard,
  Aperture,
  Heart,
  Sparkles,
  CalendarDays,
  Film,
  PenTool,
  Megaphone,
  Sun,
  Flower2,
  GlassWater,
  Plane,
  BookOpen,
  Printer,
}

/**
 * Services overview on the home page: two large image cards for the wedding
 * lines, nine compact icon tiles and one wide banner, so the grid breathes
 * instead of repeating identical rectangles. Every card deep links to its
 * section on the services page.
 */
export function ServicesOverview() {
  const tiles = STANDARD_SERVICES.filter((service) => service.slug !== 'social-media-management').slice(0, 9)
  const wide = SERVICES.find((service) => service.slug === 'social-media-management')
  const WideIcon = wide ? ICONS[wide.icon] : null

  return (
    <Section tint="alt">
      <Container>
        <SectionHeading
          eyebrow="Services"
          title="What the studio does"
          description="Fifteen service lines across photography, cinematography and post production, all finished in house."
        />

        <div className="mp-services-overview">
          {FEATURED_SERVICES.map((service, index) => (
            <Reveal key={service.slug} className="mp-ov-feature" delay={index * 0.08}>
              <Link
                className={`mp-service-feature mp-service-feature--${service.accent}`}
                to={`/services#service-${service.slug}`}
              >
                <figure className="mp-service-feature__media">
                  <img src={service.image} alt={service.imageAlt} loading="lazy" />
                </figure>
                <div className="mp-service-feature__body">
                  <h3 className="mp-service-feature__title">{service.title}</h3>
                  <p className="mp-service-feature__text">{service.text}</p>
                  <span className="mp-text-link">
                    See details
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}

          {tiles.map((service, index) => {
            const Icon = ICONS[service.icon]
            return (
              <Reveal key={service.slug} className="mp-ov-tile" delay={Math.min(index * 0.05, 0.2)}>
                <Link
                  className={`mp-service-tile mp-service-tile--${service.accent}`}
                  to={`/services#service-${service.slug}`}
                >
                  {Icon ? (
                    <span className="mp-service-tile__icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                  ) : null}
                  <h3 className="mp-service-tile__title">{service.title}</h3>
                  <ArrowRight className="mp-service-tile__arrow" size={16} aria-hidden="true" />
                </Link>
              </Reveal>
            )
          })}

          {wide && WideIcon ? (
            <Reveal className="mp-ov-wide" delay={0.08}>
              <Link
                className="mp-service-wide mp-service-wide--pink"
                to={`/services#service-${wide.slug}`}
              >
                <span className="mp-service-wide__icon">
                  <WideIcon size={22} aria-hidden="true" />
                </span>
                <span className="mp-service-wide__text">
                  <h3 className="mp-service-wide__title">{wide.title}</h3>
                  <p className="mp-service-wide__sub">{wide.text}</p>
                </span>
                <ArrowRight className="mp-service-wide__arrow" size={18} aria-hidden="true" />
              </Link>
            </Reveal>
          ) : null}
        </div>

        <div className="mp-section-actions">
          <Button to={ROUTES.SERVICES.path} variant="secondary">
            All services
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </Section>
  )
}
