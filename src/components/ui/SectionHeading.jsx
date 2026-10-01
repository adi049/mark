import { cn } from '@/lib/utils'

/**
 * Standard section heading: small uppercase eyebrow, display title and an
 * optional description. Centered variant available.
 */
export function SectionHeading({ eyebrow, title, description, align = 'left', as: Tag = 'h2', className }) {
  return (
    <div
      className={cn(
        'mp-section-heading',
        align === 'center' && 'mp-section-heading--center',
        className,
      )}
    >
      {eyebrow ? <p className="mp-eyebrow">{eyebrow}</p> : null}
      <Tag className="mp-section-heading__title">{title}</Tag>
      {description ? <p className="mp-section-heading__desc">{description}</p> : null}
    </div>
  )
}
