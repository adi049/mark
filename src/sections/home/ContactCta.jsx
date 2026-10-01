import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { ContactActions } from '@/components/contact/ContactActions'

/**
 * Closing call to action on a deep ink panel, with the real contact
 * channels spelled out.
 */
export function ContactCta() {
  return (
    <Section className="mp-contact-cta">
      <Container width="narrow" className="mp-cta">
        <p className="mp-eyebrow mp-eyebrow--center mp-eyebrow--inverse">Planning something?</p>
        <h2 className="mp-cta__title mp-cta__title--inverse">Talk to Markipie</h2>
        <p className="mp-cta__text mp-cta__text--inverse">
          WhatsApp, call or message the studio about your dates, packages and ideas. The team
          replies personally.
        </p>
        <ContactActions tone="inverse" className="mp-cta__actions" />
      </Container>
    </Section>
  )
}
