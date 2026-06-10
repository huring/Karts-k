import { useState } from 'react'

export type ObjectTypeKey = 'fastigheter' | 'byggnader' | 'avtal' | 'nyttjanderatter' | 'aktorer'

export type AttributeFilters = {
  status: string | null
  markslag: string | null
}

const INITIAL_TYPES: Record<ObjectTypeKey, boolean> = {
  fastigheter: true,
  byggnader: true,
  avtal: true,
  nyttjanderatter: true,
  aktorer: true,
}

const INITIAL_ATTRIBUTES: AttributeFilters = {
  status: null,
  markslag: null,
}

export function useFilters() {
  const [activeTypes, setActiveTypes] = useState(INITIAL_TYPES)
  const [attributes, setAttributes] = useState<AttributeFilters>(INITIAL_ATTRIBUTES)

  function toggleType(key: ObjectTypeKey) {
    setActiveTypes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function setAttributeFilter<K extends keyof AttributeFilters>(
    key: K,
    value: AttributeFilters[K],
  ) {
    setAttributes(prev => ({ ...prev, [key]: value }))
  }

  function resetFilters() {
    setActiveTypes(INITIAL_TYPES)
    setAttributes(INITIAL_ATTRIBUTES)
  }

  const hasActiveFilters =
    !Object.values(activeTypes).every(Boolean) ||
    Object.values(attributes).some(v => v !== null)

  return { activeTypes, attributes, toggleType, setAttributeFilter, resetFilters, hasActiveFilters }
}
