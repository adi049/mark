import {
  Aperture,
  ArrowUpRight,
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
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { FEATURED_SERVICES, SERVICES } from '@/data/services'
import { fetchActiveServices } from '@/lib/dbAdapters'
import { useSEO } from '@/hooks/useSEO'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { buildWhatsAppLink, cn } from '@/lib/utils'

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

const ACCENTS = ['blue', 'green', 'pink']

const enquiryLink = (title) =>
  buildWhatsAppLink(`Hello Markipie, I would like to enquire about ${title}.`)

/**
 * Guarantees the shape every render path relies on. Every service object
 * that reaches the JSX goes through this, so a missing field can never
 * throw during rendering, whichever list it came from.
 */
function normalizeService(service, index) {
  return {
    ...service,
    points: Array.isArray(service.points) ? service.points : [],
    icon: service.icon ?? 'Sparkles',
    accent: service.accent ?? ACCENTS[index % ACCENTS.length],
  }
}

/**
 * Merges a service row from the studio database onto the built-in service
 * data: matching by slug keeps the icon, accent and artwork; the database
 * title, description and order always win. Unknown services still render
 * with a default icon and a rotating accent.
 */
function mergeService(row, index) {
  const local = SERVICES.find((service) => service.slug === row.slug)
  return normalizeService(
    {
      slug: row.slug || local?.slug || `service-${index}`,
      title: row.title || local?.title || 'Service',
      text: row.description || local?.text || '',
      points: local?.points ?? [],
      icon: local?.icon ?? 'Sparkles',
      accent: local?.accent ?? ACCENTS[index % ACCENTS.length],
      featured: Boolean(local?.featured),
      image: row.image || local?.image || null,
      imageAlt: local?.imageAlt || 'Markipie studio artwork',
    },
    index
  )
}

/**
 * Services. Two large image cards for the wedding lines, the standard grid
 * for the remaining services and one wide card for social media management.
 * When the studio database is configured, the list comes from the admin
 * panel; without a backend the built-in service list stands in so the page
 * is always complete.
 */
export default function Services() {
  useSEO({
    title: 'Services',
    description:
      'Wedding photography, cinematography, candid, Haldi, Mehendi, reception and pre-wedding coverage, drone, albums, the color lab, editing, design and social media management by Markipie.',
    path: '/services',
  })

  const { configured, status, data, error, refetch } = useSupabaseQuery(fetchActiveServices, [])

  let list = SERVICES.map(normalizeService)
  let source = 'builtin'
  if (configured && status === 'success') {
    list = (Array.isArray(data) ? data : []).map(mergeService)
    source = 'database'
  }

  const loading = configured && status === 'loading'
  const wide = list.find((service) => service.slug === 'social-media-management')
  const featured = list.filter((service) => service.featured).slice(0, 2)
  const gridServices = list.filter((service) => !service.featured && service.slug !== wide?.slug)

  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Photography, cinematography and creative services"
        description="Every service line across weddings, events and brands. Packages are quoted around your dates, and the finishing stays in house."
      />

      <Section className="mp-services">
        <Container>
          <h2 className="mp-visually-hidden">Service list</h2>

          {loading ? (
            <div className="mp-services__grid" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((key) => (
                <article key={key} className="mp-service-card is-loading">
                  <span className="mp-skeleton mp-skeleton--chip" />
                  <span className="mp-skeleton mp-skeleton--title" />
                  <span className="mp-skeleton" />
                </article>
              ))}
            </div>
          ) : configured && status === 'error' ? (
            <div className="mp-services__state mp-services__state--error" role="alert">
              <p className="mp-services__state-title">The service list could not be loaded.</p>
              <p className="mp-services__state-text">{error}</p>
              <button type="button" className="mp-text-link" onClick={refetch}>
                Try again
              </button>
            </div>
          ) : source === 'database' && list.length === 0 ? (
            <div className="mp-services__state">
              <p className="mp-services__state-title">The service list is being prepared.</p>
              <p className="mp-services__state-text">
                Services published from the studio panel appear here. Until then, ask the studio
                directly about coverage for your dates.
              </p>
              <Link className="mp-text-link" to="/contact">
                Contact the studio
              </Link>
            </div>
          ) : (
            <>
              {featured.length > 0 ? (
                <div className="mp-services__featured">
                  {featured.map((service) => (
                    <article
                      key={service.slug}
                      id={`service-${service.slug}`}
                      className={`mp-service-detail mp-service-detail--${service.accent}`}
                    >
                      {service.image ? (
                        <figure className="mp-service-detail__media">
                          <img src={service.image} alt={service.imageAlt} loading="lazy" />
                        </figure>
                      ) : null}
                      <div className="mp-service-detail__body">
                        <h3 className="mp-service-detail__title">{service.title}</h3>
                        <p className="mp-service-detail__text">{service.text}</p>
                        {service.points.length > 0 ? (
                          <ul className="mp-service-detail__points">
                            {service.points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : null}
                        <a
                          className="mp-service-detail__cta"
                          href={enquiryLink(service.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Enquire on WhatsApp
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="mp-services__grid">
                {gridServices.map((service, index) => {
                  const Icon = ICONS[service.icon] ?? Sparkles
                  return (
                    <article
                      key={service.slug}
                      id={`service-${service.slug}`}
                      className={cn('mp-service-card', `mp-service-card--${service.accent}`)}
                    >
                      <div className="mp-service-card__media">
                        <Icon size={26} aria-hidden="true" />
                      </div>
                      <div className="mp-service-card__body">
                        <h3 className="mp-service-card__title">{service.title}</h3>
                        <p className="mp-service-card__text">{service.text}</p>
                        {service.points.length > 0 ? (
                          <ul className="mp-service-card__points">
                            {service.points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : null}
                        <a
                          className="mp-service-card__cta"
                          href={enquiryLink(service.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Enquire on WhatsApp
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>

              {wide ? (
                <article id={`service-${wide.slug}`} className="mp-service-wide mp-service-wide--pink">
                  <span className="mp-service-wide__icon">
                    {(() => {
                      const WideIcon = ICONS[wide.icon] ?? Megaphone
                      return <WideIcon size={24} aria-hidden="true" />
                    })()}
                  </span>
                  <span className="mp-service-wide__text">
                    <h3 className="mp-service-wide__title">{wide.title}</h3>
                    <p className="mp-service-wide__sub">{wide.text}</p>
                  </span>
                  <a
                    className="mp-service-wide__cta"
                    href={enquiryLink(wide.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Enquire
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </article>
              ) : null}
            </>
          )}
        </Container>
      </Section>
    </>
  )
}
