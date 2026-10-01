import { useState } from 'react'
import { Phone } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/BrandIcons'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { CONTACT } from '@/lib/constants'
import { useSEO } from '@/hooks/useSEO'

const EVENT_TYPES = [
  'Wedding',
  'Pre-wedding',
  'Engagement',
  'Event',
  'Marketing services',
  'Other',
]

const CHANNELS = [
  {
    id: 'whatsapp',
    Icon: WhatsAppIcon,
    accent: 'blue',
    title: 'WhatsApp',
    detail: CONTACT.phone,
    action: 'Chat on WhatsApp',
    href: CONTACT.whatsappUrl,
    external: true,
    ariaLabel: 'Chat with Markipie on WhatsApp',
  },
  {
    id: 'call',
    Icon: Phone,
    accent: 'green',
    title: 'Call',
    detail: CONTACT.phone,
    action: 'Call the studio',
    href: CONTACT.telUrl,
    external: false,
    ariaLabel: `Call Markipie on ${CONTACT.phone}`,
  },
  {
    id: 'instagram',
    Icon: InstagramIcon,
    accent: 'pink',
    title: 'Instagram',
    detail: CONTACT.instagramHandle,
    action: 'Open Instagram',
    href: CONTACT.instagramUrl,
    external: true,
    ariaLabel: 'Markipie on Instagram',
  },
]

/**
 * Contact. Real channels first: WhatsApp, phone and Instagram all connect
 * to the studio. The form is a visual structure that joins in a later
 * phase, and says so honestly.
 */
export default function Contact() {
  const [sent, setSent] = useState(false)

  useSEO({
    title: 'Contact',
    description:
      'WhatsApp, call or message Markipie on Instagram about weddings, events and marketing services.',
    path: '/contact',
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    setSent(true)
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the studio"
        description="For dates, packages and enquiries, WhatsApp, call or message Markipie. The team replies personally."
      />

      <Section className="mp-contact">
        <Container>
          <div className="mp-contact__channels">
            {CHANNELS.map(({ id, Icon, accent, title, detail, action, href, external, ariaLabel }) => (
              <article key={id} className={`mp-channel-card mp-channel-card--${accent}`}>
                <span className="mp-channel-card__icon">
                  <Icon size={22} />
                </span>
                <h2 className="mp-channel-card__title">{title}</h2>
                <p className="mp-channel-card__detail">{detail}</p>
                <div className="mp-channel-card__actions">
                  <Button
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    variant="secondary"
                    aria-label={ariaLabel}
                  >
                    {action}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section tint="alt" className="mp-contact mp-contact--form">
        <Container width="narrow">
          <h2 className="mp-contact__form-title">Send an enquiry</h2>
          <p className="mp-contact__form-hint">
            The form connects to the studio in a later phase. Until then, WhatsApp and call
            reach the team directly on {CONTACT.phone}.
          </p>

          <form className="mp-form" onSubmit={handleSubmit}>
            <div className="mp-form__row">
              <label className="mp-field">
                <span className="mp-field__label">Name</span>
                <input
                  className="mp-field__input"
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                />
              </label>
              <label className="mp-field">
                <span className="mp-field__label">Phone</span>
                <input
                  className="mp-field__input"
                  type="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="10 digit mobile number"
                />
              </label>
            </div>
            <label className="mp-field">
              <span className="mp-field__label">Event type</span>
              <select className="mp-field__input" name="event-type" defaultValue={EVENT_TYPES[0]}>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="mp-field">
              <span className="mp-field__label">Message</span>
              <textarea
                className="mp-field__input mp-field__input--area"
                name="message"
                rows={5}
                placeholder="Dates, venue, city, anything that helps"
              />
            </label>
            <div className="mp-form__foot">
              <Button type="submit">Send enquiry</Button>
              {sent ? (
                <p className="mp-form__note" role="status">
                  Thank you. The form connects to the studio in a later phase, so please also
                  send the details on WhatsApp or call {CONTACT.phone}.
                </p>
              ) : null}
            </div>
          </form>
        </Container>
      </Section>
    </>
  )
}
