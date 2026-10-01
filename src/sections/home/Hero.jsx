import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { CONTACT, ROUTES } from '@/lib/constants'

const DISCIPLINES = ['Wedding Photography', 'Cinematography', 'Candid Photography']

const EASE = [0.25, 0.1, 0.25, 1]

/**
 * Home hero. The studio wordmark over the three coverage disciplines, one
 * line on the creative storytelling promise and four clear actions: view
 * the portfolio, explore packages, client access and WhatsApp.
 */
export function Hero() {
  const reduceMotion = useReducedMotion()

  const rise = (delay) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        }

  const imageReveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 1.03 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.9, delay: 0.15, ease: EASE },
      }

  return (
    <section className="mp-hero">
      <Container className="mp-hero__inner">
        <div className="mp-hero__content">
          <motion.h1 className="mp-hero__title" {...rise(0)}>
            <span className="mp-hero__wordmark">MARKIPIE</span>
            <span className="mp-hero__disciplines">
              {DISCIPLINES.map((discipline, index) => (
                <span className="mp-hero__discipline" key={discipline}>
                  <span className="mp-hero__discipline-name">{discipline}</span>
                  <span className="mp-hero__discipline-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>
              ))}
            </span>
          </motion.h1>

          <motion.p className="mp-hero__lead" {...rise(0.18)}>
            Creative visual storytelling for weddings and events, photographed, filmed, edited,
            color graded and printed under one roof.
          </motion.p>

          <motion.div className="mp-hero__actions" {...rise(0.28)}>
            <Button to={ROUTES.GALLERY.path}>View Portfolio</Button>
            <Button to="/#packages" variant="secondary">
              Explore Packages
            </Button>
          </motion.div>

          <motion.div className="mp-hero__links" {...rise(0.36)}>
            <a className="mp-hero__link" href={ROUTES.CLIENT_ACCESS.path}>
              Client Access
              <ArrowRight size={14} aria-hidden="true" />
            </a>
            <a
              className="mp-hero__link"
              href={CONTACT.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp the studio
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </motion.div>
        </div>

        <motion.figure className="mp-hero__figure" {...imageReveal}>
          <span className="mp-hero__figure-frame" aria-hidden="true" />
          <img
            src="/assets/placeholders/portrait-sky.jpg"
            alt="Markipie studio artwork in soft sky blue tones"
            width="780"
            height="1040"
          />
          <div className="mp-hero__figure-card" aria-hidden="true">
            <img
              src="/assets/placeholders/square-blush.jpg"
              alt=""
              width="240"
              height="240"
              loading="lazy"
            />
          </div>
          <figcaption className="mp-hero__figure-caption">
            Weddings · Films · Candid stories
          </figcaption>
        </motion.figure>
      </Container>
    </section>
  )
}
