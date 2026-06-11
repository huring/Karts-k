import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'neutral'
export type BadgeSize = 's' | 'm' | 'l'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

export function Badge({
  children,
  variant = 'default',
  size = 'm',
  className,
}: BadgeProps) {
  const cls = [styles.badge, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ')

  return <span className={cls}>{children}</span>
}

/** Mappar byggnads-skick till badge-variant */
export function skickVariant(skick: string): BadgeVariant {
  switch (skick) {
    case 'Gott skick':    return 'success'
    case 'Åtgärdsbehov':  return 'warning'
    case 'Kritiskt skick': return 'error'
    default:              return 'neutral'
  }
}

/** Mappar DINO-status till badge-variant */
export function statusVariant(
  status: 'aktiv' | 'vilande' | 'avslutad' | string,
): BadgeVariant {
  switch (status) {
    case 'aktiv':     return 'success'
    case 'vilande':   return 'warning'
    case 'avslutad':  return 'neutral'
    default:          return 'default'
  }
}
