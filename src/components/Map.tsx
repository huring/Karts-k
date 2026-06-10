import type { RefObject } from 'react'
import styles from './Map.module.css'

interface MapProps {
  containerRef: RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}

export function Map({ containerRef, children }: MapProps) {
  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.map} />
      {children}
    </div>
  )
}
