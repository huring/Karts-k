import styles from './Chip.module.css'

interface ChipProps {
  active?: boolean
  dimmed?: boolean
  count?: number
  onClick?: () => void
  children: React.ReactNode
  icon?: string
}

export function Chip({ active = false, dimmed = false, count, onClick, children, icon }: ChipProps) {
  const cls = [styles.chip, active ? styles.active : '', dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  )
}
