import {
  CalendarDays,
  Clapperboard,
  Heart,
  Palette,
  Printer,
  Users,
} from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { STUDIO_STRENGTHS } from '@/data/facts'

const ICONS = {
  Heart,
  CalendarDays,
  Palette,
  Printer,
  Clapperboard,
  Users,
}

/**
 * Why Markipie: the verified studio facts as quiet cards. No invented
 * numbers, no testimonials.
 */
export function WhyMarkipie() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Why Markipie"
          title="Built to finish everything in house"
          description="The studio keeps its photography, cinematography, editing, color and print work under one roof."
          align="center"
        />
        <Reveal className="mp-why">
          <div className="mp-why__grid">
            {STUDIO_STRENGTHS.map((strength) => {
              const Icon = ICONS[strength.icon]
              return (
                <article key={strength.title} className="mp-why__card">
                  {Icon ? (
                    <span className="mp-why__icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                  ) : null}
                  <h3 className="mp-why__title">{strength.title}</h3>
                  <p className="mp-why__text">{strength.text}</p>
                </article>
              )
            })}
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}
