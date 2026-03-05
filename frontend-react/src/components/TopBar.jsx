import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Sun, Moon } from 'lucide-react'

export default function TopBar({ view, dark, sessions, currentSessionId, onBack, onSessionClick, onToggleTheme }) {
  const scrollRef = useRef(null)

  // Auto-scroll active pill into view
  useEffect(() => {
    if (!scrollRef.current || !currentSessionId) return
    const active = scrollRef.current.querySelector('[data-active="true"]')
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentSessionId])

  return (
    <header className="sticky top-0 z-50 h-16 flex items-center px-4 gap-3 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 dark:bg-[#111113]/80 dark:border-white/[0.10]">
      {/* Left: Logo + Back */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 group">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#f9d85a] text-[#1a1a1c] font-mono font-bold text-sm group-hover:scale-105 transition-transform duration-150">
            P
          </span>
          <span className="font-mono font-bold text-[15px] tracking-tight text-gray-900 dark:text-white hidden sm:inline">
            OLARIS
          </span>
        </button>

        <AnimatePresence>
          {view !== 'compose' && (
            <motion.button
              key="back"
              initial={{ opacity: 0, x: -12, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -12, width: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={onBack}
              className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors overflow-hidden whitespace-nowrap"
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Center: Session pills */}
      <div className="flex-1 min-w-0 relative">
        {/* Fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/80 dark:from-[#111113]/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/80 dark:from-[#111113]/80 to-transparent z-10" />

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-3 py-1"
        >
          {sessions.map(s => {
            const isActive = s.id === currentSessionId
            return (
              <button
                key={s.id}
                data-active={isActive}
                title={new Date(s.timestamp).toLocaleString() + ' \u2014 QS: ' + (s.qs || '\u2014')}
                onClick={() => onSessionClick(s.id)}
                className={
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ' +
                  (isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]')
                }
              >
                <span className="truncate max-w-[120px]">{s.label}</span>
                {s.qs > 0 && (
                  <span
                    className={
                      'inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ' +
                      (isActive
                        ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
                        : 'bg-gray-200/70 text-gray-600 dark:bg-white/10 dark:text-gray-300')
                    }
                  >
                    {s.qs}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Theme toggle */}
      <button
        onClick={onToggleTheme}
        title="Toggle dark mode"
        className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06] transition-colors"
      >
        <AnimatePresence mode="wait" initial={false}>
          {dark ? (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <Moon size={18} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <Sun size={18} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </header>
  )
}
