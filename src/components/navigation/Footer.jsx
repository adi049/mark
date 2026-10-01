import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/BrandIcons'
import { Container } from '@/components/ui/Container'
import { CONTACT, FOOTER_COLUMNS, ROUTES, SITE } from '@/lib/constants'

/**
 * Studio footer: brand, navigation columns, contact channels and legal.
 * Rendered once by MainLayout, never duplicated per page.
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mp-footer">
      <Container>
        <div className="mp-footer__grid">
          <div className="mp-footer__brand">
            <Link to={ROUTES.HOME.path} className="mp-brand" aria-label="Markipie, home">
              <img
                className="mp-brand__logo mp-brand__logo--footer"
                src={SITE.logoUrl}
                alt="Markipie"
                width="148"
                height="53"
              />
            </Link>
            <p className="mp-footer__tagline">
              Photography, cinematography and creative services for weddings, events and brands.
            </p>
            <div className="mp-footer__channels">
              <a
                className="mp-footer__channel mp-footer__channel--whatsapp"
                href={CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with Markipie on WhatsApp"
              >
                <WhatsAppIcon size={16} />
              </a>
              <a
                className="mp-footer__channel mp-footer__channel--call"
                href={CONTACT.telUrl}
                aria-label={`Call Markipie on ${CONTACT.phone}`}
              >
                <Phone size={16} />
              </a>
              <a
                className="mp-footer__channel mp-footer__channel--instagram"
                href={CONTACT.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Markipie on Instagram"
              >
                <InstagramIcon size={16} />
              </a>
            </div>
            {/* Renders automatically once CONTACT.email is set in src/lib/constants.js. */}
            {CONTACT.email ? (
              <a className="mp-footer__email" href={`mailto:${CONTACT.email}`}>
                {CONTACT.email}
              </a>
            ) : null}
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} className="mp-footer__col" aria-label={column.title}>
              <h2 className="mp-footer__heading">{column.title}</h2>
              <ul className="mp-footer__list">
                {column.links.map((link) => (
                  <li key={`${link.path}-${link.label}`}>
                    <Link className="mp-footer__link" to={link.path}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mp-footer__bottom">
          <p className="mp-footer__copy">
            © {year} {SITE.name}. All rights reserved.
          </p>
          <p className="mp-footer__meta">
            {CONTACT.phone} · {CONTACT.instagramHandle}
          </p>
        </div>
      </Container>
    </footer>
  )
}
