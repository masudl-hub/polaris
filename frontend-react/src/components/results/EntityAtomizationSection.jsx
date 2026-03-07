/**
 * EntityAtomizationSection — Phase 3
 *
 * Renders per-entity trend profiles produced by run_entity_atomization().
 * Each extracted NER entity gets its own momentum bar, rising queries pill
 * strip, and top region badge so the user can see which named entities are
 * actually trending vs. coasting.
 */
import { motion } from 'framer-motion'
import { Atom } from 'lucide-react'
import { fadeUp, staggerContainer } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import ProgressBar from '../ui/ProgressBar'
import CardInsight from '../ui/CardInsight'

// Map momentum [0,1] → semantic colour token used by Badge / ProgressBar
function momentumVariant(val) {
  if (val == null) return 'default'
  if (val >= 0.6) return 'positive'
  if (val >= 0.35) return 'warning'
  return 'negative'
}

function momentumLabel(val) {
  if (val == null) return 'No data'
  if (val >= 0.6) return 'Rising'
  if (val >= 0.35) return 'Stable'
  return 'Declining'
}

// Normalize entity names: "NETFLIX" → "Netflix", "CA" stays "CA" (2-char abbreviations)
function formatEntityName(name) {
  if (!name) return name
  if (name.length <= 3 && name === name.toUpperCase()) return name
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

// Truncate long query strings for cleaner pill display
function truncateQuery(q, maxLen = 40) {
  if (!q || q.length <= maxLen) return q
  return q.slice(0, maxLen).trimEnd() + '…'
}

// A single entity card
function EntityCard({ node }) {
  const { name, momentum, related_queries_top, related_queries_rising, top_regions } = node
  const variant = momentumVariant(momentum)
  const pct = momentum != null ? Math.round(momentum * 100) : null
  const displayName = formatEntityName(name)

  return (
    <motion.div variants={fadeUp} className="h-full">
      <Card padding="spacious" animate={false} className="h-full flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#1a1a2e] dark:text-white text-sm truncate">{displayName}</p>
          </div>
          <Badge variant={variant} size="sm" className="shrink-0">{momentumLabel(momentum)}</Badge>
        </div>

        {/* Momentum bar */}
        {pct != null ? (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-[#6b7280] mb-1">
              <span>Momentum</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <ProgressBar value={pct} variant={variant} />
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <p className="text-[11px] text-[#6b7280]">Insufficient trend data</p>
          </div>
        )}

        {/* Rising queries */}
        {related_queries_rising?.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-medium text-[#6b7280] mb-1.5 uppercase tracking-wide">Rising</p>
            <div className="flex flex-wrap gap-1.5">
              {related_queries_rising.slice(0, 4).map((q) => (
                <span
                  key={q}
                  className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-medium max-w-full truncate"
                  title={q}
                >
                  {truncateQuery(q)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top queries */}
        {related_queries_top?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-[#6b7280] mb-1.5 uppercase tracking-wide">Top searches</p>
            <div className="flex flex-wrap gap-1.5">
              {related_queries_top.slice(0, 5).map((q) => (
                <span
                  key={q}
                  className="inline-block rounded-full bg-[#f0f0f4] dark:bg-white/10 text-[#374151] dark:text-white/70 px-2.5 py-0.5 text-[10px] max-w-full truncate"
                  title={q}
                >
                  {truncateQuery(q)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top regions with mini interest bars */}
        {top_regions?.length > 0 && (
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-white/5">
            <p className="text-[10px] font-medium text-[#6b7280] mb-2 uppercase tracking-wide">Top countries</p>
            <div className="space-y-1.5">
              {top_regions.slice(0, 3).map((r) => {
                const regionName = r.name ?? r
                const interest = r.interest ?? 0
                return (
                  <div key={regionName} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#374151] dark:text-white/70 w-20 truncate shrink-0" title={regionName}>
                      {regionName}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6366f1]/60"
                        style={{ width: `${interest}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#6b7280] w-6 text-right">{interest}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

export default function EntityAtomizationSection({ entityAtomization }) {
  if (!entityAtomization?.nodes?.length) return null

  const { nodes, aggregate_momentum } = entityAtomization
  const aggPct = aggregate_momentum != null ? Math.round(aggregate_momentum * 100) : null
  const aggVariant = momentumVariant(aggregate_momentum)

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(80, 40)}
    >
      <SectionHeader title="Entity Trend Profiles" />

      <CardInsight
        meaning="Each named entity extracted from your ad copy is profiled independently against Google Trends, giving you a per-entity momentum score instead of a single blended number."
        significance="High-momentum entities validate your creative's timeliness. Low-momentum entities might be safe brand pillars — or stale references worth refreshing."
        calculation="spaCy NER extracts up to 5 entities. Each entity gets its own pytrends query (90-day window). Momentum is the same sigmoid formula: 1 / (1 + e^(−3×(7d_avg/30d_avg − 1))). Aggregate is the median of all entity momenta."
      >
        {/* Aggregate momentum summary */}
        {aggPct != null && (
          <motion.div variants={fadeUp}>
            <Card padding="spacious" animate={false} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Atom className="w-4 h-4 text-[#6366f1]" />
                  <span className="text-sm font-medium text-[#1a1a2e] dark:text-white">
                    Aggregate Momentum
                  </span>
                </div>
                <Badge variant={aggVariant} size="sm">{aggPct}%</Badge>
              </div>
              <ProgressBar value={aggPct} variant={aggVariant} />
              <p className="text-[11px] text-[#6b7280] mt-2">
                Median across {nodes.length} profiled {nodes.length === 1 ? 'entity' : 'entities'}
              </p>
            </Card>
          </motion.div>
        )}

        {/* Per-entity grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {nodes.map((node) => (
            <EntityCard key={node.name} node={node} />
          ))}
        </div>
      </CardInsight>
    </motion.div>
  )
}
