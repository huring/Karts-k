import { useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import styles from './ComponentDemo.module.css'

export function ComponentDemo() {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState('')

  return (
    <>
      <div className={styles.toggle}>
        <Button
          variant={open ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setOpen(o => !o)}
        >
          DINO-komponenter
        </Button>
      </div>

      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.title}>DINO-komponenter</span>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              ✕
            </Button>
          </div>

          <div className={styles.body}>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Knappar</span>
              <div className={styles.row}>
                <Button variant="primary">Primär</Button>
                <Button variant="secondary">Sekundär</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div className={styles.row}>
                <Button variant="primary" size="sm">Primär S</Button>
                <Button variant="secondary" size="sm">Sekundär S</Button>
                <Button variant="primary" disabled>Inaktiv</Button>
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Inmatningsfält</span>
              <Input
                label="Fastighetsbeteckning"
                id="demo-input"
                placeholder="T.ex. Luleå Rutvik 1:23"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
              />
            </div>

            <div className={styles.section}>
              <span className={styles.sectionLabel}>Statusmärken</span>
              <div className={styles.row}>
                <Badge variant="success">Aktiv</Badge>
                <Badge variant="warning">Vilande</Badge>
                <Badge variant="neutral">Avslutad</Badge>
                <Badge variant="error">Fel</Badge>
              </div>
              <div className={styles.row}>
                <Badge size="s" variant="success">Aktiv S</Badge>
                <Badge size="l" variant="success">Aktiv L</Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
