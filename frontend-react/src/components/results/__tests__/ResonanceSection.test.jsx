import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResonanceSection from '../ResonanceSection'

const mockGraph = {
  nodes: [
    { entity: 'Nike', weight: 0.8, cultural_risk: 0.1, node_type: 'brand' },
    { entity: 'Running', weight: 0.6, cultural_risk: 0.05, node_type: 'topic' },
  ],
  edges: [
    { source: 'Nike', target: 'Running', similarity: 0.75 }
  ],
  composite_resonance_score: 0.71,
  dominant_signals: ['Nike', 'Running'],
  resonance_tier: 'high',
  node_count: 2,
  edge_count: 1
}

describe('ResonanceSection', () => {
  it('renders null when no resonanceGraph is provided', () => {
    const { container } = render(<ResonanceSection resonanceGraph={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders section header when data is present', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    expect(screen.getByText('Resonance Graph')).toBeDefined()
  })

  it('renders tier badge with "HIGH RESONANCE" for high tier', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    expect(screen.getByText('HIGH RESONANCE')).toBeDefined()
  })

  it('renders tier badge with "MODERATE RESONANCE" for moderate tier', () => {
    const moderateGraph = { ...mockGraph, resonance_tier: 'moderate' }
    render(<ResonanceSection resonanceGraph={moderateGraph} />)
    expect(screen.getByText('MODERATE RESONANCE')).toBeDefined()
  })

  it('renders node count and edge count', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    expect(screen.getByText(/2 nodes · 1 edges/)).toBeDefined()
  })

  it('renders rounded composite score percentage', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    expect(screen.getByText('71')).toBeDefined()
  })

  it('renders dominant signals list', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    // Check for Nike in the dominant signals list (not just any occurrence)
    expect(screen.getAllByText('Nike').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1)
  })

  it('renders signal node graph svg component', () => {
    render(<ResonanceSection resonanceGraph={mockGraph} />)
    // SignalGraph is rendered inside, look for its aria-label
    expect(screen.getByLabelText('Signal node resonance graph')).toBeDefined()
  })
})
