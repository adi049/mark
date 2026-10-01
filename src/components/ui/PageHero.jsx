import { Container } from '@/components/ui/Container'
import { cn } from '@/lib/utils'

/**
 * Shared page opener: eyebrow, title, optional description and any extra
 * content such as actions. Keeps every page entrance consistent.
 */
export function PageHero({ eyebrow, title, description, children, className }) {
  return (
    <section className={cn('mp-page-hero', className)}>
      <Container>
        {eyebrow ? <p className="mp-eyebrow">{eyebrow}</p> : null}
        <h1 className="mp-page-hero__title">{title}</h1>
        {description ? <p className="mp-page-hero__description">{description}</p> : null}
        {children}
      </Container>
    </section>
  )
}
