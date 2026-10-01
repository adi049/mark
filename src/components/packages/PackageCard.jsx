import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buildWhatsAppLink, cn } from '@/lib/utils'

/**
 * One photography package. The face stays quiet: title, context, price and
 * the enquiry CTA. Full crew, deliverables and complimentary items expand
 * behind the details toggle so nothing becomes a wall of text.
 */
export function PackageCard({ pkg, groupLabel }) {
  const [open, setOpen] = useState(false)

  const coverage = pkg.events ? pkg.events.map((event) => event.name).join(' · ') : null

  return (
    <article className={cn('mp-package-card', `mp-package-card--${pkg.accent}`)}>
      <header className="mp-package-card__head">
        <p className="mp-package-card__tag">
          {groupLabel} · {pkg.number}
        </p>
        <h3 className="mp-package-card__title">{pkg.title}</h3>
        {pkg.context ? <p className="mp-package-card__context">{pkg.context}</p> : null}
        {coverage ? <p className="mp-package-card__coverage">{coverage}</p> : null}
      </header>

      <div className="mp-package-card__price">
        <span className="mp-package-card__amount">{pkg.price}</span>
        {pkg.priceNote ? <span className="mp-package-card__price-note">{pkg.priceNote}</span> : null}
      </div>

      <button
        type="button"
        className="mp-package-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <Minus size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
        {open ? 'Hide details' : 'View full details'}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="mp-package-card__details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.33, 0, 0.2, 1] }}
          >
            <div className="mp-package-card__details-inner">
              <div>
                <h4 className="mp-package-card__details-heading">Coverage team</h4>
                {pkg.events ? (
                  <div className="mp-package-card__events">
                    {pkg.events.map((event) => (
                      <div className="mp-package-card__event" key={event.name}>
                        <p className="mp-package-card__event-name">{event.name}</p>
                        <ul className="mp-package-card__event-crew">
                          {event.crew.map((member) => (
                            <li key={member}>{member}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="mp-package-card__crew">
                    {pkg.crew.map((member) => (
                      <li key={member}>{member}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mp-package-card__details-heading">Deliverables</h4>
                <ul className="mp-package-card__list">
                  {pkg.deliverables.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="mp-package-card__details-heading">Complimentary</h4>
                <ul className="mp-package-card__list">
                  {pkg.complimentary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <footer className="mp-package-card__foot">
        <Button
          href={buildWhatsAppLink(
            `Hello Markipie, I would like to enquire about the ${pkg.title} package (${pkg.price}).`
          )}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
        >
          Enquire
          <ArrowUpRight size={15} aria-hidden="true" />
        </Button>
      </footer>
    </article>
  )
}
