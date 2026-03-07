import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../lib/motion'
import Card from '../ui/Card'
import NumberDisplay from '../ui/NumberDisplay'
import ProgressBar from '../ui/ProgressBar'
import CardInsight from '../ui/CardInsight'

function cpcColor(val) {
  if (val <= 0.5) return 'positive'
  if (val <= 1.5) return 'warning'
  return 'negative'
}

export default function OverviewHero({ store }) {
  const qs = store.sem?.quality_score || 0
  const sem = store.sem
  const trends = store.trends
  const momentum = trends?.momentum

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
      variants={staggerContainer(100, 100)}
      initial="hidden"
      animate="visible"
    >
      {/* Quality Score - dark */}
      <motion.div variants={fadeUp}>
        <CardInsight
          meaning="A holistic score from 0-10 that fuses ALL available pipeline signals — sentiment, trend momentum, visual fit, cultural safety, audience alignment, creative-trend alignment, content coherence, and audio relevance."
          significance="Ads scoring above 7 typically see 2-3x better CTR than those below 5. Unlike a simple Google Ads QS, this incorporates cultural context, entity-level trends, and audience fit."
          calculation="QS = weighted fusion of up to 8 signals: sentiment (20%), trend momentum (15%), visual/platform fit (15%), cultural safety (15%), creative-trend alignment (10%), audience alignment (10%), content coherence (10%), audio relevance (5%). Weights auto-renormalize when signals are absent."
        >
          <Card variant="dark" padding="none" animate={false} className="p-8 min-h-[220px] flex flex-col justify-between">
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/40">
              Quality Score
            </span>
            <div>
              <NumberDisplay
                value={qs}
                decimals={1}
                className="text-7xl font-light font-mono text-white tracking-[-0.04em] block"
              />
              <span className="text-sm font-mono text-white/30 mt-1 block">
                {qs.toFixed(1)} / 10
              </span>
            </div>
          </Card>
        </CardInsight>
      </motion.div>

      {/* Effective Cost Per Click - white */}
      <motion.div variants={fadeUp}>
        <CardInsight
          meaning="Your adjusted cost per click after factoring in ad quality. Better ads get rewarded with cheaper clicks -- this is what you'd actually pay."
          significance="Lower cost per click means your budget stretches further. A high Quality Score drives this number down, so improving your creative literally saves you money."
          calculation={`Effective CPC = base_CPC × (1 / quality_multiplier). quality_multiplier = 0.5 + (QS / 10). Your base CPC: $${sem?.effective_cpc ? (sem.effective_cpc * (0.5 + qs/10)).toFixed(2) : '—'}, multiplier: ${(0.5 + qs/10).toFixed(2)}x.`}
        >
          <Card padding="none" animate={false} className="p-8 min-h-[220px] flex flex-col justify-between">
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500">
              Effective Cost Per Click
            </span>
            <div>
              <NumberDisplay
                value={sem?.effective_cpc ?? 0}
                decimals={2}
                prefix="$"
                className="text-4xl font-light font-mono text-gray-900 dark:text-gray-100 tracking-[-0.04em] block"
              />
              <ProgressBar
                value={sem ? Math.min(100, Math.max(5, (1 / sem.effective_cpc) * 100)) : 0}
                color={sem ? cpcColor(sem.effective_cpc) : 'neutral'}
                size="thin"
                className="mt-4"
              />
            </div>
          </Card>
        </CardInsight>
      </motion.div>

      {/* Daily Clicks - white */}
      <motion.div variants={fadeUp}>
        <CardInsight
          meaning="The estimated number of clicks your ad would receive per day given your budget and effective cost per click."
          significance="This is your direct ROI projection. Compare this to your conversion rate to estimate daily conversions and revenue."
          calculation={`daily_clicks = daily_budget / effective_CPC = $${store.sem?.daily_clicks ? Math.round(store.sem.daily_clicks * (sem?.effective_cpc ?? 1)) : '—'} / $${sem?.effective_cpc?.toFixed(2) ?? '—'} = ${sem?.daily_clicks ?? '—'} clicks.`}
        >
          <Card padding="none" animate={false} className="p-8 min-h-[220px] flex flex-col justify-between">
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500">
              Est. Daily Clicks
            </span>
            <div>
              <NumberDisplay
                value={sem?.daily_clicks ?? 0}
                decimals={0}
                className="text-4xl font-light font-mono text-gray-900 dark:text-gray-100 tracking-[-0.04em] block"
              />
              <ProgressBar
                value={sem ? Math.min(100, (sem.daily_clicks / 500) * 100) : 0}
                color="warning"
                size="thin"
                className="mt-4"
              />
            </div>
          </Card>
        </CardInsight>
      </motion.div>

      {/* Momentum - yellow */}
      <motion.div variants={fadeUp}>
        <CardInsight
          meaning="A ratio comparing recent (7-day) search interest to the 30-day average. Values above 1.0 indicate rising interest; below 1.0 indicates declining interest."
          significance="High momentum means the topic is trending upward -- your ad is riding a wave. Low momentum means interest is fading and you may need to pivot messaging."
          calculation="momentum = avg(search_volume_last_7d) / avg(search_volume_last_30d). Pulled from Google Trends time-series data for your ad's primary keywords and entities."
        >
          <Card variant="yellow" padding="none" animate={false} className="p-8 min-h-[220px] flex flex-col justify-between">
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-black/40">
              Momentum
            </span>
            <div>
              <NumberDisplay
                value={momentum ?? 0}
                decimals={2}
                className="text-4xl font-light font-mono text-black tracking-[-0.04em] block"
              />
              <div className="mt-4 w-full overflow-hidden rounded-full h-1 bg-black/10">
                <motion.div
                  className="h-full rounded-full bg-black"
                  initial={{ width: 0 }}
                  animate={{ width: `${momentum != null ? Math.min(100, momentum * 100) : 0}%` }}
                  transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                />
              </div>
            </div>
          </Card>
        </CardInsight>
      </motion.div>
    </motion.div>
  )
}
