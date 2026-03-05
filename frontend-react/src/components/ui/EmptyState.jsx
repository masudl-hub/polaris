import { motion } from 'framer-motion'
import { fadeIn } from '../../lib/motion'
import { cn } from '../../lib/utils'

export default function EmptyState({
  icon: Icon,
  message,
  action,
  className,
  ...props
}) {
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center justify-center py-16',
        className
      )}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {Icon && (
        <Icon
          className="mb-4 text-gray-300 dark:text-gray-600"
          size={48}
          strokeWidth={1.5}
        />
      )}
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}
