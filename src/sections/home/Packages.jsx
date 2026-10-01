import { useState } from 'react'
import { Container } from '@/components/ui/Container'
import { PackageCard } from '@/components/packages/PackageCard'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { PACKAGE_GROUPS } from '@/data/packages'
import { cn } from '@/lib/utils'

/**
 * The complete photography package display. Tabs switch between wedding,
 * engagement and pre-wedding coverage; cards keep their full detail behind
 * the expandable toggle. Prices and inclusions are exactly as provided.
 */
export function Packages() {
  const [activeId, setActiveId] = useState(PACKAGE_GROUPS[0].id)
  const group = PACKAGE_GROUPS.find((entry) => entry.id === activeId) ?? PACKAGE_GROUPS[0]

  return (
    <Section id="packages" tint="alt" className="mp-packages">
      <Container>
        <SectionHeading
          eyebrow="Packages"
          title="Photography packages"
          description="Wedding, engagement and pre-wedding coverage with clear pricing. Every package is shot and finished by the in-house teams."
        />

        <div className="mp-packages__tabs" role="group" aria-label="Package categories">
          {PACKAGE_GROUPS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={cn('mp-tab', entry.id === activeId && 'is-active')}
              aria-pressed={entry.id === activeId}
              onClick={() => setActiveId(entry.id)}
            >
              {entry.label}
              <span className="mp-tab__count">{entry.packages.length}</span>
            </button>
          ))}
        </div>

        <div className="mp-packages__grid" key={group.id}>
          {group.packages.map((pkg, index) => (
            <Reveal key={pkg.id} className="mp-packages__item" delay={Math.min(index * 0.06, 0.2)}>
              <PackageCard pkg={pkg} groupLabel={group.label} />
            </Reveal>
          ))}
        </div>

        <p className="mp-section-note">
          Message the studio on WhatsApp for dates and availability.
        </p>
      </Container>
    </Section>
  )
}
