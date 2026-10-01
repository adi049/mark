import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

/**
 * Shared button. Renders a router Link when `to` is given, an anchor when
 * `href` is given, and a native button otherwise.
 *
 * Variants: primary (charcoal), secondary (outline), ghost (text level).
 * Sizes: sm, md, lg. Compact and clearly clickable, never pill shaped.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  type = 'button',
  className,
  children,
  ...rest
}) {
  const classes = cn(
    'mp-button',
    `mp-button--${variant}`,
    size !== 'md' && `mp-button--${size}`,
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
