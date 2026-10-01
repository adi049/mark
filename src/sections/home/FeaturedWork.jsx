import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ROUTES } from '@/lib/constants'

const TILES = [
  {
    category: 'Wedding',
    src: '/assets/placeholders/wide-ink.jpg',
    alt: 'Studio artwork in deep charcoal tones',
    span: 'lead',
  },
  {
    category: 'Engagement',
    src: '/assets/placeholders/portrait-blush.jpg',
    alt: 'Studio artwork in soft blush pink tones',
    span: 'tall',
  },
  {
    category: 'Haldi',
    src: '/assets/placeholders/square-sage.jpg',
    alt: 'Studio artwork in soft sage green tones',
    span: null,
  },
  {
    category: 'Mehendi',
    src: '/assets/placeholders/square-blush.jpg',
    alt: 'Studio artwork in soft blush pink tones',
    span: null,
  },
  {
    category: 'Reception',
    src: '/assets/placeholders/tall-sage.jpg',
    alt: 'Studio artwork in soft sage green tones',
    span: null,
  },
  {
    category: 'Pre-Wedding',
    src: '/assets/placeholders/landscape-blush.jpg',
    alt: 'Studio artwork in soft blush pink tones',
    span: null,
  },
  {
    category: 'Cinematography',
    src: '/assets/placeholders/wide-sky.jpg',
    alt: 'Studio artwork in soft sky blue tones',
    span: 'wide',
  },
]

/**
 * Featured work: one large lead image, a tall companion, a row of four and a
 * wide close. Every tile opens the gallery; the photography is the focus.
 */
export function FeaturedWork() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Featured work"
          title="Selected celebrations"
          description="Weddings, engagements, Haldi, Mehendi, receptions, pre-wedding shoots and events, collected event by event."
        />

        <div className="mp-featured">
          {TILES.map((tile, index) => (
            <Reveal
              key={tile.category + tile.src}
              className={tile.span ? `mp-featured__wrap mp-featured__wrap--${tile.span}` : 'mp-featured__wrap'}
              delay={Math.min(index * 0.05, 0.25)}
            >
              <Link
                className={`mp-featured__tile${tile.span ? ` mp-featured__tile--${tile.span}` : ''}`}
                to={ROUTES.GALLERY.path}
                aria-label={`Open the gallery, ${tile.category}`}
              >
                <img src={tile.src} alt={tile.alt} loading="lazy" />
                <span className="mp-featured__scrim" aria-hidden="true" />
                <span className="mp-featured__label">{tile.category}</span>
              </Link>
            </Reveal>
          ))}
        </div>

        <p className="mp-section-note">
          New collections are published as events wrap up. Every tile opens the gallery.
        </p>

        <div className="mp-section-actions">
          <Button to={ROUTES.GALLERY.path} variant="secondary">
            View Full Gallery
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </Section>
  )
}
