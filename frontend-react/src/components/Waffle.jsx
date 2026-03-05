export function Waffle({ segments, size = 'md' }) {
  const cells = []
  let idx = 0
  segments.forEach(seg => {
    const count = Math.round(seg.value)
    for (let i = 0; i < count && idx < 100; i++, idx++) {
      cells.push(seg.color)
    }
  })
  while (idx < 100) { cells.push('var(--surface-2)'); idx++ }

  return (
    <div className={'waffle waffle--' + size}>
      {cells.map((color, i) => (
        <div key={i} className="waffle__cell" style={{ background: color }} />
      ))}
    </div>
  )
}

export function WaffleLegend({ segments }) {
  return (
    <div className="waffle-legend">
      {segments.map((seg, i) => (
        <div key={i} className="waffle-legend__item">
          <div className="waffle-legend__swatch" style={{ background: seg.color }} />
          <span className="waffle-legend__label">
            {seg.label}
            <span className="waffle-legend__value">{Math.round(seg.value)}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}
