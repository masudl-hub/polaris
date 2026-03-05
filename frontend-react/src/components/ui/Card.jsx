import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { fadeUp } from '../../lib/motion'

const variantStyles = {
  default:
    'bg-white border-gray-200/60 text-gray-900 shadow-sm hover:shadow-md dark:bg-[#1e1e21] dark:border-white/[0.10] dark:text-gray-100',
  dark: 'bg-[#252527] border-gray-800 text-white shadow-lg hover:bg-[#2a2a2c] dark:bg-[#111113] dark:border-[#333]',
  yellow:
    'bg-[#f9d85a] border-[#f9d85a] text-black shadow-sm hover:bg-[#f5d040]',
  glass:
    'bg-white/60 backdrop-blur-xl border-white/20 text-gray-900 shadow-sm hover:bg-white/80 dark:bg-[#1a1a1c]/60 dark:border-white/10',
  ghost:
    'bg-transparent border-gray-200 text-gray-900 hover:bg-gray-50 dark:border-[#333] dark:text-gray-100 dark:hover:bg-white/5',
  flat: 'bg-[#f4f5f7] border-transparent text-gray-900 dark:bg-white/5 dark:text-gray-100',
}

const paddingStyles = {
  default: 'p-6',
  compact: 'p-4',
  spacious: 'p-8',
  none: '',
}

export default function Card({
  variant = 'default',
  padding = 'default',
  animate = true,
  className,
  children,
  ...props
}) {
  const Comp = animate ? motion.div : 'div'
  const motionProps = animate
    ? { variants: fadeUp, initial: 'hidden', animate: 'visible' }
    : {}

  return (
    <Comp
      className={cn(
        'rounded-[1.5rem] border transition-all duration-200',
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Comp>
  )
}
