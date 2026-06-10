import styles from './Select.module.css'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  options: SelectOption[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Alla',
  disabled = false,
}: SelectProps) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={`${styles.selectWrapper} ${disabled ? styles.disabled : ''}`}>
        <select
          className={styles.select}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label}
        >
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={`material-symbols-outlined ${styles.arrow}`}>expand_more</span>
      </div>
    </div>
  )
}
