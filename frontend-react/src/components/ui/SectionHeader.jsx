import { cn } from '../../lib/utils'

const variantStyles = {
  default: {
    wrapper: '',
    title: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
    subtitle: 'text-sm text-gray-500 dark:text-gray-400',
  },
  bordered: {
    wrapper: 'border-b border-gray-200 pb-4 dark:border-white/10',
    title: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
    subtitle: 'text-sm text-gray-500 dark:text-gray-400',
  },
  mono: {
    wrapper: '',
    title:
      'font-mono text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500',
    subtitle: 'font-mono text-xs text-gray-400 dark:text-gray-500',
  },
}

export default function SectionHeader({
  title,
  subtitle,
  action,
  variant = 'default',
  className,
  ...props
}) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn('flex items-center justify-between', styles.wrapper, className)}
      {...props}
    >
      <div>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={cn('mt-0.5', styles.subtitle)}>{subtitle}</p>}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
