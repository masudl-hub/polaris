export default function BlockChart({ values, maxRows = 10 }) {
  if (!values || !values.length) return <div className="status-note">No trend data available</div>

  let data = values
  const maxCols = 90
  if (data.length > maxCols) {
    const step = Math.ceil(data.length / maxCols)
    data = data.filter((_, i) => i % step === 0)
  }

  const maxVal = Math.max(...data, 1)
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - values.length)

  return (
    <div>
      <div className="block-chart">
        {data.map((val, ci) => {
          const filledCount = Math.round((val / maxVal) * maxRows)
          return (
            <div key={ci} className="block-chart__col">
              {Array.from({ length: maxRows }).map((_, r) => (
                <div
                  key={r}
                  className={'block-chart__cell ' + (r < filledCount ? 'block-chart__cell--filled' : 'block-chart__cell--empty')}
                />
              ))}
            </div>
          )
        })}
      </div>
      {data.length > 1 && (
        <div className="block-chart-labels">
          <span>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  )
}
