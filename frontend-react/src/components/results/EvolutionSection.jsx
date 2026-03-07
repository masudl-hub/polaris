import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus, FlaskConical, Target, TrendingUp, Zap } from 'lucide-react'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
}

function DeltaBadge({ current, previous, isGoodHigher = true, prefix = '', suffix = '' }) {
  const delta = current - previous
  const isNeutral = Math.abs(delta) < 0.001
  const isPositive = delta > 0
  
  const isGood = isGoodHigher ? isPositive : !isPositive
  
  if (isNeutral) return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 text-[11px] font-bold">
      <Minus size={10} strokeWidth={3} />
      <span>NO CHANGE</span>
    </div>
  )

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
      isGood 
        ? 'bg-emerald-500/10 text-emerald-500' 
        : 'bg-rose-500/10 text-rose-500'
    }`}>
      {isPositive ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
      <span>
        {isPositive ? '+' : ''}{prefix}{delta.toFixed(2)}{suffix}
      </span>
    </div>
  )
}

export default function EvolutionSection({ currentStore, previousStore }) {
  if (!previousStore) return null

  const metrics = useMemo(() => {
    const currQS = currentStore.sem?.quality_score || 0
    const prevQS = previousStore.sem?.quality_score || 0
    const currECPC = currentStore.sem?.effective_cpc || 0
    const prevECPC = previousStore.sem?.effective_cpc || 0
    const currClicks = currentStore.sem?.daily_clicks || 0
    const prevClicks = previousStore.sem?.daily_clicks || 0
    const currRes = currentStore.resonanceGraph?.composite_resonance_score || 0
    const prevRes = previousStore.resonanceGraph?.composite_resonance_score || 0

    return [
      { 
        label: 'Quality Score', 
        icon: Target, 
        curr: currQS, 
        prev: prevQS, 
        isGoodHigher: true, 
        suffix: '/10',
        desc: 'Search relevance and expected performance.' 
      },
      { 
        label: 'Est. CPC', 
        icon: Zap, 
        curr: currECPC, 
        prev: prevECPC, 
        isGoodHigher: false, 
        prefix: '$',
        desc: 'Calculated cost per click based on relevance.' 
      },
      { 
        label: 'Resonance', 
        icon: TrendingUp, 
        curr: currRes * 10, 
        prev: prevRes * 10, 
        isGoodHigher: true, 
        suffix: '/10',
        desc: 'Semantic alignment with market signals.' 
      },
      { 
        label: 'Daily Clicks', 
        icon: FlaskConical, 
        curr: currClicks, 
        prev: prevClicks, 
        isGoodHigher: true, 
        suffix: '',
        desc: 'Estimated daily clicks at current budget.' 
      },
    ]
  }, [currentStore, previousStore])

  const totalImprovement = metrics.reduce((acc, m) => {
    const win = m.isGoodHigher ? (m.curr > m.prev) : (m.curr < m.prev)
    return acc + (win ? 1 : 0)
  }, 0)

  return (
    <section className="space-y-6">
      <SectionHeader 
        title="Evolution & Lift"
        subtitle="Comparing current variant vs. previous session"
      />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {metrics.map((m, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="p-5 h-full flex flex-col justify-between border-dashed border-2 border-gray-200 dark:border-white/10 bg-transparent">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400">
                    <m.icon size={16} />
                  </div>
                  <DeltaBadge 
                    current={m.curr} 
                    previous={m.prev} 
                    isGoodHigher={m.isGoodHigher} 
                    prefix={m.prefix} 
                    suffix={m.suffix} 
                  />
                </div>
                <h4 className="text-[13px] font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                  {m.label}
                </h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-mono font-bold text-gray-900 dark:text-white">
                    {m.prefix}{Number.isInteger(m.curr) ? m.curr : m.curr.toFixed(2)}{m.suffix}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 line-through decoration-gray-300">
                    {m.prefix}{Number.isInteger(m.prev) ? m.prev : m.prev.toFixed(2)}{m.suffix}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed">
                {m.desc}
              </p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {totalImprovement >= 3 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-[#1a1a1c] shrink-0">
            <TrendingUp size={20} strokeWidth={3} />
          </div>
          <div>
            <h5 className="text-[14px] font-bold text-emerald-500">Significant uplift detected</h5>
            <p className="text-[12px] text-emerald-500/80">
              This iteration has successfully improved {totalImprovement} of 4 core performance vectors.
            </p>
          </div>
        </motion.div>
      )}
    </section>
  )
}
