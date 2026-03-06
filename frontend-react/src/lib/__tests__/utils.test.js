import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn (className merger)', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('filters out falsy values', () => {
    expect(cn('px-4', false, null, undefined, 'py-2')).toBe('px-4 py-2')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active')
  })

  it('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })

  it('handles single class', () => {
    expect(cn('single')).toBe('single')
  })

  it('handles array-like input', () => {
    expect(cn(['a', 'b'])).toBe('a b')
  })
})
