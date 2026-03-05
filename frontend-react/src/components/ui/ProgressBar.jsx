import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

const sizeStyles = {
  thin: 'h-1',
  default: 'h-2',
  thick: 'h-3',
}

const colorStyles = {
  accent: 'bg-[#f9d85a]',
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  warning: 'bg-amber-500',
  neutral: 'bg-gray-400 dark:bg-gray-500',
  gradient: 'bg-gradient-to-r from-[#f9d85a] to-emerald-500',
}

export default function ProgressBar({
  value = 0,
  size = 'default',
  color = 'accent',
  label,
  valueLabel,
  className,
  ...props
}) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)} {...props}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {label}
            </span>
          )}
          {valueLabel && (
            <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10',
          sizeStyles[size]
        )}
      >
        <motion.div
          className={cn('h-full rounded-full', colorStyles[color])}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        />
      </div>
    </div>
  )
}
