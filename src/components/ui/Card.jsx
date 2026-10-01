import { cn } from '@/lib/utils'

/**
 * Base card surface. Moderate radius, hairline border, subtle shadow.
 * Set `hover` for a quiet lift on interactive cards.
 */
export function Card({ as: Tag = 'div', padding = true, hover = false, className, children, ...rest }) {
  return (
    <Tag
      className={cn('mp-card', padding && 'mp-card--pad', hover && 'mp-card--hover', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}
