import { motion } from 'framer-motion'
import { viewTransition } from '../lib/motion'
import OverviewHero from './results/OverviewHero'
import SentimentCard from './results/SentimentCard'
import CreativeCard from './results/CreativeCard'
import MediaSection from './results/MediaSection'
import AudioSection from './results/AudioSection'
import TrendsSection from './results/TrendsSection'
import EntityAtomizationSection from './results/EntityAtomizationSection'
import CulturalContextSection from './results/CulturalContextSection'
import LanguageSection from './results/LanguageSection'
import MarketSection from './results/MarketSection'
import DiagnosticSection from './results/DiagnosticSection'
import PipelineSection from './results/PipelineSection'
import LinkedInSection from './results/LinkedInSection'
import ResonanceSection from './results/ResonanceSection'
import EvolutionSection from './results/EvolutionSection'
import { Copy, Check } from 'lucide-react'
import { useState, useMemo } from 'react'

export default function Results({ store, sessions = [], currentSessionId, onBackToCompose }) {
  const [copied, setCopied] = useState(false)
  const [compareId, setCompareId] = useState('')

  const comparableSessions = useMemo(
    () => sessions.filter(s => s.id !== currentSessionId && s.store),
    [sessions, currentSessionId]
  )

  const compareStore = useMemo(
    () => comparableSessions.find(s => s.id === compareId)?.store || null,
    [comparableSessions, compareId]
  )

  const handleCopyMarkdown = () => {
    const lines = []
    const headline = store.text?.headline || 'Ad Analysis'

    lines.push(`# Polaris Report — ${headline}`)
    lines.push('')

    if (store.diagnostic) {
      lines.push('## Executive Diagnostic')
      lines.push(store.diagnostic)
      lines.push('')
    }

    if (store.sem) {
      lines.push('## SEM Metrics')
      lines.push(`- **Quality Score:** ${store.sem.quality_score}/10`)
      lines.push(`- **Effective CPC:** $${store.sem.effective_cpc?.toFixed(2)}`)
      lines.push(`- **Est. Daily Clicks:** ${store.sem.daily_clicks}`)
      lines.push('')
    }

    if (store.resonanceGraph) {
      const rg = store.resonanceGraph
      lines.push('## Resonance')
      lines.push(`- **Tier:** ${rg.resonance_tier}`)
      if (rg.dominant_signals?.length) {
        lines.push(`- **Dominant Signals:** ${rg.dominant_signals.join(', ')}`)
      }
      lines.push('')
    }

    if (store.text) {
      const t = store.text
      lines.push('## Language & Copy')
      if (t.sentiment_score != null) lines.push(`- **Sentiment Score:** ${t.sentiment_score}/10`)
      if (t.emotional_tone) lines.push(`- **Emotional Tone:** ${t.emotional_tone}`)
      if (t.cta_strength) lines.push(`- **CTA Strength:** ${t.cta_strength}`)
      if (t.readability_score != null) lines.push(`- **Readability:** ${t.readability_score}`)
      lines.push('')
    }

    if (store.trends) {
      const tr = store.trends
      lines.push('## Trend Data')
      if (tr.momentum != null) lines.push(`- **Momentum:** ${(tr.momentum * 100).toFixed(1)}%`)
      if (tr.related_queries_top?.length) lines.push(`- **Top Queries:** ${tr.related_queries_top.slice(0, 5).join(', ')}`)
      lines.push('')
    }

    if (store.benchmark) {
      const bm = store.benchmark
      lines.push('## Industry Benchmark')
      if (bm.industry) lines.push(`- **Industry:** ${bm.industry}`)
      if (bm.avg_ctr != null) lines.push(`- **Avg CTR:** ${bm.avg_ctr}%`)
      if (bm.avg_cpc != null) lines.push(`- **Avg CPC:** $${bm.avg_cpc}`)
      lines.push('')
    }

    if (store.reddit) {
      const rd = store.reddit
      lines.push('## Reddit Sentiment')
      if (rd.overall_sentiment) lines.push(`- **Overall:** ${rd.overall_sentiment}`)
      if (rd.summary) lines.push(`- **Summary:** ${rd.summary}`)
      lines.push('')
    }

    if (store.linkedin) {
      const li = store.linkedin
      lines.push('## LinkedIn Analysis')
      if (li.predicted_engagement_rate != null) lines.push(`- **Predicted Engagement:** ${li.predicted_engagement_rate}%`)
      if (li.hook_strength) lines.push(`- **Hook Strength:** ${li.hook_strength}`)
      lines.push('')
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.section
      className="flex-1 overflow-y-auto bg-[#f4f5f7] dark:bg-[#111113]"
      initial={viewTransition.initial}
      animate={viewTransition.animate}
      exit={viewTransition.exit}
      transition={viewTransition.transition}
    >
      {/* Action Bar */}
      <div className="sticky top-0 z-20 bg-white/50 dark:bg-[#111113]/50 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToCompose}
            className="text-[12px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            ← EDIT AD
          </button>
          <div className="h-4 w-[1px] bg-gray-300 dark:bg-white/10" />
          <span className="text-[11px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            {store.text?.headline || 'AD ANALYSIS'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {comparableSessions.length > 0 && (
            <select
              value={compareId}
              onChange={e => setCompareId(e.target.value ? Number(e.target.value) : '')}
              className="text-[11px] font-bold bg-white dark:bg-[#1e1e21] border border-gray-200 dark:border-white/10 rounded-full px-3 py-2 text-gray-600 dark:text-gray-300 cursor-pointer hover:border-[#f9d85a] transition-all focus:outline-none"
            >
              <option value="">↔ COMPARE WITH...</option>
              {comparableSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label} · QS {s.qs?.toFixed(1)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e21] text-[12px] font-bold text-gray-700 dark:text-white hover:border-[#f9d85a] transition-all cursor-pointer"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'COPIED!' : 'COPY MARKDOWN'}
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 space-y-8">
        {/* 1. TOP METRICS & SCORES */}
        <OverviewHero store={store} />

        {compareStore && (
          <EvolutionSection currentStore={store} previousStore={compareStore} />
        )}

        {store.linkedin && <LinkedInSection linkedin={store.linkedin} />}
        
        <SentimentCard sentiment={store.sentiment} compositeScore={store.text?.sentiment_score} compositeSentiment={store.compositeSentiment} />

        {/* 2. FOUND / EXTRACTED (What Polaris Saw) */}
        {store.mediaDecomposition && <MediaSection mediaDecomposition={store.mediaDecomposition} />}
        {store.audioIntelligence && <AudioSection data={store.audioIntelligence} />}
        {!store.mediaDecomposition && <CreativeCard vision={store.vision} />}
        <LanguageSection text={store.text} />
        <EntityAtomizationSection entityAtomization={store.entityAtomization} />

        {/* 3. CALCULATIONS, CONTEXT & CROSS-REFERENCING (How Polaris Interprets It) */}
        <ResonanceSection resonanceGraph={store.resonanceGraph} />
        <TrendsSection trends={store.trends} alignment={store.alignment} />
        <CulturalContextSection culturalContext={store.culturalContext} />
        <MarketSection
          benchmark={store.benchmark}
          landing={store.landing}
          reddit={store.reddit}
          competitor={store.competitor}
        />

        {/* 4. PIPELINE (How Polaris Did It) */}
        <PipelineSection steps={store.steps} />

        {/* 5. EXECUTIVE SUMMARY (Final Synthesis) */}
        <DiagnosticSection diagnostic={store.diagnostic} />
      </div>
    </motion.section>
  )
}
