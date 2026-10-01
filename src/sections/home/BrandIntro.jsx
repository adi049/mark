import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { IN_HOUSE_ITEMS, STUDIO_STATS } from '@/data/facts'
import { ROUTES } from '@/lib/constants'

/**
 * Brand introduction: who Markipie is on one side, the verified facts as a
 * quiet editorial list on the other. No counters, no stat boxes.
 */
export function BrandIntro() {
  return (
    <Section>
      <Container>
        <div className="mp-brand-intro">
          <Reveal className="mp-brand-intro__text">
            <SectionHeading
              eyebrow="The studio"
              title="One studio. Everything finished in house."
              description="Markipie covers weddings and events with its own photography and cinematography crews, and finishes every frame inside the studio: color lab, editing and print under one roof."
            />
            <div className="mp-section-actions">
              <Button to={ROUTES.ABOUT.path} variant="ghost">
                About the studio
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </Reveal>

          <Reveal className="mp-brand-intro__facts" delay={0.1}>
            <dl className="mp-facts">
              {STUDIO_STATS.map((stat) => (
                <div className="mp-facts__row" key={stat.label}>
                  <dt className="mp-facts__value">{stat.value}</dt>
                  <dd className="mp-facts__label">{stat.label}</dd>
                </div>
              ))}
            </dl>
            <div className="mp-inhouse">
              <p className="mp-inhouse__label">In house</p>
              <ul className="mp-inhouse__list">
                {IN_HOUSE_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
