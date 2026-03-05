import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

function getScoreColor(score) {
  if (score >= 0.6) return '#10b981' // emerald-500
  if (score >= 0.3) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

export default function ScoreRing({
  score = 0,
  size = 64,
  strokeWidth = 4,
  className,
  ...props
}) {
  const clampedScore = Math.min(1, Math.max(0, score))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clampedScore)
  const percentage = Math.round(clampedScore * 100)
  const color = getScoreColor(clampedScore)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          className="dark:stroke-white/10"
        />
        {/* Foreground circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', damping: 25, stiffness: 100 }}
        />
      </svg>
      <span className="absolute text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
        {percentage}%
      </span>
    </div>
  )
}
