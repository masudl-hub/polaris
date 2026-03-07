import { motion } from 'framer-motion'
import { Linkedin, TrendingUp, MessageSquare, Repeat2, Heart, Eye, Clock } from 'lucide-react'
import { fadeUp, staggerContainer } from '../../lib/motion'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import NumberDisplay from '../ui/NumberDisplay'
import ProgressBar from '../ui/ProgressBar'
import CardInsight from '../ui/CardInsight'

function qualityColor(score) {
  if (score >= 70) return 'positive'
  if (score >= 45) return 'warning'
  return 'negative'
}

const BREAKDOWN_LABELS = {
  post_length: 'Post Length',
  hook: 'Hook',
  readability: 'Readability',
  format: 'Format',
  hashtags: 'Hashtags',
  cta: 'CTA',
  sentiment: 'Sentiment',
  formatting: 'Formatting',
  timing: 'Timing',
  pipeline_signals: 'Pipeline Intel',
}

function HeatmapCell({ value, max }) {
  const intensity = max > 0 ? value / max : 0
  // Gold scale: transparent → full gold
  const bg = `rgba(249, 216, 90, ${(intensity * 0.85).toFixed(2)})`
  return (
    <div
      className="rounded-[3px] aspect-square flex items-center justify-center"
      style={{ backgroundColor: bg }}
      title={`${(value * 100).toFixed(1)}% engagement`}
    />
  )
}

export default function LinkedInSection({ linkedin }) {
  if (!linkedin) return null

  const { quality_score, quality_breakdown, suggestions, predicted_impressions,
    predicted_reactions, predicted_comments, predicted_shares,
    predicted_engagement_rate, impression_range, timing_heatmap, best_times } = linkedin

  const heatmapMax = timing_heatmap?.data
    ? Math.max(...timing_heatmap.data.flat())
    : 0

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="LinkedIn Post Prediction" />

      {/* Row 1: Quality Score + Predicted Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Score */}
        <motion.div variants={fadeUp}>
          <CardInsight
            meaning="A composite content quality score based on 8 research-backed factors plus pipeline intelligence — trend momentum, cultural safety, audience alignment, and visual quality when available."
            significance="Posts scoring above 70 typically outperform. Below 45 suggests significant room for improvement. Pipeline signals add up to 10 additional points based on real-time market context."
            calculation="Weighted sum of: post length (15pts), hook quality (20pts), readability (10pts), format (15pts), hashtags (10pts), CTA (10pts), sentiment (5pts), formatting (5pts), plus pipeline signals (10pts from trend/cultural/audience/visual). Normalized to 0-100."
          >
            <Card padding="spacious" animate={false} className="h-full flex flex-col justify-between">
              <SectionHeader title="Content Quality" variant="mono" />
              <div className="mt-4">
                <NumberDisplay
                  value={quality_score}
                  decimals={0}
                  className="text-5xl font-light font-mono text-gray-900 dark:text-gray-100 tracking-[-0.04em] block"
                />
                <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">/100</span>
                <ProgressBar
                  value={quality_score}
                  color={qualityColor(quality_score)}
                  className="mt-4"
                />
              </div>
              {/* Breakdown */}
              <div className="mt-5 space-y-1.5">
                {Object.entries(quality_breakdown || {}).map(([key, { score, max }]) => (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 dark:text-gray-400">{BREAKDOWN_LABELS[key] || key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#f9d85a]"
                          style={{ width: `${(score / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-400 dark:text-gray-500 font-mono w-8 text-right">{score}/{max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </CardInsight>
        </motion.div>

        {/* Predicted Metrics */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <CardInsight
            meaning="Predicted engagement metrics for this post based on content analysis, format, follower count, and industry benchmarks."
            significance="These projections help you set realistic expectations and compare different post versions before publishing."
            calculation="HistGradientBoosting model trained on 5,000 synthetic posts generated from published LinkedIn benchmark data (Social Insider 2025, Hootsuite, Sprout Social, academic research)."
          >
            <Card padding="spacious" animate={false} className="h-full">
              <SectionHeader title="Predicted Performance" variant="mono" className="mb-6" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye size={13} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Impressions</span>
                  </div>
                  <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100">
                    {predicted_impressions.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 mt-1">
                    {impression_range?.low?.toLocaleString()} - {impression_range?.high?.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Heart size={13} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reactions</span>
                  </div>
                  <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100">
                    {predicted_reactions.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare size={13} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Comments</span>
                  </div>
                  <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100">
                    {predicted_comments.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Repeat2 size={13} className="text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reposts</span>
                  </div>
                  <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100">
                    {predicted_shares.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Engagement Rate</span>
                  <span className="text-lg font-mono font-light text-[#f9d85a]">
                    {(predicted_engagement_rate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </Card>
          </CardInsight>
        </motion.div>
      </div>

      {/* Row 2: Timing Heatmap + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timing Heatmap */}
        {timing_heatmap?.data && (
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <CardInsight
              meaning="Predicted engagement rate for your specific post at every day and hour combination."
              significance="Brighter cells = higher predicted engagement. This helps you pick the optimal posting window for maximum reach."
              calculation="Your post's features are scored across all 7 days x 17 hours (6am-10pm) using temporal multipliers from Hootsuite, Buffer, and Sprout Social benchmark studies."
            >
              <Card padding="spacious" animate={false}>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader title="Best Time to Post" variant="mono" />
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>Low</span>
                    <div className="flex gap-0.5">
                      {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                        <div
                          key={v}
                          className="w-3 h-3 rounded-[2px]"
                          style={{ backgroundColor: `rgba(249, 216, 90, ${v * 0.85})` }}
                        />
                      ))}
                    </div>
                    <span>High</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[500px]">
                    {/* Hour labels */}
                    <div className="flex mb-1" style={{ paddingLeft: 32 }}>
                      {timing_heatmap.hours.map(h => (
                        <div key={h} className="flex-1 text-center text-[9px] font-mono text-gray-400 dark:text-gray-500">
                          {h % 3 === 0 ? (h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`) : ''}
                        </div>
                      ))}
                    </div>
                    {/* Grid rows */}
                    {timing_heatmap.days.map((day, dIdx) => (
                      <div key={day} className="flex items-center gap-1 mb-0.5">
                        <span className="w-7 text-[10px] font-mono text-gray-400 dark:text-gray-500 text-right shrink-0">
                          {day}
                        </span>
                        <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${timing_heatmap.hours.length}, 1fr)` }}>
                          {timing_heatmap.data[dIdx].map((val, hIdx) => (
                            <HeatmapCell key={hIdx} value={val} max={heatmapMax} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Best times callout */}
                {best_times?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock size={12} className="text-[#f9d85a]" />
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Top posting windows
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {best_times.slice(0, 3).map((t, i) => {
                        const h = t.hour
                        const label = h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-[rgba(249,216,90,0.12)] border border-[#f9d85a]/30 px-3 py-1 text-[12px] font-medium text-[#f9d85a]"
                          >
                            {t.day} {label}
                            <span className="text-[10px] opacity-60">{(t.engagement_rate * 100).toFixed(1)}%</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </CardInsight>
          </motion.div>
        )}

        {/* Suggestions */}
        {suggestions?.length > 0 && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="Specific, research-backed improvements to increase your post's engagement."
              significance="Each suggestion cites the expected impact based on published LinkedIn engagement studies."
              calculation="Generated by comparing your post's features against optimal benchmarks for each factor (length, hashtags, hook quality, CTA, formatting, etc.)."
            >
              <Card padding="spacious" animate={false} className="h-full">
                <SectionHeader title="Suggestions" variant="mono" className="mb-4" />
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="border-l-[3px] border-[#f9d85a] pl-4 py-1.5"
                    >
                      <span className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </CardInsight>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
