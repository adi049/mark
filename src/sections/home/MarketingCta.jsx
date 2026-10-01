import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { MARKETING_PACKAGES } from '@/data/marketing'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Creative and marketing services teaser on the home page. The three
 * offerings and their starting prices come straight from the supplied
 * marketing data; the full detail lives on the marketing page.
 */
export function MarketingCta() {
  return (
    <Section className="mp-marketing-teaser" tint="alt">
      <Container>
        <SectionHeading
          eyebrow="Creative services"
          title="Marketing and digital, by the same studio"
          description="Video shoots, edits, design and social media management for brands, produced by the team behind the wedding coverage."
        />

        <div className="mp-marketing-teaser__grid">
          {MARKETING_PACKAGES.map((offering, index) => (
            <Reveal
              key={offering.id}
              className={cn('mp-marketing-teaser__card', `mp-marketing-teaser__card--${offering.accent}`)}
              delay={Math.min(index * 0.06, 0.2)}
            >
              <h3 className="mp-marketing-teaser__name">{offering.name}</h3>
              <p className="mp-marketing-teaser__price">
                {offering.price}
                <span> {offering.unit}</span>
              </p>
              <p className="mp-marketing-teaser__text">
                {offering.text ||
                  (offering.features.length > 0 ? offering.features.join(' · ') : null)}
              </p>
            </Reveal>
          ))}
        </div>

        <div className="mp-section-actions mp-section-actions--center">
          <Button to={ROUTES.MARKETING.path} variant="secondary">
            Explore creative services
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <a
            className="mp-text-link"
            href={ROUTES.CONTACT.path}
          >
            Talk to the studio
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </Container>
    </Section>
  )
}
