import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function TrendIndicator({ value, className, ...props }) {
  const numValue = Number(value) || 0

  let Icon
  let colorClass
  let sign = ''

  if (numValue > 0) {
    Icon = TrendingUp
    colorClass = 'text-emerald-600 dark:text-emerald-400'
    sign = '+'
  } else if (numValue < 0) {
    Icon = TrendingDown
    colorClass = 'text-red-600 dark:text-red-400'
    sign = ''
  } else {
    Icon = Minus
    colorClass = 'text-gray-400 dark:text-gray-500'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium font-mono',
        colorClass,
        className
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>
        {sign}
        {Math.abs(numValue).toFixed(1)}%
      </span>
    </span>
  )
}
