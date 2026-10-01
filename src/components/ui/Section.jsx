import { cn } from '@/lib/utils'

/**
 * Vertical page section with consistent rhythm. Optional tint backgrounds:
 * 'alt' (neutral), 'blue', 'green', 'pink', used sparingly.
 */
export function Section({ tint, as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag className={cn('mp-section', tint && `mp-section--${tint}`, className)} {...rest}>
      {children}
    </Tag>
  )
}
