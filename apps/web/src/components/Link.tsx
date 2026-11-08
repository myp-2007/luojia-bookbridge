import type { AnchorHTMLAttributes } from 'react'
import { navigate } from '../lib/router'

export function Link({ to, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a {...props} href={to} onClick={(event) => {
    props.onClick?.(event)
    if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !props.target) { event.preventDefault(); navigate(to) }
  }}>{children}</a>
}
