import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { Lightbox } from '@/components/ui/Lightbox'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { GALLERY_CATEGORIES, GALLERY_ITEMS } from '@/data/gallery'
import { useSEO } from '@/hooks/useSEO'
import { cn } from '@/lib/utils'

const FILTERS = ['All', ...GALLERY_CATEGORIES]

const countFor = (category) =>
  category === 'All' ? GALLERY_ITEMS.length : GALLERY_ITEMS.filter((i) => i.category === category).length

/**
 * Gallery. Working category filters with counts, a featured banner, a
 * masonry layout with hover scrims and a lightbox with keyboard
 * navigation. Collections are published here as events wrap up; private
 * client galleries live behind Client Access.
 */
export default function Gallery() {
  const [filter, setFilter] = useState('All')
  const [activeId, setActiveId] = useState(null)

  useSEO({
    title: 'Gallery',
    description:
      'Featured Markipie events: weddings, engagements, Haldi, Mehendi, receptions, pre-wedding shoots and celebrations.',
    path: '/gallery',
  })

  const items =
    filter === 'All' ? GALLERY_ITEMS : GALLERY_ITEMS.filter((item) => item.category === filter)
  const activeIndex = items.findIndex((item) => item.id === activeId)
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null
  const step = (delta) => {
    if (activeIndex < 0 || items.length === 0) {
      return
    }
    setActiveId(items[(activeIndex + delta + items.length) % items.length].id)
  }

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Featured events"
        description="Collections from weddings, engagements, Haldi, Mehendi, receptions, pre-wedding shoots and other celebrations."
      />

      <Section className="mp-gallery">
        <Container>
          <figure className="mp-gallery__banner">
            <img
              src="/assets/placeholders/wide-sage.jpg"
              alt="Markipie studio artwork in soft sage green tones"
            />
          </figure>

          <div className="mp-gallery__filters" role="group" aria-label="Filter by event type">
            {FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                className={cn('mp-chip', filter === category && 'is-active')}
                aria-pressed={filter === category}
                onClick={() => setFilter(category)}
              >
                {category}
                <span className="mp-chip__count">{countFor(category)}</span>
              </button>
            ))}
          </div>

          <div className="mp-gallery__grid" key={filter}>
            {items.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                className="mp-gallery__item"
                onClick={() => setActiveId(item.id)}
                aria-label={`Open preview, ${item.category}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
              >
                <img src={item.src} alt={item.alt} loading="lazy" />
                <span className="mp-gallery__item-scrim" aria-hidden="true" />
                <span className="mp-gallery__item-label">{item.category}</span>
              </motion.button>
            ))}
          </div>

          <p className="mp-section-note">
            New collections are published here as events wrap up. Clients receive their own
            private galleries through Client Access.
          </p>
        </Container>
      </Section>

      <AnimatePresence>
        {activeItem ? (
          <Lightbox
            src={activeItem.src}
            alt={activeItem.alt}
            caption={`${activeItem.category} · Markipie collection`}
            onClose={() => setActiveId(null)}
            onPrev={items.length > 1 ? () => step(-1) : null}
            onNext={items.length > 1 ? () => step(1) : null}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
