import { useState, useCallback, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

let toastId = 0
const DISMISS_MS = 4000

const Toast = forwardRef(function Toast(_, ref) {
  const [items, setItems] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const show = useCallback((msg, type = 'error') => {
    const id = ++toastId
    setItems(prev => [...prev, { id, msg, type, createdAt: Date.now() }])
    timers.current[id] = setTimeout(() => {
      dismiss(id)
    }, DISMISS_MS)
  }, [dismiss])

  useImperativeHandle(ref, () => ({ show }), [show])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3" aria-live="polite">
      <AnimatePresence>
        {items.map(item => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
})

function ToastCard({ item, onDismiss }) {
  const isSuccess = item.type === 'success'
  const borderColor = isSuccess ? 'border-emerald-500' : 'border-red-500'
  const iconColor = isSuccess ? 'text-emerald-500' : 'text-red-500'
  const barColor = isSuccess ? 'bg-emerald-500' : 'bg-red-500'
  const Icon = isSuccess ? CheckCircle2 : AlertCircle

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={
        'relative w-80 rounded-2xl bg-white dark:bg-[#1a1a1c] shadow-lg border-l-[3px] ' +
        borderColor +
        ' overflow-hidden'
      }
    >
      <div className="flex items-start gap-3 p-4">
        <span className={'shrink-0 mt-0.5 ' + iconColor}>
          <Icon size={18} />
        </span>
        <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 leading-snug">
          {item.msg}
        </p>
        <button
          onClick={() => onDismiss(item.id)}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <motion.div
        className={'absolute bottom-0 left-0 h-[2px] ' + barColor}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: DISMISS_MS / 1000, ease: 'linear' }}
      />
    </motion.div>
  )
}

export default Toast
