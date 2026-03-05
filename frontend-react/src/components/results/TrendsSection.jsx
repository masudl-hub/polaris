import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { fadeUp, staggerContainer, pillItem } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import EmptyState from '../ui/EmptyState'
import NumberDisplay from '../ui/NumberDisplay'
import ProgressBar from '../ui/ProgressBar'
import CardInsight from '../ui/CardInsight'
import RegionMap from '../ui/RegionMap'

function momentumColor(val) {
  if (val >= 0.6) return 'positive'
  if (val >= 0.3) return 'warning'
  return 'negative'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-[#252527] px-3 py-2 text-xs font-mono text-white shadow-lg border border-white/10">
      <p className="text-white/50 mb-0.5">{label}</p>
      <p className="text-white font-medium">{payload[0].value}</p>
    </div>
  )
}

export default function TrendsSection({ trends, alignment }) {
  if (!trends) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <EmptyState icon={TrendingUp} message="No trend data available" />
      </motion.div>
    )
  }

  const chartData = (trends.time_series || []).map((val, i) => ({
    name: `D${i + 1}`,
    value: val,
  }))

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="Trends & Alignment" />

      {/* Chart + Momentum */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <CardInsight
            meaning="A 90-day time series of Google Trends search interest for keywords extracted from your ad copy."
            significance="Flat or declining curves suggest market fatigue. Rising curves mean you're capitalizing on growing demand -- your ad has natural tailwind."
            calculation="We extract the top 3 entities from your headline/body via spaCy NER, query Google Trends for each over 90 days, and plot the normalized average interest (0-100 scale)."
          >
            <Card padding="spacious" animate={false}>
              <SectionHeader title="90-Day Search Interest" variant="mono" className="mb-4" />
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f9d85a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f9d85a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#f9d85a"
                      strokeWidth={2}
                      fill="url(#trendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </CardInsight>
        </motion.div>

        {/* Momentum card */}
        {trends.momentum != null && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="The ratio of average search volume over the last 7 days vs. the last 30 days. Above 1.0 = accelerating interest."
              significance="A momentum above 0.6 means search interest is actively rising. Below 0.3 signals a fading topic that may underperform."
              calculation="momentum = mean(time_series[-7:]) / mean(time_series[-30:]). Values are clamped 0-1 for display."
            >
              <Card padding="spacious" animate={false} className="flex flex-col justify-between h-full">
                <SectionHeader title="Momentum (7d vs 30d)" variant="mono" />
                <div className="mt-4">
                  <NumberDisplay
                    value={trends.momentum}
                    decimals={2}
                    className="text-5xl font-light font-mono text-gray-900 dark:text-gray-100 tracking-[-0.04em] block"
                  />
                  <ProgressBar
                    value={Math.min(100, trends.momentum * 100)}
                    color={momentumColor(trends.momentum)}
                    size="thin"
                    className="mt-4"
                  />
                </div>
              </Card>
            </CardInsight>
          </motion.div>
        )}
      </div>

      {/* Top Regions — full width row */}
      {trends.top_regions?.length > 0 && (
        <motion.div variants={fadeUp}>
          <CardInsight
            meaning="Geographic regions showing the highest search interest for your ad's keywords."
            significance="Knowing where demand is hottest lets you geo-target budget allocation. Concentrating spend in high-interest regions improves ROAS."
            calculation="From Google Trends 'Interest by Region', ranked by relative search volume index (0-100). Top 5 regions displayed."
          >
            <Card padding="spacious" animate={false}>
              <SectionHeader title="Top Regions" variant="mono" className="mb-4" />
              <RegionMap regions={trends.top_regions} />
            </Card>
          </CardInsight>
        </motion.div>
      )}

      {/* Queries + Alignment — responsive row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trends.related_queries_top?.length > 0 && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="The most commonly co-searched queries alongside your ad's keywords -- what else your audience is actively looking for."
              significance="These queries reveal adjacent intent. Incorporating these terms into your copy or landing page can capture broader search demand."
              calculation="Pulled from Google Trends 'Related Queries (Top)' for your extracted keywords, filtered to the top 10 by search volume."
            >
              <Card padding="spacious" animate={false} className="h-full">
                <SectionHeader title="Related Searches" variant="mono" className="mb-4" />
                <motion.div
                  className="flex flex-wrap gap-2"
                  variants={staggerContainer(40)}
                  initial="hidden"
                  animate="visible"
                >
                  {trends.related_queries_top.map((q, i) => (
                    <motion.span key={i} variants={pillItem}>
                      <Badge variant="accent">{q}</Badge>
                    </motion.span>
                  ))}
                </motion.div>
              </Card>
            </CardInsight>
          </motion.div>
        )}

        {trends.related_queries_rising?.length > 0 && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="Queries with the fastest growing search volume -- breakout terms that are surging in popularity right now."
              significance="Rising queries are early signals of emerging demand. Ads aligned with these terms can ride a growth wave before competitors catch on."
              calculation="From Google Trends 'Related Queries (Rising)' -- these are terms with >100% search growth rate over the period, sorted by growth velocity."
            >
              <Card padding="spacious" animate={false} className="h-full">
                <SectionHeader title="Rising Queries" variant="mono" className="mb-4" />
                <motion.div
                  className="flex flex-wrap gap-2"
                  variants={staggerContainer(40)}
                  initial="hidden"
                  animate="visible"
                >
                  {trends.related_queries_rising.map((q, i) => (
                    <motion.span key={i} variants={pillItem}>
                      <Badge variant="warning">{q}</Badge>
                    </motion.span>
                  ))}
                </motion.div>
              </Card>
            </CardInsight>
          </motion.div>
        )}

        {alignment && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="How well your ad copy's themes match what people are actually searching for. Matched trends are aligned; gaps are missed opportunities."
              significance="High alignment (>70%) means your messaging resonates with real demand. Gaps suggest topics you should weave into your copy to capture more searches."
              calculation="alignment_score = |matched_trends| / |all_trending_terms|. We compare your extracted entities and keywords against the top Google Trends queries, using cosine similarity (threshold > 0.7) on GloVe embeddings."
            >
              <Card padding="spacious" animate={false} className="h-full">
                <SectionHeader title="Trend-to-Creative Alignment" variant="mono" className="mb-4" />

                <NumberDisplay
                  value={alignment.alignment_score * 100}
                  decimals={0}
                  suffix="%"
                  className="text-4xl font-light font-mono text-gray-900 dark:text-gray-100 block mb-4"
                />

                <ProgressBar
                  value={alignment.alignment_score * 100}
                  color={momentumColor(alignment.alignment_score)}
                  className="mb-6"
                />

                {alignment.matched_trends?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                      Aligned
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {alignment.matched_trends.map((t, i) => (
                        <Badge key={i} variant="success">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {alignment.gap_trends?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                      Gaps
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {alignment.gap_trends.map((t, i) => (
                        <Badge key={i} variant="warning">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </CardInsight>
          </motion.div>
        )}
      </div>

      {/* Creative Angles — if alignment has them */}
      {alignment && alignment.creative_angles?.length > 0 && (
        <motion.div variants={fadeUp}>
          <CardInsight
            meaning="AI-generated creative directions that bridge the gap between your current messaging and what the market is searching for."
            significance="Each angle is a concrete suggestion for a new ad variant that would capture currently-missed search demand."
            calculation="Generated by Claude using your gap trends as context: 'Given these unaddressed trending topics [gaps], suggest creative angles that naturally incorporate them into the existing ad theme.'"
          >
            <Card padding="spacious" animate={false}>
              <SectionHeader title="Suggested Creative Angles" variant="mono" className="mb-4" />
              <div className="space-y-3">
                {alignment.creative_angles.map((angle, i) => (
                  <div
                    key={i}
                    className="border-l-[3px] border-[#f9d85a] pl-5 py-2"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {angle}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </CardInsight>
        </motion.div>
      )}
    </motion.div>
  )
}
