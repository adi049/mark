import { ArrowUpRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { MARKETING_PACKAGES } from '@/data/marketing'
import { fetchActiveMarketing } from '@/lib/dbAdapters'
import { useSEO } from '@/hooks/useSEO'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { buildWhatsAppLink } from '@/lib/utils'

/** Prices stay exactly as supplied, with or without the rupee sign. */
const asPrice = (value) => {
  if (!value) {
    return ''
  }
  if (typeof value === 'string' && value.includes('₹')) {
    return value
  }
  const digits = String(value).replace(/[^\d.]/g, '')
  if (!digits) {
    return String(value)
  }
  return `₹${Number(digits).toLocaleString('en-IN')}`
}

/**
 * Merges a marketing_services row onto the supplied marketing data so the
 * card keeps its unit and inclusions; the database title, description and
 * starting price always win.
 */
function mergeOffering(row, index) {
  const local = MARKETING_PACKAGES.find(
    (offering) => offering.name === row.title || offering.id === row.key
  )
  const inclusions = row.inclusions
    ? String(row.inclusions)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : local?.features ?? []
  return {
    id: row.id,
    name: row.title || local?.name || 'Creative service',
    price: asPrice(row.startingPrice) || local?.price || '',
    unit: local?.unit ?? (row.period ? `starting per ${row.period}` : 'starting'),
    text: row.description || row.content || local?.text || '',
    features: inclusions,
    accent: local?.accent ?? ['blue', 'green', 'pink'][index % 3],
    featured: local?.featured ?? index === 0,
  }
}

/**
 * Marketing and digital services. When the studio database is configured
 * the offerings come from the admin panel; without a backend the supplied
 * marketing data stands in so the page is always complete.
 */
export default function Marketing() {
  useSEO({
    title: 'Marketing',
    description:
      'Social media management, video editing and graphic design for brands: video shoots, edits, design and social content by the Markipie studio team.',
    path: '/marketing',
  })

  const { configured, status, data, error, refetch } = useSupabaseQuery(fetchActiveMarketing, [])

  let offerings = MARKETING_PACKAGES
  if (configured && status === 'success') {
    offerings = (Array.isArray(data) ? data : []).map(mergeOffering)
  }

  const loading = configured && status === 'loading'

  return (
    <>
      <PageHero
        eyebrow="Marketing"
        title="Marketing and digital services"
        description="Video shoots, edits and design for brands, handled by the same studio team that covers weddings and events."
      />

      <Section className="mp-marketing">
        <Container>
          {loading ? (
            <div className="mp-marketing__grid" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((key) => (
                <article key={key} className="mp-price-card is-loading">
                  <span className="mp-skeleton mp-skeleton--chip" />
                  <span className="mp-skeleton mp-skeleton--title" />
                  <span className="mp-skeleton" />
                </article>
              ))}
            </div>
          ) : configured && status === 'error' ? (
            <div className="mp-services__state mp-services__state--error" role="alert">
              <p className="mp-services__state-title">The creative services could not be loaded.</p>
              <p className="mp-services__state-text">{error}</p>
              <button type="button" className="mp-text-link" onClick={refetch}>
                Try again
              </button>
            </div>
          ) : offerings.length === 0 ? (
            <div className="mp-services__state">
              <p className="mp-services__state-title">Creative services are being prepared.</p>
              <p className="mp-services__state-text">
                Offerings published from the studio panel appear here. Until then, ask the studio
                directly about creative work for your brand.
              </p>
            </div>
          ) : (
            <div className="mp-marketing__grid">
              {offerings.map((pkg) => (
                <article
                  key={pkg.id}
                  className={`mp-price-card mp-price-card--${pkg.accent}${pkg.featured ? ' mp-price-card--featured' : ''}`}
                >
                  {pkg.featured ? <p className="mp-price-card__flag">Full service</p> : null}
                  <h2 className="mp-price-card__name">{pkg.name}</h2>
                  <p className="mp-price-card__price">
                    <span className="mp-price-card__amount">{pkg.price}</span>
                    <span className="mp-price-card__unit">{pkg.unit}</span>
                  </p>
                  {pkg.text ? <p className="mp-price-card__text">{pkg.text}</p> : null}
                  {pkg.features.length > 0 ? (
                    <ul className="mp-price-card__features">
                      {pkg.features.map((feature) => (
                        <li key={feature}>
                          <Check size={15} aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mp-price-card__actions">
                    <Button
                      href={buildWhatsAppLink(
                        `Hello Markipie, I would like to enquire about ${pkg.name}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant={pkg.featured ? 'primary' : 'secondary'}
                    >
                      Enquire
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="mp-section-note">
            Starting prices only. Final quotes depend on the scope of work. More packages join
            this page as they are finalized.
          </p>
        </Container>
      </Section>
    </>
  )
}
