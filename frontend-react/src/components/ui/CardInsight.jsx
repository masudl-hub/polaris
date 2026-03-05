import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, X } from 'lucide-react'

export default function CardInsight({ meaning, significance, calculation, children, className = '' }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className={`relative group ${className}`}>
      {children}

      {/* Info button — visible on hover, stays visible when flipped */}
      <AnimatePresence>
        {!flipped && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-black/60"
            onClick={(e) => { e.stopPropagation(); setFlipped(true) }}
          >
            <Info size={12} className="text-white/70" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Flipped overlay — only on click */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 rounded-[1.5rem] overflow-hidden cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[#111113]/92 backdrop-blur-xl" />

            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-30 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setFlipped(false) }}
            >
              <X size={14} className="text-white/70" />
            </button>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="relative h-full p-6 pr-14 flex flex-col gap-4 overflow-y-auto scrollbar-none"
            >
              {meaning && (
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#f9d85a] block mb-1.5">
                    What this means
                  </span>
                  <p className="text-[13px] leading-relaxed text-white/80">
                    {meaning}
                  </p>
                </div>
              )}

              {significance && (
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#f9d85a] block mb-1.5">
                    Why it matters
                  </span>
                  <p className="text-[13px] leading-relaxed text-white/80">
                    {significance}
                  </p>
                </div>
              )}

              {calculation && (
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#f9d85a] block mb-1.5">
                    How we calculate it
                  </span>
                  <p className="text-[13px] leading-relaxed text-white/70 font-mono">
                    {calculation}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
