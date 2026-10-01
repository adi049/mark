import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'

/**
 * Shared legal page shell for Privacy Policy and Terms & Conditions.
 * Sections carry their own paragraph lists; every section renders real
 * content.
 */
export function LegalPage({ eyebrow, title, description, intro, updated, sections }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />

      <Section className="mp-legal">
        <Container width="narrow">
          <p className="mp-legal__intro">{intro}</p>
          {updated ? <p className="mp-legal__updated">Last updated: {updated}</p> : null}

          <div className="mp-legal__sections">
            {sections.map((section, index) => (
              <section key={section.heading} className="mp-legal__section">
                <h2 className="mp-legal__heading">
                  <span className="mp-legal__index">{String(index + 1).padStart(2, '0')}</span>
                  {section.heading}
                </h2>
                {(section.paragraphs ?? []).map((paragraph, pIndex) => (
                  <p key={pIndex} className="mp-legal__text">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </>
  )
}
