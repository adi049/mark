import { Phone } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/BrandIcons'
import { CONTACT } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Inline labeled contact buttons, shared by the contact page, the contact
 * CTA section and the mobile menu footer. Real links, no fake behavior.
 *
 * tone="default" for light backgrounds, tone="inverse" for dark ink sections.
 */
const CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: CONTACT.whatsappUrl,
    external: true,
    Icon: WhatsAppIcon,
    ariaLabel: 'Chat with Markipie on WhatsApp',
  },
  {
    id: 'call',
    label: `Call ${CONTACT.phone}`,
    href: CONTACT.telUrl,
    external: false,
    Icon: Phone,
    ariaLabel: `Call Markipie on ${CONTACT.phone}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: CONTACT.instagramUrl,
    external: true,
    Icon: InstagramIcon,
    ariaLabel: 'Markipie on Instagram',
  },
]

export function ContactActions({ tone = 'default', className }) {
  return (
    <div className={cn('mp-contact-actions', `mp-contact-actions--${tone}`, className)}>
      {CHANNELS.map(({ id, label, href, external, Icon, ariaLabel }) => (
        <a
          key={id}
          className={`mp-contact-action mp-contact-action--${id}`}
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          aria-label={ariaLabel}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </div>
  )
}
