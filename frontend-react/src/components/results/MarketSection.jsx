import { motion } from 'framer-motion'
import { BarChart3 } from 'lucide-react'
import { fadeUp, staggerContainer, pillItem } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import EmptyState from '../ui/EmptyState'
import ScoreRing from '../ui/ScoreRing'
import NumberDisplay from '../ui/NumberDisplay'
import CardInsight from '../ui/CardInsight'

export default function MarketSection({ benchmark, landing, reddit, competitor }) {
  const hasContent = benchmark || landing || reddit || competitor

  if (!hasContent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <EmptyState
          icon={BarChart3}
          message="No market context data. Select an industry, add a landing page URL, or competitor brand to enable."
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="Market Intelligence" />

      {/* Benchmarks */}
      {benchmark && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="How your effective cost per click compares to the average in your selected industry and platform. Above average means you're paying more per click than typical."
              significance="Being below the industry average means your ad quality is earning you cheaper traffic. Above average signals room to improve creative or targeting."
              calculation={`cpc_delta = ((your_effective_CPC - industry_avg_CPC) / industry_avg_CPC) × 100. Industry benchmarks sourced from aggregated platform data for ${benchmark.industry || 'your industry'} on ${benchmark.platform || 'your platform'}.`}
            >
              <Card padding="spacious" animate={false}>
                <div className="flex items-center justify-between mb-6">
                  <SectionHeader title="Industry Benchmarks" variant="mono" />
                  {benchmark.verdict && (() => {
                    const variant = benchmark.verdict === 'above_average' ? 'success'
                      : benchmark.verdict === 'below_average' ? 'danger' : 'warning'
                    const label = benchmark.verdict === 'above_average' ? 'ABOVE AVG'
                      : benchmark.verdict === 'below_average' ? 'BELOW AVG' : 'AVERAGE'
                    return (
                      <Badge variant={variant}>
                        {label}{benchmark.cpc_delta_pct != null && ` ${benchmark.cpc_delta_pct > 0 ? '+' : ''}${benchmark.cpc_delta_pct}%`}
                      </Badge>
                    )
                  })()}
                </div>

                {benchmark.user_ecpc != null && (() => {
                  const maxCpc = Math.max(benchmark.user_ecpc, benchmark.avg_cpc) * 1.3
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Your Effective CPC</span>
                          <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                            ${benchmark.user_ecpc.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full overflow-hidden rounded-full h-2 bg-gray-100 dark:bg-white/10">
                          <motion.div
                            className="h-full rounded-full bg-[#f9d85a]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((benchmark.user_ecpc / maxCpc) * 100)}%` }}
                            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Industry Avg CPC</span>
                          <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                            ${benchmark.avg_cpc.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full overflow-hidden rounded-full h-2 bg-gray-100 dark:bg-white/10">
                          <motion.div
                            className="h-full rounded-full bg-gray-400 dark:bg-gray-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((benchmark.avg_cpc / maxCpc) * 100)}%` }}
                            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </Card>
            </CardInsight>
          </motion.div>

          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="Key performance benchmarks for your industry/platform combination -- average click-through rate, conversion rate, and cost per acquisition."
              significance="These are your goalposts. If your actual metrics fall below these averages, your ad needs optimization. Beating them means you're outperforming the market."
              calculation="Benchmarks are aggregated from platform advertising reports and industry studies. CTR = clicks/impressions, CVR = conversions/clicks, CPA = spend/conversions. Updated quarterly."
            >
              <Card padding="spacious" animate={false}>
                <SectionHeader
                  title={`${benchmark.industry || 'Industry'} / ${benchmark.platform || 'Platform'}`}
                  variant="mono"
                  className="mb-6"
                />
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <span className="text-2xl font-light font-mono text-gray-900 dark:text-gray-100 block">
                      {benchmark.avg_ctr}%
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">Avg CTR</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-light font-mono text-gray-900 dark:text-gray-100 block">
                      {benchmark.avg_cvr}%
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">Avg CVR</span>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-light font-mono text-gray-900 dark:text-gray-100 block">
                      ${benchmark.avg_cpa?.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">Avg CPA</span>
                  </div>
                </div>
              </Card>
            </CardInsight>
          </motion.div>
        </div>
      )}

      {/* Landing page + Reddit */}
      {(landing || reddit) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {landing && (
            <motion.div variants={fadeUp}>
              <CardInsight
                meaning="How well your landing page content aligns with your ad copy. Matched entities appear in both; missing entities are in the ad but not on the page."
                significance="Low coherence (below 0.6) causes 'message mismatch' -- users click an ad then bounce because the landing page doesn't deliver on the promise. This tanks Quality Score on Google Ads."
                calculation="coherence_score = |matched_entities| / |all_ad_entities|. We scrape the landing page, extract entities via spaCy, then compare against entities found in your ad copy using exact + fuzzy matching (Levenshtein distance < 2)."
              >
                <Card padding="spacious" animate={false}>
                  <div className="flex items-center justify-between mb-6">
                    <SectionHeader title="Landing Page Coherence" variant="mono" />
                    <ScoreRing score={landing.coherence_score} size={56} strokeWidth={4} />
                  </div>

                  {landing.matched_entities?.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                        Matched
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {landing.matched_entities.map((e, i) => (
                          <Badge key={i} variant="success">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {landing.missing_entities?.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                        Missing
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {landing.missing_entities.map((e, i) => (
                          <Badge key={i} variant="warning">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {landing.issues?.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {landing.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2"
                        >
                          <span className="text-red-500 text-xs font-bold mt-0.5">!</span>
                          <span className="text-xs text-red-700 dark:text-red-400">{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </CardInsight>
            </motion.div>
          )}

          {reddit && (
            <motion.div variants={fadeUp}>
              <CardInsight
                meaning="What real people on Reddit are saying about topics related to your ad. Shows community sentiment, recurring themes, and the most active subreddits."
                significance="Reddit sentiment is an unfiltered signal of public perception. Negative community sentiment around your product category is a headwind your ad must overcome."
                calculation="We search Reddit for your top entities + keywords, analyze the top 50 posts/comments via VADER sentiment, extract themes using TF-IDF clustering, and identify subreddits by post frequency."
              >
                <Card padding="spacious" animate={false}>
                  <SectionHeader title="Reddit Community Sentiment" variant="mono" className="mb-6" />

                  {reddit.post_count === 0 ? (
                    <span className="text-sm text-gray-400 dark:text-gray-500">No discussions found</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mb-6">
                        <ScoreRing
                          score={reddit.avg_sentiment ?? 0}
                          size={56}
                          strokeWidth={4}
                        />
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {reddit.post_count} posts analyzed
                        </span>
                      </div>

                      {reddit.themes?.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                            Themes
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {reddit.themes.map((t, i) => (
                              <Badge key={i} variant="accent">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {reddit.top_subreddits?.length > 0 && (
                        <div>
                          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                            Subreddits
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {reddit.top_subreddits.map((s, i) => (
                              <Badge key={i} variant="neutral">r/{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </CardInsight>
            </motion.div>
          )}
        </div>
      )}

      {/* Competitor */}
      {competitor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(competitor.status === 'skipped' || competitor.status === 'error') ? (
            <motion.div variants={fadeUp} className="md:col-span-3">
              <Card padding="spacious" animate={false}>
                <SectionHeader
                  title={`Competitor -- ${competitor.brand || 'Unknown'}`}
                  variant="mono"
                  className="mb-2"
                />
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {competitor.note || 'Skipped'}
                </span>
              </Card>
            </motion.div>
          ) : (
            <>
              <motion.div variants={fadeUp}>
                <CardInsight
                  meaning="The number of active ad creatives your competitor is currently running across the selected platform."
                  significance="High ad count (20+) signals an aggressive competitor investing heavily. Low counts may indicate they're testing or have found a winning formula with fewer variants."
                  calculation="Scraped from Meta Ad Library / Google Ads Transparency Center. Counts all active ads for the specified brand within the last 30 days on the target platform."
                >
                  <Card padding="spacious" animate={false} className="text-center">
                    <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                      Active Ads
                    </span>
                    <NumberDisplay
                      value={competitor.ad_count ?? 0}
                      decimals={0}
                      className="text-4xl font-light font-mono text-gray-900 dark:text-gray-100"
                    />
                  </Card>
                </CardInsight>
              </motion.div>
              <motion.div variants={fadeUp}>
                <CardInsight
                  meaning="How long the competitor's ads have been running on average. Longer-running ads are likely profitable (they wouldn't keep paying otherwise)."
                  significance="Ads running 30+ days are strong signals of proven performance. Study these for messaging patterns. Short-lived ads (<7d) suggest frequent testing or poor performance."
                  calculation="avg_longevity = mean(days_active) for all currently running ads. days_active = today - ad_start_date, sourced from ad library timestamps."
                >
                  <Card padding="spacious" animate={false} className="text-center">
                    <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                      Avg Longevity
                    </span>
                    <span className="text-4xl font-light font-mono text-gray-900 dark:text-gray-100 block">
                      {competitor.avg_longevity_days != null ? `${competitor.avg_longevity_days}d` : '--'}
                    </span>
                  </Card>
                </CardInsight>
              </motion.div>
              <motion.div variants={fadeUp}>
                <CardInsight
                  meaning="The mix of ad formats (image, video, carousel, etc.) your competitor is using. Shows their creative strategy."
                  significance="Format distribution reveals what's working. If a competitor is 80% video, that format likely performs best in your vertical. Use this to inform your own creative mix."
                  calculation="Categorized from ad library data. Each ad is classified by format type, then aggregated into percentage breakdown. format_breakdown = count_by_type / total_ads * 100."
                >
                  <Card padding="spacious" animate={false}>
                    <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-2">
                      Formats
                    </span>
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {competitor.format_breakdown
                        ? Object.entries(competitor.format_breakdown).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : '--'}
                    </span>
                  </Card>
                </CardInsight>
              </motion.div>
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
