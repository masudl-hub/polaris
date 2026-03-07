import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/motion'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import ScoreRing from '../ui/ScoreRing'
import CardInsight from '../ui/CardInsight'

const COLORS = {
  positive: '#22c55e',
  neutral: '#94a3b8',
  negative: '#ef4444',
}

function buildWaffleGrid(pos, neu) {
  const neg = 100 - pos - neu
  const cells = []
  for (let i = 0; i < pos; i++) cells.push('positive')
  for (let i = 0; i < neu; i++) cells.push('neutral')
  for (let i = 0; i < neg; i++) cells.push('negative')
  return cells
}

const SIGNAL_LABELS = {
  ad_copy: { label: 'Ad Copy', sub: 'RoBERTa', weight: 0.35 },
  cultural: { label: 'Cultural', sub: 'Perplexity', weight: 0.30 },
  reddit: { label: 'Community', sub: 'Reddit', weight: 0.20 },
  landing: { label: 'Landing', sub: 'Page alignment', weight: 0.15 },
}

function SignalBar({ signalKey, score }) {
  const meta = SIGNAL_LABELS[signalKey]
  if (!meta) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.6 ? '#22c55e' : score >= 0.4 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
          <span className="text-[10px] font-mono text-gray-500">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
          />
        </div>
      </div>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 w-16 text-right shrink-0">{meta.sub}</span>
    </div>
  )
}

export default function SentimentCard({ sentiment, compositeScore, compositeSentiment }) {
  if (!sentiment) return null

  const pos = Math.round(sentiment.positive * 100)
  const neu = Math.round(sentiment.neutral * 100)
  const neg = 100 - pos - neu
  const cells = buildWaffleGrid(pos, neu)

  // Prefer the full composite object; fall back to raw compositeScore float
  const displayScore = compositeSentiment?.composite_score ?? compositeScore
  const hasScore = displayScore != null

  // Build signal rows from composite breakdown
  const signals = compositeSentiment
    ? [
        compositeSentiment.ad_copy_score != null && { key: 'ad_copy', score: compositeSentiment.ad_copy_score },
        compositeSentiment.cultural_score != null && { key: 'cultural', score: compositeSentiment.cultural_score },
        compositeSentiment.reddit_score != null && { key: 'reddit', score: compositeSentiment.reddit_score },
        compositeSentiment.landing_score != null && { key: 'landing', score: compositeSentiment.landing_score },
      ].filter(Boolean)
    : []

  const hasBreakdown = signals.length > 1

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      <CardInsight
        meaning={
          hasBreakdown
            ? "Four sentiment signals fused into one score. Ad Copy (RoBERTa transformer on your headline + body), Cultural (Perplexity's per-entity cultural sentiment averaged), Community (Reddit post sentiment for your key entities), and Landing Page alignment all contribute."
            : "Two views of your ad's emotional tone. The Distribution breaks sentiment into three categories from a rule-based analyzer. The Composite Score blends that with a transformer model into one final number."
        }
        significance={
          hasBreakdown
            ? "The composite score is what feeds your Quality Score (weighted at 35%). A high ad-copy score but low cultural score means your writing is positive but the entities you're featuring have market headwinds — that tension suppresses your overall QS."
            : "The composite score is the single number that feeds into your Quality Score. When they diverge, it means the transformer is picking up on contextual positivity that the rule-based model missed."
        }
        calculation={
          hasBreakdown
            ? `Weighted average across ${compositeSentiment.signals_available} available signals: Ad Copy (35%), Cultural avg (30%), Community/Reddit (20%), Landing alignment (15%). Weights renormalize when signals are absent.`
            : "VADER compound score + RoBERTa transformer positive probability, blended 60/40."
        }
      >
        <Card padding="spacious" animate={false}>
          <SectionHeader title="Sentiment Analysis" variant="mono" className="mb-6" />

          <div className={`grid gap-8 ${hasScore ? 'grid-cols-1 lg:grid-cols-[1fr_auto]' : ''}`}>
            {/* Left: VADER Distribution */}
            <div className="min-w-0">
              <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-4">
                Distribution
                <span className="ml-2 normal-case tracking-normal text-gray-300 dark:text-gray-600">VADER rule-based</span>
              </span>

              <div className="flex items-center gap-8 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.positive }} />
                  <span className="text-3xl font-light font-mono text-gray-900 dark:text-gray-100">{pos}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.neutral }} />
                  <span className="text-3xl font-light font-mono text-gray-900 dark:text-gray-100">{neu}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.negative }} />
                  <span className="text-3xl font-light font-mono text-gray-900 dark:text-gray-100">{neg}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">Negative</span>
                </div>
              </div>

              <div className="grid grid-cols-10 gap-1 mb-6">
                {cells.map((type, i) => (
                  <motion.div
                    key={i}
                    className="w-6 h-6 rounded-sm"
                    style={{ background: COLORS[type] }}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: i * 0.008,
                      type: 'spring',
                      damping: 20,
                      stiffness: 300,
                    }}
                  />
                ))}
              </div>

              <div className="flex h-5 rounded-full overflow-hidden">
                <motion.div
                  style={{ background: COLORS.positive }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pos}%` }}
                  transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.3 }}
                />
                <motion.div
                  style={{ background: COLORS.neutral }}
                  initial={{ width: 0 }}
                  animate={{ width: `${neu}%` }}
                  transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.4 }}
                />
                <motion.div
                  style={{ background: COLORS.negative }}
                  initial={{ width: 0 }}
                  animate={{ width: `${neg}%` }}
                  transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.5 }}
                />
              </div>
            </div>

            {/* Right: Composite Score + breakdown */}
            {hasScore && (
              <div className="flex flex-col items-center justify-center lg:border-l lg:border-gray-200/60 lg:dark:border-white/[0.08] lg:pl-8 min-w-[180px]">
                <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-4">
                  Composite
                  <span className="ml-2 normal-case tracking-normal text-gray-300 dark:text-gray-600">
                    {compositeSentiment ? `${compositeSentiment.signals_available} signal${compositeSentiment.signals_available !== 1 ? 's' : ''}` : 'blended'}
                  </span>
                </span>
                <ScoreRing score={displayScore} size={96} strokeWidth={6} />
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-3">
                  {(displayScore * 100).toFixed(0)}% positive
                </span>

                {hasBreakdown && (
                  <div className="w-full mt-5 space-y-3 border-t border-gray-100 dark:border-white/[0.06] pt-5">
                    {signals.map(({ key, score }) => (
                      <SignalBar key={key} signalKey={key} score={score} />
                    ))}
                  </div>
                )}

                {!hasBreakdown && (
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-1 text-center max-w-[140px]">
                    VADER + transformer blend used in Quality Score
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      </CardInsight>
    </motion.div>
  )
}
