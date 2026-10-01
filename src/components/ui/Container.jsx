import { cn } from '@/lib/utils'

/**
 * Page width container. Widths: default (1200px), narrow (760px, reading),
 * wide (1440px, future gallery layouts).
 */
export function Container({ width = 'default', as: Tag = 'div', className, children }) {
  return (
    <Tag
      className={cn(
        'mp-container',
        width === 'narrow' && 'mp-container--narrow',
        width === 'wide' && 'mp-container--wide',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
