import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import ScoreRing from '../ui/ScoreRing'
import CardInsight from '../ui/CardInsight'
import SignalGraph from '../ui/SignalGraph'

function tierVariant(tier) {
  if (tier === 'high') return 'success'
  if (tier === 'moderate') return 'warning'
  return 'danger'
}

function tierLabel(tier) {
  if (tier === 'high') return 'HIGH RESONANCE'
  if (tier === 'moderate') return 'MODERATE RESONANCE'
  return 'LOW RESONANCE'
}

export default function ResonanceSection({ resonanceGraph }) {
  if (!resonanceGraph) return null

  const {
    nodes = [],
    edges = [],
    composite_resonance_score = 0,
    dominant_signals = [],
    resonance_tier = 'low',
    node_count = 0,
    edge_count = 0,
  } = resonanceGraph

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="Resonance Graph" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Signal Graph SVG — spans 2 columns */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <CardInsight
            meaning="A semantic signal graph mapping all named entities extracted from your ad. Each node represents one entity; its size reflects composite momentum, its colour reflects cultural risk (green = safe, amber = moderate risk, red = high risk)."
            significance="Densely-connected clusters signal a coherent brand vocabulary — the algorithm has found strong semantic links between your entities. Isolated nodes are vocabulary dead-ends that add noise without reinforcing your core message."
            calculation="Node weight = momentum × (1 − cultural_risk) × sentiment × platform_affinity. Edge similarity uses GloVe Twitter 50d cosine distance (threshold ≥ 0.30). Resonance tier: HIGH ≥ 0.60, MODERATE ≥ 0.35, LOW < 0.35."
          >
            <Card padding="none" animate={false} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Signal Node Graph" variant="mono" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    {node_count} nodes · {edge_count} edges
                  </span>
                  <Badge variant={tierVariant(resonance_tier)}>
                    {tierLabel(resonance_tier)}
                  </Badge>
                </div>
              </div>
              <SignalGraph nodes={nodes} edges={edges} />
            </Card>
          </CardInsight>
        </motion.div>

        {/* RIGHT: Composite Score + Dominant Signals */}
        <motion.div variants={fadeUp} className="flex flex-col gap-6">

          {/* Composite Score Ring */}
          <CardInsight
            meaning="The composite resonance score (0–1) is the mean of all signal node weights. It summarises how well your ad's entity vocabulary aligns across momentum, cultural safety, sentiment, and platform fit simultaneously."
            significance="A score above 0.60 means your entities are trending, culturally safe, and well-fitted to the platform. Below 0.35 flags weak momentum, elevated cultural risk, or poor platform fit across your vocabulary."
            calculation="composite = mean(node weights). Each node weight is clamped to [0.01, 1.00] before averaging. If no entities were detected, composite = 0.0."
          >
            <Card variant="dark" padding="none" animate={false} className="p-8 flex flex-col items-center gap-4 min-h-[180px] justify-center">
              <ScoreRing score={composite_resonance_score} size={96} strokeWidth={6} />
              <div className="text-center">
                <p className="text-2xl font-light font-mono text-white">
                  {(composite_resonance_score * 100).toFixed(0)}
                  <span className="text-sm text-white/40 ml-1">/ 100</span>
                </p>
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/40 mt-1 font-mono">
                  Composite Resonance
                </p>
              </div>
            </Card>
          </CardInsight>

          {/* Dominant Signals */}
          {dominant_signals.length > 0 && (
            <Card padding="spacious" animate={false}>
              <SectionHeader title="Dominant Signals" variant="mono" className="mb-4" />
              <div className="space-y-3">
                {dominant_signals.map((entity, i) => {
                  const node = nodes.find(n => n.entity === entity)
                  const weight = node?.weight ?? 0
                  return (
                    <div key={entity} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 w-4">
                        #{i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {entity}
                          </span>
                          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                            {(weight * 100).toFixed(0)}
                          </span>
                        </div>
                        <div className="w-full rounded-full h-1.5 bg-gray-100 dark:bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[#f9d85a]"
                            initial={{ width: 0 }}
                            animate={{ width: `${weight * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

        </motion.div>
      </div>
    </motion.div>
  )
}
