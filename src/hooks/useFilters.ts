import { useState } from 'react'

export type ObjectTypeKey = 'fastigheter' | 'skyddsomraden' | 'beslut' | 'byggnader'

export type AttributeFilters = {
  status:     string[]
  skyddstyp:  string[]
  kommunnamn: string[]
  skick:      string[]
  anvandning: string[]
}

const INITIAL_TYPES: Record<ObjectTypeKey, boolean> = {
  fastigheter:   true,
  skyddsomraden: true,
  beslut:        true,
  byggnader:     true,
}

const INITIAL_ATTRIBUTES: AttributeFilters = {
  status:     [],
  skyddstyp:  [],
  kommunnamn: [],
  skick:      [],
  anvandning: [],
}

export function useFilters() {
  const [activeTypes, setActiveTypes] = useState(INITIAL_TYPES)
  const [attributes, setAttributes] = useState<AttributeFilters>(INITIAL_ATTRIBUTES)

  function toggleType(key: ObjectTypeKey) {
    setActiveTypes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleAttributeValue(key: keyof AttributeFilters, value: string) {
    setAttributes(prev => {
      const current = prev[key]
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  function resetFilters() {
    setActiveTypes(INITIAL_TYPES)
    setAttributes(INITIAL_ATTRIBUTES)
  }

  const hasActiveFilters =
    !Object.values(activeTypes).every(Boolean) ||
    Object.values(attributes).some(arr => arr.length > 0)

  return { activeTypes, attributes, toggleType, toggleAttributeValue, resetFilters, hasActiveFilters }
}
