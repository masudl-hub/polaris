import { useSpring, useMotionValue, useTransform, motion } from 'framer-motion'
import { useEffect } from 'react'
import { countUpSpring } from '../../lib/motion'

export default function NumberDisplay({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}) {
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, countUpSpring)
  const display = useTransform(
    springValue,
    (v) => prefix + v.toFixed(decimals) + suffix
  )

  useEffect(() => {
    if (value != null) motionValue.set(value)
  }, [value, motionValue])

  return <motion.span className={className}>{display}</motion.span>
}
