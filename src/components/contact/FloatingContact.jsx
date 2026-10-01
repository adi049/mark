import { Phone } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/BrandIcons'
import { CONTACT } from '@/lib/constants'

/**
 * Fixed contact rail for public pages: WhatsApp chat, phone call and
 * Instagram, rendered by MainLayout (never inside the admin area).
 * Compact circles with labels, real links, keyboard accessible.
 */
export function FloatingContact() {
  return (
    <div className="mp-floating" role="group" aria-label="Quick contact">
      <a
        className="mp-floating__btn mp-floating__btn--whatsapp"
        href={CONTACT.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Markipie on WhatsApp"
      >
        <WhatsAppIcon size={17} />
        <span className="mp-floating__label">WhatsApp</span>
      </a>
      <a
        className="mp-floating__btn mp-floating__btn--call"
        href={CONTACT.telUrl}
        aria-label={`Call Markipie on ${CONTACT.phone}`}
      >
        <Phone size={16} />
        <span className="mp-floating__label">Call</span>
      </a>
      <a
        className="mp-floating__btn mp-floating__btn--instagram"
        href={CONTACT.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Markipie on Instagram"
      >
        <InstagramIcon size={16} />
        <span className="mp-floating__label">Instagram</span>
      </a>
    </div>
  )
}
