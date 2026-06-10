import styles from './Chip.module.css'

interface ChipProps {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: string
}

export function Chip({ active = false, onClick, children, icon }: ChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ''}`}
      onClick={onClick}
    >
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      {children}
    </button>
  )
}
