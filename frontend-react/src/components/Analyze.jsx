import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'

/* ─── Model map ────────────────────────────────────────────────────── */
const STEP_MODELS = {
  'Text NLP':                 'spaCy NER',
  'Sentiment Analysis':       'VADER + TextBlob',
  'Visual Analysis':          'Gemini 2.5 Flash',
  'Google Trends':            'pytrends API',
  'SEM Metrics':              'Google Ads Estimator',
  'Industry Benchmarks':      'Internal DB',
  'Landing Page Analysis':    'Lighthouse + Gemini',
  'Reddit Sentiment':         'Reddit API + VADER',
  'Trend-Creative Alignment': 'Gemini 2.5 Flash',
  'Competitor Intelligence':  'SerpAPI + Gemini',
  'Diagnostic Summary':       'Gemini 2.5 Flash',
  'Final Scoring':            'Weighted Ensemble',
}

/* ─── Background FX ────────────────────────────────────────────────── */
function BackgroundFX() {
  return (
    <>
      {/* Breathing radial gradient */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-0"
        animate={{
          background: [
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(249,216,90,0.04) 0%, transparent 70%)',
            'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(249,216,90,0.07) 0%, transparent 70%)',
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(249,216,90,0.04) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Faint grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </>
  )
}

/* ─── Hero Counter ─────────────────────────────────────────────────── */
function HeroCounter({ stepCount }) {
  const isComplete = stepCount === 12
  const display = String(stepCount).padStart(2, '0')

  return (
    <div className="flex items-baseline justify-center gap-3 select-none">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={display}
          className={`font-mono text-[80px] md:text-[120px] leading-none font-extrabold tracking-[-0.06em] tabular-nums transition-colors duration-500 ${
            isComplete ? 'text-[#f9d85a]' : 'text-white'
          }`}
          initial={{ y: 40, opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -40, opacity: 0, filter: 'blur(8px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {display}
        </motion.span>
      </AnimatePresence>
      <span className="font-mono text-[40px] font-light text-white/20">/</span>
      <span className="font-mono text-[40px] font-light text-white/20">12</span>
    </div>
  )
}

/* ─── Progress Text ────────────────────────────────────────────────── */
function ProgressText({ progress }) {
  return (
    <p className="font-mono text-sm text-white/40 tracking-[0.15em] uppercase text-center mt-3">
      {progress}% complete
    </p>
  )
}

/* ─── Current Step Label ───────────────────────────────────────────── */
function CurrentStepLabel({ currentStep, stepCount }) {
  const model = STEP_MODELS[currentStep] || ''
  const isComplete = stepCount === 12

  return (
    <div className="flex flex-col items-center mt-6 min-h-[72px]">
      <AnimatePresence mode="wait">
        {isComplete ? (
          <motion.p
            key="__complete__"
            className="font-mono text-[#f9d85a] text-lg tracking-[0.3em] uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, times: [0, 0.15, 0.75, 1] }}
          >
            Analysis Complete
          </motion.p>
        ) : currentStep ? (
          <motion.div
            key={currentStep}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <span className="text-white text-base font-medium tracking-wide text-center">
              {currentStep}
            </span>
            {model && (
              <span className="text-white/30 text-xs font-mono mt-1 tracking-wider uppercase">
                {model}
              </span>
            )}
            {/* Blinking dot */}
            <motion.span
              className="mt-3 w-1.5 h-1.5 rounded-full bg-[#f9d85a]"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* ─── Pipeline Nodes ───────────────────────────────────────────────── */
function PipelineNodes({ stepCount, steps }) {
  // Build a status array from completed steps
  const stepStatuses = Array.from({ length: 12 }, (_, i) => {
    const step = steps[i]
    if (step?.status === 'error') return 'error'
    if (i < stepCount) return 'completed'
    if (i === stepCount) return 'current'
    return 'future'
  })

  return (
    <div className="flex items-center justify-center gap-0 mt-8 px-4">
      {stepStatuses.map((status, i) => (
        <div key={i} className="flex items-center">
          {/* Dot */}
          <div className="relative flex items-center justify-center">
            {status === 'current' && (
              <motion.span
                className="absolute rounded-full border-2 border-[#f9d85a]"
                initial={{ width: 14, height: 14, opacity: 0.6 }}
                animate={{ width: 28, height: 28, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <span
              className={`block rounded-full ${
                status === 'error'
                  ? 'w-2.5 h-2.5 bg-red-500'
                  : status === 'completed'
                  ? 'w-2.5 h-2.5 bg-[#f9d85a]'
                  : status === 'current'
                  ? 'w-3.5 h-3.5 bg-[#f9d85a]'
                  : 'w-2.5 h-2.5 bg-white/10'
              }`}
            />
          </div>
          {/* Connector line (skip after last dot) */}
          {i < 11 && (
            <div
              className={`h-[2px] flex-1 max-w-[32px] min-w-[12px] w-[20px] ${
                i < stepCount ? 'bg-[#f9d85a]' : 'bg-white/[0.08]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Completed Step Row ───────────────────────────────────────────── */
function StepRow({ evt, index, isLatest }) {
  const isError = evt.status === 'error'
  const model = evt.model || STEP_MODELS[evt.name] || ''
  const duration = evt.duration_ms != null ? `${evt.duration_ms}ms` : ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: isLatest ? 1 : 0.5, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`flex items-center gap-4 rounded-[1rem] border px-5 py-3.5 ${
        isError
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-white/[0.03] border-white/[0.06]'
      }`}
    >
      {/* Step number */}
      <span className="font-mono text-xs font-bold w-7 h-7 rounded-lg bg-[#f9d85a]/10 text-[#f9d85a] flex items-center justify-center shrink-0">
        {evt.step || index + 1}
      </span>

      {/* Name + model */}
      <div className="flex-1 min-w-0">
        <p className="text-white/90 text-sm font-medium truncate">{evt.name}</p>
        {model && (
          <p className="text-white/30 text-xs font-mono truncate">{model}</p>
        )}
      </div>

      {/* Duration */}
      {duration && (
        <span className="font-mono text-xs text-white/25 tabular-nums shrink-0">
          {duration}
        </span>
      )}

      {/* Status icon */}
      {isError ? (
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-[#f9d85a]/70 shrink-0" />
      )}
    </motion.div>
  )
}

/* ─── Completed Steps List ─────────────────────────────────────────── */
function CompletedStepsList({ steps }) {
  const scrollRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [steps.length])

  if (steps.length === 0) return null

  return (
    <div className="relative flex-1 min-h-0 mt-8">
      {/* Fade masks */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#131315] to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#131315] to-transparent z-10 pointer-events-none" />

      <div ref={scrollRef} className="overflow-y-auto h-full space-y-2 py-2 pr-1">
        {steps.map((evt, i) => (
          <StepRow
            key={i}
            evt={evt}
            index={i}
            isLatest={i === steps.length - 1}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

/* ─── Main Component ───────────────────────────────────────────────── */
export default function Analyze({ steps, stepCount, currentStep, progress }) {
  return (
    <section className="relative flex-1 flex flex-col bg-[#131315] min-h-0 overflow-hidden">
      <BackgroundFX />

      <div className="relative z-10 flex-1 flex flex-col max-w-[820px] w-full mx-auto px-6 pt-20 pb-12 min-h-0">
        {/* Hero counter */}
        <HeroCounter stepCount={stepCount} />

        {/* Progress text */}
        <ProgressText progress={progress} />

        {/* Current step label */}
        <CurrentStepLabel currentStep={currentStep} stepCount={stepCount} />

        {/* Pipeline nodes */}
        <PipelineNodes stepCount={stepCount} steps={steps} />

        {/* Completed steps */}
        <CompletedStepsList steps={steps} />
      </div>
    </section>
  )
}
