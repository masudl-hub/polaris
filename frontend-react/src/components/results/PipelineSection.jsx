import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Activity } from 'lucide-react'
import { fadeUp, staggerContainer } from '../../lib/motion'
import EmptyState from '../ui/EmptyState'

function StepNode({ step, index }) {
  const [expanded, setExpanded] = useState(false)
  const isError = step.status === 'error'

  return (
    <motion.div
      variants={fadeUp}
      className="relative flex items-start gap-4 cursor-pointer"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Vertical line */}
      <div className="relative flex flex-col items-center">
        <div
          className={`w-3.5 h-3.5 rounded-full shrink-0 z-10 border-2 ${
            isError
              ? 'bg-red-500 border-red-400'
              : 'bg-[#f9d85a] border-[#f5d040]'
          }`}
        />
        {/* Connecting line (not on last item -- handled via CSS) */}
        <div className="w-px flex-1 bg-gray-200 dark:bg-white/10 min-h-[24px]" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 -mt-0.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {step.name || `Step ${step.step || index + 1}`}
            </span>
            {step.model && (
              <span className="ml-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                {step.model}
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0 ml-4">
            {step.duration_ms || 0}ms
          </span>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1">
                {step.input_summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">In:</span>{' '}
                    {step.input_summary}
                  </p>
                )}
                {step.output_summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">Out:</span>{' '}
                    {(step.output_summary || '').substring(0, 200)}
                  </p>
                )}
                {step.note && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                    {step.note}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function PipelineSection({ steps }) {
  const [open, setOpen] = useState(false)

  if (!steps?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <EmptyState icon={Activity} message="No pipeline data" />
      </motion.div>
    )
  }

  const totalMs = steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>
        Pipeline Trace
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500 ml-2">
          {steps.length} steps / {(totalMs / 1000).toFixed(1)}s
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1e1e21] rounded-[1.5rem] border border-gray-200/60 dark:border-white/[0.10] p-8 shadow-sm">
              <motion.div
                variants={staggerContainer(60)}
                initial="hidden"
                animate="visible"
              >
                {steps.map((step, i) => (
                  <StepNode key={i} step={step} index={i} />
                ))}
              </motion.div>

              {/* Total duration summary */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 dark:border-white/10">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Total Duration
                </span>
                <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                  {(totalMs / 1000).toFixed(2)}s
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
