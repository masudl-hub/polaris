/**
 * CulturalContextSection — Phase 4
 *
 * Renders per-entity cultural context produced by run_cultural_context()
 * (Perplexity Sonar). Shows advertising risk, cultural sentiment,
 * trending direction, narrative summary, cultural moments, and
 * adjacent topics for each extracted entity.
 */
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { fadeUp, staggerContainer } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import CardInsight from '../ui/CardInsight'

// ── colour maps ──────────────────────────────────────────────────────────────

const RISK_VARIANT = {
  low: 'positive',
  medium: 'warning',
  high: 'negative',
}

const SENTIMENT_VARIANT = {
  positive: 'positive',
  negative: 'negative',
  neutral: 'default',
  mixed: 'warning',
}

const DIRECTION_ICON = {
  ascending: '↑',
  stable: '→',
  descending: '↓',
  viral: '🔥',
}

const DIRECTION_VARIANT = {
  ascending: 'positive',
  stable: 'default',
  descending: 'negative',
  viral: 'warning',
}

// ── sub-components ───────────────────────────────────────────────────────────

function EntityCulturalCard({ ctx }) {
  const {
    entity_name,
    cultural_sentiment,
    trending_direction,
    narrative_summary,
    advertising_risk,
    advertising_risk_reason,
    cultural_moments = [],
    adjacent_topics = [],
  } = ctx

  return (
    <motion.div variants={fadeUp}>
      <Card padding="spacious" animate={false}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-[#1a1a2e] dark:text-white text-sm">{entity_name}</p>
            {advertising_risk_reason && (
              <p className="text-[10px] text-[#6b7280] mt-0.5 max-w-xs">{advertising_risk_reason}</p>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant={RISK_VARIANT[advertising_risk] ?? 'default'} size="sm">
              Risk: {advertising_risk}
            </Badge>
            <Badge variant={SENTIMENT_VARIANT[cultural_sentiment] ?? 'default'} size="sm">
              {cultural_sentiment}
            </Badge>
            <Badge variant={DIRECTION_VARIANT[trending_direction] ?? 'default'} size="sm">
              {DIRECTION_ICON[trending_direction] ?? ''} {trending_direction}
            </Badge>
          </div>
        </div>

        {/* Narrative */}
        {narrative_summary && (
          <p className="text-xs text-[#374151] dark:text-[#d1d5db] leading-relaxed mb-3">
            {narrative_summary}
          </p>
        )}

        {/* Cultural Moments */}
        {cultural_moments.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wide mb-1.5">
              Cultural Moments
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cultural_moments.map((m) => (
                <Badge key={m} variant="warning" size="sm">{m}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Adjacent Topics */}
        {adjacent_topics.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wide mb-1.5">
              Adjacent Topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {adjacent_topics.map((t) => (
                <Badge key={t} variant="default" size="sm">{t}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────

export default function CulturalContextSection({ culturalContext }) {
  if (!culturalContext?.entity_contexts?.length) return null

  const { entity_contexts, overall_advertising_risk } = culturalContext

  const overallVariant = RISK_VARIANT[overall_advertising_risk] ?? 'default'

  const insight = overall_advertising_risk === 'high'
    ? 'One or more entities carry high advertising risk — review before deploying.'
    : overall_advertising_risk === 'medium'
    ? 'Some entities have medium advertising risk. Proceed with contextual care.'
    : 'All entities show low advertising risk — good to go.'

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <SectionHeader
        icon={<Globe size={16} />}
        title="Cultural Context"
        badge={
          <Badge variant={overallVariant} size="sm">
            Overall risk: {overall_advertising_risk}
          </Badge>
        }
      />

      <CardInsight variant={overallVariant} className="mb-4">
        {insight}
      </CardInsight>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entity_contexts.map((ctx) => (
          <EntityCulturalCard key={ctx.entity_name} ctx={ctx} />
        ))}
      </div>
    </motion.div>
  )
}
