import { useState, useEffect, useRef } from 'react'

export default function AnimatedValue({ target, decimals = 0, prefix = '' }) {
  const [display, setDisplay] = useState(prefix + '0')
  const rafRef = useRef()

  useEffect(() => {
    if (target == null) return
    const duration = 600
    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(prefix + (target * eased).toFixed(decimals))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, decimals, prefix])

  return <>{display}</>
}
