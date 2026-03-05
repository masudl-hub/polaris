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

export default function SentimentCard({ sentiment, compositeScore }) {
  if (!sentiment) return null

  const pos = Math.round(sentiment.positive * 100)
  const neu = Math.round(sentiment.neutral * 100)
  const neg = 100 - pos - neu
  const cells = buildWaffleGrid(pos, neu)
  const hasComposite = compositeScore != null

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      <CardInsight
        meaning="Two views of your ad's emotional tone. The Distribution breaks sentiment into three categories (positive, neutral, negative) from a rule-based analyzer. The Composite Score blends that with a transformer model into one final number."
        significance="The distribution tells you the shape of the emotion — is it mostly neutral with a positive lean, or polarized? The composite score is the single number that feeds into your Quality Score. When they diverge (e.g. 10% positive in distribution but 54% composite), it means the transformer is picking up on contextual positivity that the rule-based model missed."
        calculation="Distribution: VADER sentiment analyzer splits text into P/N/Neu probabilities, normalized to 100%. Composite: 0.6 × VADER_compound_score + 0.4 × transformer_positive_probability. VADER is fast and handles slang/emoji; the transformer captures nuance and context. The blend gives you the best of both."
      >
        <Card padding="spacious" animate={false}>
          <SectionHeader title="Sentiment Analysis" variant="mono" className="mb-6" />

          <div className={`grid gap-8 ${hasComposite ? 'grid-cols-1 lg:grid-cols-[1fr_auto]' : ''}`}>
            {/* Left: Distribution */}
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

            {/* Right: Composite Score */}
            {hasComposite && (
              <div className="flex flex-col items-center justify-center lg:border-l lg:border-gray-200/60 lg:dark:border-white/[0.08] lg:pl-8">
                <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-4">
                  Composite
                  <span className="ml-2 normal-case tracking-normal text-gray-300 dark:text-gray-600">blended</span>
                </span>
                <ScoreRing score={compositeScore} size={96} strokeWidth={6} />
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-3">
                  {(compositeScore * 100).toFixed(0)}% positive
                </span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 mt-1 text-center max-w-[140px]">
                  VADER + transformer blend used in Quality Score
                </span>
              </div>
            )}
          </div>
        </Card>
      </CardInsight>
    </motion.div>
  )
}
