import { cn } from '../../lib/utils'

const variantStyles = {
  neutral:
    'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  danger:
    'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  dark:
    'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
  outline:
    'bg-transparent text-gray-700 ring-1 ring-inset ring-gray-300 dark:text-gray-300 dark:ring-gray-600',
  accent:
    'bg-[#f9d85a]/20 text-[#8a6d00] dark:bg-[#f9d85a]/10 dark:text-[#f9d85a]',
}

const dotColors = {
  live: 'bg-emerald-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
}

export default function Badge({
  variant = 'neutral',
  dot,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium font-mono',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColors[dot])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
