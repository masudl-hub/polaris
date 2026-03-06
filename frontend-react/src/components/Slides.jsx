import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Brain, Link2, Eye, Users, BarChart3, Zap,
  Target, TrendingUp, DollarSign, ShieldCheck, ArrowRight,
  ImagePlus, Type, Hash, Globe, Briefcase, MessageSquare,
  Activity, Layers, Database, BookOpen, AlertTriangle,
  CheckCircle2, CircleDot, ChevronRight, Monitor,
  FileText, LayoutDashboard, Clock, Sparkles, Play,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════ */
/*  Platform SVGs (from Compose.jsx — the real app icons)              */
/* ═══════════════════════════════════════════════════════════════════ */
const PLAT_SVG = {
  Meta: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303z',
  Google: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  TikTok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  X: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  LinkedIn: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  Snapchat: 'M12.166.053C12.86.053 16.26.396 17.854 4.09c.673 1.567.43 4.235.262 5.604l-.009.058a.636.636 0 00.355.676c.407.196.862.302 1.29.38.164.03.527.093.603.325.082.252-.149.501-.307.632-.35.289-.72.464-1.078.63-.26.12-.506.234-.71.38-.327.234-.504.574-.178 1.093.973 1.549 2.327 2.673 4.178 3.004.152.027.39.09.395.267.011.363-.71.744-1.127.891-.565.2-1.165.26-1.754.402-.321.078-.65.17-.953.326-.372.192-.468.534-.807.86-.404.389-1.018.864-2.07.864-.893 0-1.591-.368-2.35-.755-.795-.403-1.613-.664-2.576-.664-.992 0-1.785.285-2.573.664-.757.364-1.437.755-2.35.755-1.118 0-1.709-.521-2.114-.889-.32-.29-.434-.644-.785-.835a5.51 5.51 0 00-.952-.325c-.59-.143-1.19-.203-1.755-.403-.417-.147-1.138-.528-1.127-.891.005-.176.243-.24.395-.267 1.85-.33 3.205-1.455 4.178-3.004.327-.52.15-.86-.178-1.094-.205-.146-.45-.259-.71-.38-.358-.165-.728-.34-1.078-.629-.158-.131-.389-.38-.307-.632.076-.232.44-.296.603-.325.428-.078.883-.184 1.29-.38a.636.636 0 00.355-.676l-.01-.058c-.166-1.37-.41-4.037.263-5.604C7.876.396 11.277.053 11.97.053h.196z',
}
const PIcon = ({ name, size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d={PLAT_SVG[name]} /></svg>
)

/* ═══════════════════════════════════════════════════════════════════ */
/*  TRANSITIONS                                                       */
/* ═══════════════════════════════════════════════════════════════════ */
const variants = {
  enter: (d) => ({ x: d > 0 ? 600 : -600, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (d) => ({ x: d > 0 ? -600 : 600, opacity: 0, scale: 0.97 }),
}
const tx = { type: 'spring', damping: 32, stiffness: 300 }

/* ═══════════════════════════════════════════════════════════════════ */
/*  MICRO COMPONENTS                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
const G = ({ children }) => <span className="text-[#f9d85a]">{children}</span>

/* Animated flowing dot — shows data in motion */
const FlowDot = ({ delay = 0, duration = 2, color = '#f9d85a' }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full"
    style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
    initial={{ left: '0%', opacity: 0 }}
    animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
    transition={{ duration, delay, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
  />
)

/* Connector line with flowing data */
const FlowLine = ({ delay = 0, color = '#f9d85a' }) => (
  <div className="relative w-10 h-px flex items-center mx-1">
    <div className="absolute inset-0 h-px" style={{ background: `${color}30` }} />
    <FlowDot delay={delay} color={color} />
  </div>
)

/* Stat block */
const Stat = ({ value, label, sub, delay = 0, Icon }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: 'easeOut' }}
    className="flex flex-col items-center gap-1"
  >
    {Icon && <Icon size={20} className="text-gray-600 mb-1" />}
    <span className="font-mono font-black text-[48px] leading-none text-[#f9d85a]">{value}</span>
    <span className="text-base font-semibold text-white">{label}</span>
    {sub && <span className="text-xs text-gray-500 max-w-[200px] text-center leading-snug">{sub}</span>}
  </motion.div>
)

/* Card with subtle glow */
const GlowCard = ({ children, gold, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    className={`rounded-2xl p-5 ${gold ? 'bg-[#f9d85a]/[0.08] ring-1 ring-[#f9d85a]/20' : 'bg-white/[0.04] ring-1 ring-white/[0.07]'} ${className}`}
  >
    {children}
  </motion.div>
)

/* Check row for validation */
const Check = ({ text, detail, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="flex gap-3 items-start"
  >
    <CheckCircle2 size={18} className="text-[#22c55e] shrink-0 mt-0.5" />
    <div className="flex flex-col gap-0.5">
      <span className="text-white text-sm font-medium">{text}</span>
      <span className="text-xs text-gray-500 leading-relaxed">{detail}</span>
    </div>
  </motion.div>
)

/* Evolution row */
const EvoRow = ({ label, before, after, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="flex items-center gap-4"
  >
    <span className="w-[130px] shrink-0 text-sm font-semibold text-gray-500 text-right">{label}</span>
    <span className="text-sm text-gray-600 flex-1 text-right">{before}</span>
    <ArrowRight size={16} className="text-[#f9d85a] shrink-0" />
    <span className="text-base text-white flex-1">{after}</span>
  </motion.div>
)

/* ═══════════════════════════════════════════════════════════════════ */
/*  MINI APP MOCKUPS — stylized representations of the real UI         */
/* ═══════════════════════════════════════════════════════════════════ */

/* Compose mockup */
function MockCompose() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="w-[340px] rounded-2xl bg-[#1a1a1c] ring-1 ring-white/[0.08] overflow-hidden"
    >
      {/* Top bar */}
      <div className="h-9 bg-[#111113] flex items-center px-3 gap-1.5 border-b border-white/[0.06]">
        <div className="w-3 h-3 rounded-full bg-[#f9d85a]" />
        <span className="text-[10px] font-mono text-gray-500 ml-1">POLARIS</span>
      </div>
      <div className="p-4 flex gap-3">
        {/* Upload zone */}
        <div className="w-[120px] h-[100px] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1">
          <ImagePlus size={18} className="text-gray-600" />
          <span className="text-[8px] text-gray-600">Upload creative</span>
        </div>
        {/* Fields */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 rounded bg-white/[0.05] flex items-center px-2">
            <Type size={10} className="text-gray-600 mr-1" />
            <span className="text-[8px] text-gray-500">Headline...</span>
          </div>
          <div className="h-10 rounded bg-white/[0.05] flex items-start p-2">
            <FileText size={10} className="text-gray-600 mr-1 mt-px" />
            <span className="text-[8px] text-gray-500">Body copy...</span>
          </div>
          <div className="flex gap-1">
            {['Meta', 'Google', 'TikTok'].map(p => (
              <div key={p} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] ${p === 'Meta' ? 'bg-[#f9d85a]/15 text-[#f9d85a] ring-1 ring-[#f9d85a]/20' : 'bg-white/[0.04] text-gray-500'}`}>
                <PIcon name={p} size={8} />
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-6 rounded-lg bg-[#f9d85a] flex items-center justify-center">
          <Sparkles size={10} className="text-[#111113] mr-1" />
          <span className="text-[8px] font-bold text-[#111113]">Analyze</span>
        </div>
      </div>
    </motion.div>
  )
}

/* Analyze mockup — streaming progress */
function MockAnalyze() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="w-[340px] rounded-2xl bg-[#1a1a1c] ring-1 ring-white/[0.08] overflow-hidden"
    >
      <div className="h-9 bg-[#111113] flex items-center px-3 gap-1.5 border-b border-white/[0.06]">
        <div className="w-3 h-3 rounded-full bg-[#f9d85a]" />
        <span className="text-[10px] font-mono text-gray-500">ANALYZING</span>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        {/* Step counter */}
        <div className="flex items-baseline gap-1">
          <motion.span
            className="font-mono text-[40px] font-extrabold text-[#f9d85a] leading-none"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >08</motion.span>
          <span className="text-gray-600 font-mono text-lg">/</span>
          <span className="font-mono text-lg text-gray-500">13</span>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: 13 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 rounded-full ${i < 8 ? 'bg-[#f9d85a]' : 'bg-white/10'}`}
              animate={i === 7 ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
              transition={i === 7 ? { duration: 1, repeat: Infinity } : {}}
            />
          ))}
        </div>
        {/* Step list */}
        <div className="w-full flex flex-col gap-1.5 mt-1">
          {['spaCy NER', 'RoBERTa', 'GloVe', 'Gemini Vision', 'Trends API', 'SEM Auction', 'Benchmarks', 'Reddit API'].map((s, i) => (
            <div key={s} className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.03]">
              <CheckCircle2 size={10} className="text-[#22c55e]" />
              <span className="text-[9px] text-gray-400 flex-1">{s}</span>
              <span className="text-[8px] font-mono text-gray-600">{(120 + i * 80 + Math.floor(Math.random() * 100))}ms</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* Results mockup — dashboard cards */
function MockResults() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.6 }}
      className="w-[340px] rounded-2xl bg-[#1a1a1c] ring-1 ring-white/[0.08] overflow-hidden"
    >
      <div className="h-9 bg-[#111113] flex items-center px-3 gap-1.5 border-b border-white/[0.06]">
        <div className="w-3 h-3 rounded-full bg-[#f9d85a]" />
        <span className="text-[10px] font-mono text-gray-500">RESULTS</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#111113] p-2.5 flex flex-col">
            <span className="text-[7px] text-gray-600 uppercase">Quality Score</span>
            <span className="font-mono text-2xl font-light text-white mt-1">8.4</span>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-2.5 flex flex-col">
            <span className="text-[7px] text-gray-600 uppercase">eCPC</span>
            <span className="font-mono text-lg text-white mt-1">$0.89</span>
          </div>
          <div className="rounded-xl bg-[#f9d85a]/10 p-2.5 flex flex-col">
            <span className="text-[7px] text-gray-600 uppercase">Clicks</span>
            <span className="font-mono text-lg text-[#f9d85a] mt-1">112</span>
          </div>
        </div>
        {/* Sentiment bar */}
        <div className="rounded-xl bg-white/[0.03] p-2.5">
          <span className="text-[7px] text-gray-600 uppercase block mb-1.5">Sentiment</span>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-[#22c55e]" style={{ width: '62%' }} />
            <div className="bg-gray-500" style={{ width: '28%' }} />
            <div className="bg-[#ef4444]" style={{ width: '10%' }} />
          </div>
        </div>
        {/* Trend mini chart */}
        <div className="rounded-xl bg-white/[0.03] p-2.5">
          <span className="text-[7px] text-gray-600 uppercase block mb-1">90-Day Trend</span>
          <svg viewBox="0 0 200 50" className="w-full h-10" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9d85a" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f9d85a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[15, 30].map(y => <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(255,255,255,0.03)" />)}
            <path d="M0,40 C20,38 40,32 60,28 S100,22 120,25 S160,14 180,10 L200,8" fill="none" stroke="#f9d85a" strokeWidth="2" />
            <path d="M0,40 C20,38 40,32 60,28 S100,22 120,25 S160,14 180,10 L200,8 V50 H0 Z" fill="url(#tg)" />
          </svg>
        </div>
        {/* Entities */}
        <div className="flex gap-1 flex-wrap">
          {['Nike', 'Running', 'US'].map(e => (
            <span key={e} className="px-1.5 py-0.5 rounded text-[7px] bg-[#f9d85a]/10 text-[#f9d85a]">{e}</span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  PIPELINE NODE — used in architecture diagram                       */
/* ═══════════════════════════════════════════════════════════════════ */
const PipeNode = ({ Icon, label, color = '#f9d85a', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4, type: 'spring' }}
    className="flex flex-col items-center gap-1"
  >
    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}12`, border: `1.5px solid ${color}25` }}>
      <Icon size={18} style={{ color }} />
    </div>
    <span className="text-[10px] text-gray-500 text-center w-16 leading-tight">{label}</span>
  </motion.div>
)

/* ═══════════════════════════════════════════════════════════════════ */
/*  QUALITY SCORE FORMULA — animated visual equation                   */
/* ═══════════════════════════════════════════════════════════════════ */
function QSFormula() {
  const factors = [
    { Icon: Brain, label: 'Sentiment', weight: '0.35', color: '#f9d85a' },
    { Icon: TrendingUp, label: 'Trend', weight: '0.30', color: '#34d399' },
    { Icon: Eye, label: 'Visual', weight: '0.35', color: '#a78bfa' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]"
    >
      <span className="text-xs text-gray-500 font-mono mr-2">QS =</span>
      {factors.map((f, i) => (
        <div key={f.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-600 text-xs">+</span>}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: `${f.color}10`, border: `1px solid ${f.color}20` }}>
            <f.Icon size={14} style={{ color: f.color }} />
            <span className="text-[11px] font-medium" style={{ color: f.color }}>{f.label}</span>
            <span className="text-[10px] font-mono text-gray-500">{f.weight}</span>
          </div>
        </div>
      ))}
      <ChevronRight size={14} className="text-gray-600 mx-1" />
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f9d85a]/15 ring-1 ring-[#f9d85a]/25">
        <span className="font-mono font-bold text-[#f9d85a] text-sm">1-10</span>
      </div>
      <ChevronRight size={14} className="text-gray-600 mx-1" />
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e]/10 ring-1 ring-[#22c55e]/20">
        <DollarSign size={14} className="text-[#22c55e]" />
        <span className="text-[11px] font-medium text-[#22c55e]">eCPC</span>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SSE STREAMING VISUALIZATION                                        */
/* ═══════════════════════════════════════════════════════════════════ */
function SSEStream() {
  const events = [
    { name: 'text_data', label: 'NER + Sentiment' },
    { name: 'vision_data', label: 'Image Analysis' },
    { name: 'trend_data', label: 'Google Trends' },
    { name: 'sem_metrics', label: 'CPC + Auction' },
    { name: 'audience_data', label: 'IAB Matching' },
    { name: 'diagnostic', label: 'AI Summary' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.06]"
    >
      <div className="flex flex-col items-center gap-1">
        <Layers size={18} className="text-gray-400" />
        <span className="text-[10px] text-gray-500 font-medium">Server</span>
      </div>
      <div className="relative w-24 h-8 overflow-hidden mx-1">
        <div className="absolute inset-y-0 left-0 right-0 flex items-center">
          <div className="w-full h-px bg-white/10" />
        </div>
        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] font-mono text-[#f9d85a]/50">SSE</span>
        {events.map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 -mt-0.5 w-2 h-2 rounded-full bg-[#f9d85a]"
            style={{ boxShadow: '0 0 6px #f9d85a60' }}
            initial={{ left: '-5%', opacity: 0 }}
            animate={{ left: '105%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.2, delay: i * 0.35, repeat: Infinity, ease: 'linear', repeatDelay: events.length * 0.35 - 1.2 }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <Monitor size={18} className="text-gray-400" />
        <span className="text-[10px] text-gray-500 font-medium">Client</span>
      </div>
      <div className="flex flex-col gap-0.5 ml-3 border-l border-white/[0.06] pl-3">
        {events.map((e, i) => (
          <motion.div
            key={e.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + i * 0.1 }}
            className="flex items-center gap-2"
          >
            <span className="text-[9px] font-mono text-[#f9d85a]/60 w-20">{e.name}</span>
            <span className="text-[9px] text-gray-500">{e.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SLIDE DEFINITIONS                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/* 1 ── Title — cinematic P intro ───────────────────────────────── */
function S1() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      {/* Radial glow — starts invisible, blooms with the P */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
        style={{ background: 'radial-gradient(circle, rgba(249,216,90,0.08) 0%, transparent 70%)' }}
      />

      <div className="flex items-center gap-4 relative">
        {/* P block — flies in from above, lands with a bounce + glow pulse */}
        <motion.div
          initial={{ opacity: 0, y: -120, scale: 0.5, rotate: -20 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{
            duration: 0.9,
            ease: [0.16, 1, 0.3, 1],
            scale: { type: 'spring', damping: 12, stiffness: 200, delay: 0.1 },
            rotate: { type: 'spring', damping: 15, stiffness: 150 },
          }}
          className="relative"
        >
          {/* Glow ring that pulses on landing */}
          <motion.div
            className="absolute -inset-3 rounded-[28px]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.3, 1.5] }}
            transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(circle, rgba(249,216,90,0.4) 0%, transparent 70%)' }}
          />
          <motion.span
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#f9d85a] text-[#1a1a1c] font-mono font-black text-4xl relative z-10"
            animate={{ boxShadow: ['0 0 20px rgba(249,216,90,0.2)', '0 0 60px rgba(249,216,90,0.4)', '0 0 40px rgba(249,216,90,0.3)'] }}
            transition={{ delay: 0.8, duration: 2, ease: 'easeInOut' }}
          >P</motion.span>
        </motion.div>

        {/* OLARIS text — slides in from right after P lands */}
        <motion.span
          className="font-mono font-black text-7xl tracking-tight text-white"
          initial={{ opacity: 0, x: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >OLARIS</motion.span>
      </div>

      {/* Subtitle — fades up after logo assembles */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6, ease: 'easeOut' }}
        className="text-xl text-gray-400 font-light tracking-wide"
      >Ad &amp; Post Performance Analysis Platform</motion.p>

      {/* Bottom details — staggered fade */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.6 }} className="flex flex-col items-center gap-3 mt-6">
        <motion.div className="w-12 h-px bg-[#f9d85a]/40" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.6, duration: 0.4 }} />
        <span className="text-xs uppercase tracking-[0.25em] text-gray-500 font-mono">MSIS 521 &mdash; Final Project</span>
        <span className="text-base text-gray-300 font-medium">Team 8</span>
        <div className="flex gap-6 mt-3">
          {['Member 1', 'Member 2', 'Member 3', 'Member 4', 'Member 5'].map((n, i) => (
            <motion.span key={n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 + i * 0.1 }} className="text-sm text-gray-500">{n}</motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/* 2 ── Problem ──────────────────────────────────────────────────── */
function S2() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[36px] leading-tight font-semibold text-white text-center max-w-[800px]">
        Advertisers waste budget because they <G>can&rsquo;t evaluate creative</G> before deploying
      </motion.h1>
      <div className="flex gap-20 items-end">
        <Stat value="$740B" label="Global ad spend" sub="Digital advertising, 2025" delay={0.2} Icon={DollarSign} />
        <Stat value="~26%" label="Wasted on poor creative" delay={0.4} Icon={AlertTriangle} />
        <Stat value="0" label="Pre-flight tools" sub="No way to score before launch" delay={0.6} Icon={ShieldCheck} />
      </div>
      <div className="flex gap-5 mt-2">
        {[
          { Icon: Target, title: 'No pre-testing', desc: 'Ads go live unscored' },
          { Icon: Globe, title: 'Platform blind spots', desc: 'Same creative across all platforms' },
          { Icon: DollarSign, title: 'Post-hoc only', desc: 'You learn what failed after spend' },
        ].map((item, i) => (
          <GlowCard key={item.title} delay={0.6 + i * 0.1} className="flex-1 max-w-[260px]">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <item.Icon size={16} className="text-gray-400" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">{item.title}</span>
                <span className="text-sm text-gray-400">{item.desc}</span>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  )
}

/* 3 ── Personas ─────────────────────────────────────────────────── */
function S3() {
  const personas = [
    { Icon: Briefcase, role: 'SMB Marketer', stat: '$500', statLabel: '/day budget', pain: 'One shot to get creative right', need: 'Score before publishing' },
    { Icon: BarChart3, role: 'Media Buyer', stat: '20+', statLabel: 'accounts', pain: 'Needs fast quality checks at scale', need: 'Compare options instantly' },
    { Icon: MessageSquare, role: 'Social Manager', stat: '3-5x', statLabel: '/week posts', pain: 'Wants optimal timing and hooks', need: 'Predict before posting' },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[36px] leading-tight font-semibold text-white text-center max-w-[800px]">
        Three roles need a <G>pre-flight check</G> for every campaign
      </motion.h1>
      <div className="flex gap-6">
        {personas.map((p, i) => (
          <GlowCard key={p.role} delay={0.2 + i * 0.15} className="w-[300px] flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <p.Icon size={22} className="text-gray-300" />
              </div>
              <span className="text-xl font-bold text-white">{p.role}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-black text-[36px] leading-none text-[#f9d85a]">{p.stat}</span>
              <span className="text-sm text-gray-500">{p.statLabel}</span>
            </div>
            <span className="text-sm text-gray-400">{p.pain}</span>
            <div className="pt-3 border-t border-white/[0.06]">
              <span className="text-sm font-semibold text-[#f9d85a]">{p.need}</span>
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  )
}

/* 4 ── Solution — with live app mockups ─────────────────────────── */
function S4() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-12">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[34px] leading-tight font-semibold text-white text-center max-w-[800px]">
        Polaris evaluates ads across <G>6 platforms</G> using <G>7 ML models</G> before a dollar is spent
      </motion.h1>

      {/* Three app mockups showing the user journey */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <MockCompose />
          <span className="text-sm text-gray-500 font-medium">1. Compose</span>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center h-[200px]">
          <ChevronRight size={20} className="text-[#f9d85a]/40" />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <MockAnalyze />
          <span className="text-sm text-gray-500 font-medium">2. Analyze</span>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center h-[200px]">
          <ChevronRight size={20} className="text-[#f9d85a]/40" />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <MockResults />
          <span className="text-sm text-gray-500 font-medium">3. Results</span>
        </div>
      </div>

      {/* Platform row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex gap-4 items-center">
        {Object.keys(PLAT_SVG).map((p, i) => (
          <motion.div key={p} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 + i * 0.06 }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] ring-1 ring-white/[0.06] text-gray-400 text-sm">
            <PIcon name={p} size={14} />
            {p}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

/* 5 ── Architecture — animated pipeline flow ───────────────────── */
function S5() {
  const c1 = '#f9d85a', c2 = '#a78bfa', c3 = '#34d399'
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-12">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] leading-tight font-semibold text-white text-center max-w-[800px]">
        A deterministic pipeline <G>streams results</G> through 13 steps in ~30 seconds
      </motion.h1>

      {/* Three parallel input pipelines */}
      <div className="flex gap-6 items-start">
        {[
          { label: 'SEMANTIC', color: c1, nodes: [
            { Icon: Search, name: 'spaCy NER' }, { Icon: Brain, name: 'RoBERTa' }, { Icon: Link2, name: 'GloVe' },
          ]},
          { label: 'VISUAL', color: c2, nodes: [
            { Icon: Eye, name: 'Gemini Vision' }, { Icon: FileText, name: 'OCR + Brand' }, { Icon: LayoutDashboard, name: 'Platform Fit' },
          ]},
          { label: 'FORECAST', color: c3, nodes: [
            { Icon: TrendingUp, name: 'Trends API' }, { Icon: Globe, name: 'Regions' }, { Icon: Activity, name: 'Queries' },
          ]},
        ].map((g, gi) => (
          <motion.div key={g.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + gi * 0.12 }}
            className="flex flex-col items-center gap-3 rounded-2xl p-4 ring-1 min-w-[180px]"
            style={{ background: `${g.color}06`, borderColor: `${g.color}15` }}
          >
            <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: g.color }}>{g.label}</span>
            <div className="flex gap-2">
              {g.nodes.map(n => <PipeNode key={n.name} Icon={n.Icon} label={n.name} color={g.color} delay={0.3 + gi * 0.12} />)}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Convergence indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-1">
        <svg width="200" height="20" viewBox="0 0 200 20"><path d="M20 2 L100 16 L180 2" stroke="#f9d85a" strokeWidth="1" fill="none" opacity="0.25" /><circle cx="100" cy="16" r="3" fill="#f9d85a" opacity="0.4" /></svg>
      </motion.div>

      {/* Scoring → Intelligence → Synthesis */}
      <div className="flex gap-4 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="flex flex-col items-center gap-3 rounded-2xl p-3 ring-1 ring-[#22c55e]/15 bg-[#22c55e]/[0.03]">
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#22c55e]">SCORING</span>
          <div className="flex gap-2">
            <PipeNode Icon={Target} label="SEM Auction" color="#22c55e" delay={0.7} />
            <PipeNode Icon={Database} label="Benchmarks" color="#22c55e" delay={0.75} />
            <PipeNode Icon={Globe} label="Landing Pg" color="#22c55e" delay={0.8} />
            <PipeNode Icon={MessageSquare} label="Reddit" color="#22c55e" delay={0.85} />
          </div>
        </motion.div>

        <FlowLine delay={0.9} color="#22c55e" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="flex flex-col items-center gap-3 rounded-2xl p-3 ring-1 ring-[#a78bfa]/15 bg-[#a78bfa]/[0.03]">
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#a78bfa]">INTELLIGENCE</span>
          <div className="flex gap-2">
            <PipeNode Icon={Users} label="Audience" color="#a78bfa" delay={0.9} />
            <PipeNode Icon={Layers} label="Alignment" color="#a78bfa" delay={0.95} />
            <PipeNode Icon={BarChart3} label="LinkedIn" color="#a78bfa" delay={1.0} />
            <PipeNode Icon={Briefcase} label="Competitors" color="#a78bfa" delay={1.05} />
          </div>
        </motion.div>

        <FlowLine delay={1.1} color="#f9d85a" />

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 }}
          className="flex flex-col items-center gap-2 rounded-2xl p-3 ring-1 ring-[#f9d85a]/25 bg-[#f9d85a]/[0.05]">
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#f9d85a]">SYNTHESIS</span>
          <PipeNode Icon={Sparkles} label="Gemini Flash" color="#f9d85a" delay={1.15} />
        </motion.div>
      </div>

      {/* SSE streaming vis */}
      <SSEStream />
    </div>
  )
}

/* 6 ── ML Models + QS Formula ───────────────────────────────────── */
function S6() {
  const groups = [
    { label: 'NLP', color: '#f9d85a', models: [
      { name: 'spaCy', Icon: Search, task: 'Entity extraction' },
      { name: 'RoBERTa', Icon: Brain, task: 'Sentiment scoring' },
      { name: 'GloVe 50d', Icon: Link2, task: 'Hashtag expansion' },
    ]},
    { label: 'VISION', color: '#a78bfa', models: [
      { name: 'Gemini Vision', Icon: Eye, task: 'Image analysis' },
    ]},
    { label: 'INTELLIGENCE', color: '#34d399', models: [
      { name: 'MiniLM-L6', Icon: Users, task: 'Audience matching' },
      { name: 'HistGBR', Icon: BarChart3, task: 'Engagement prediction' },
    ]},
    { label: 'SYNTHESIS', color: '#f97316', models: [
      { name: 'Gemini Flash', Icon: Sparkles, task: 'Diagnostic prose' },
    ]},
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] leading-tight font-semibold text-white text-center max-w-[800px]">
        <G>7 purpose-built models</G> &mdash; no black boxes
      </motion.h1>

      <div className="flex gap-5 w-full max-w-[960px]">
        {groups.map((g, gi) => (
          <motion.div key={g.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + gi * 0.1 }}
            className="flex-1 rounded-2xl p-4 ring-1 flex flex-col gap-3"
            style={{ background: `${g.color}06`, borderColor: `${g.color}18` }}>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-center" style={{ color: g.color }}>{g.label}</span>
            {g.models.map(m => (
              <div key={m.name} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03]">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${g.color}12` }}>
                  <m.Icon size={22} style={{ color: g.color }} />
                </div>
                <span className="font-mono text-[13px] font-bold" style={{ color: g.color }}>{m.name}</span>
                <span className="text-[11px] text-gray-400 text-center">{m.task}</span>
              </div>
            ))}
          </motion.div>
        ))}
      </div>

      {/* QS Formula visualization */}
      <QSFormula />
    </div>
  )
}

/* 7 ── Data Sources ─────────────────────────────────────────────── */
function S7() {
  /* Mini data preview components */
  const MiniTrendChart = () => (
    <div className="flex flex-col gap-1 mt-2 flex-1">
      <svg viewBox="0 0 180 70" className="w-full flex-1" preserveAspectRatio="none">
        <defs><linearGradient id="mtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.3" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
        {/* Grid lines */}
        {[18, 36, 54].map(y => <line key={y} x1="0" y1={y} x2="180" y2={y} stroke="rgba(255,255,255,0.04)" />)}
        <path d="M0,55 Q10,52 25,48 T50,40 T75,35 T100,30 T125,22 T150,15 T180,10" fill="none" stroke="#34d399" strokeWidth="2" />
        <path d="M0,55 Q10,52 25,48 T50,40 T75,35 T100,30 T125,22 T150,15 T180,10 V70 H0 Z" fill="url(#mtg)" />
        {/* Data points */}
        {[[0,55],[50,40],[100,30],[150,15],[180,10]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#34d399" />
        ))}
      </svg>
      <div className="flex justify-between text-[8px] text-gray-600 px-1">
        <span>90 days ago</span><span>60d</span><span>30d</span><span>Today</span>
      </div>
    </div>
  )
  const MiniTaxonomy = () => (
    <div className="flex flex-col gap-1.5 mt-2 flex-1">
      <div className="text-[8px] text-gray-600 mb-0.5">Hierarchical category matching</div>
      {[
        { w: '100%', l: 'IAB Tier 1', count: '29 categories', opacity: 0.5 },
        { w: '85%', l: 'Technology & Computing', count: '→ 12 subcats', opacity: 0.4 },
        { w: '65%', l: 'Consumer Electronics', count: '→ 8 subcats', opacity: 0.35 },
        { w: '45%', l: 'Smartphones', count: '→ leaf node', opacity: 0.25 },
      ].map((r, i) => (
        <motion.div key={r.l} className="flex items-center gap-2" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
          <div className="h-2.5 rounded-full" style={{ width: r.w, background: `rgba(249,216,90,${r.opacity})` }} />
          <span className="text-[8px] text-gray-500 whitespace-nowrap shrink-0">{r.l}</span>
          <span className="text-[7px] text-gray-600 whitespace-nowrap">{r.count}</span>
        </motion.div>
      ))}
      <div className="flex gap-1 mt-1">
        {['Automotive', 'Health', 'Finance', 'Travel', 'Food'].map(t => (
          <span key={t} className="text-[7px] px-1.5 py-0.5 rounded bg-[#f9d85a]/[0.08] text-[#f9d85a]/60">{t}</span>
        ))}
      </div>
    </div>
  )
  const MiniSentimentBars = () => (
    <div className="flex flex-col gap-1.5 mt-2 flex-1">
      <div className="text-[8px] text-gray-600">Live subreddit sentiment on brand/product</div>
      {[
        { sub: 'r/marketing', score: 0.72, posts: '2.4k', sentiment: 'Positive' },
        { sub: 'r/advertising', score: 0.58, posts: '890', sentiment: 'Mixed' },
        { sub: 'r/socialmedia', score: 0.81, posts: '1.1k', sentiment: 'Positive' },
      ].map((r, i) => (
        <motion.div key={r.sub} className="flex items-center gap-2" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
          <span className="text-[8px] text-[#f97316]/80 font-mono w-20 shrink-0">{r.sub}</span>
          <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: r.score > 0.7 ? '#22c55e40' : '#f59e0b40', width: `${r.score * 100}%` }}
              initial={{ width: 0 }} animate={{ width: `${r.score * 100}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }} />
          </div>
          <span className="text-[7px] text-gray-600 w-6">{r.posts}</span>
          <span className="text-[7px] font-medium w-12" style={{ color: r.score > 0.7 ? '#22c55e' : '#f59e0b' }}>{r.sentiment}</span>
        </motion.div>
      ))}
      <div className="flex gap-1 items-end h-6 mt-1">
        {[0.3, 0.5, 0.7, 0.4, 0.8, 0.6, 0.9, 0.5, 0.7, 0.8].map((h, i) => (
          <motion.div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 100}%`, background: h > 0.6 ? '#f9731630' : '#f9731615' }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.6 + i * 0.03 }} />
        ))}
      </div>
    </div>
  )
  const MiniAdGrid = () => (
    <div className="flex flex-col gap-1.5 mt-2 flex-1">
      <div className="text-[8px] text-gray-600">Competitor creative intelligence</div>
      {[
        { brand: 'Competitor A', ads: 142, spend: '$45K/mo', format: 'Video' },
        { brand: 'Competitor B', ads: 89, spend: '$28K/mo', format: 'Carousel' },
        { brand: 'Competitor C', ads: 56, spend: '$12K/mo', format: 'Image' },
      ].map((r, i) => (
        <motion.div key={r.brand} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#60a5fa]/[0.06]"
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
          <div className="w-5 h-5 rounded bg-[#60a5fa]/20 flex items-center justify-center">
            <Eye size={8} className="text-[#60a5fa]" />
          </div>
          <span className="text-[8px] font-medium text-white/70 flex-1">{r.brand}</span>
          <span className="text-[7px] font-mono text-[#60a5fa]/70">{r.ads} ads</span>
          <span className="text-[7px] font-mono text-gray-600">{r.spend}</span>
        </motion.div>
      ))}
      <div className="grid grid-cols-6 gap-0.5 mt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div key={i} className="aspect-[4/5] rounded-sm bg-[#60a5fa]/15 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.04 }}>
            <ImagePlus size={6} className="text-[#60a5fa]/30" />
          </motion.div>
        ))}
      </div>
    </div>
  )
  const MiniBenchBars = () => {
    const metrics = ['CPC', 'CTR', 'CVR', 'CPM', 'CPA']
    const platforms = ['Meta', 'Google', 'TikTok', 'LinkedIn', 'X', 'Snap']
    const data = [
      [0.6, 0.8, 0.4, 0.9, 0.5, 0.3],
      [0.7, 0.5, 0.8, 0.4, 0.6, 0.7],
      [0.3, 0.6, 0.5, 0.7, 0.3, 0.4],
      [0.5, 0.7, 0.6, 0.8, 0.4, 0.5],
      [0.4, 0.9, 0.3, 0.6, 0.5, 0.3],
    ]
    return (
      <div className="flex flex-col gap-1 mt-2 flex-1">
        <div className="flex gap-0.5">
          <div className="w-7" />
          {platforms.map(p => <span key={p} className="flex-1 text-[7px] text-gray-600 text-center">{p}</span>)}
        </div>
        {metrics.map((m, mi) => (
          <div key={m} className="flex gap-0.5 items-center">
            <span className="text-[8px] text-gray-500 w-7 text-right pr-1 shrink-0">{m}</span>
            {data[mi].map((v, pi) => (
              <motion.div key={pi} className="flex-1 h-4 rounded-sm" style={{ background: `rgba(167,139,250,${v * 0.6})` }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + mi * 0.05 + pi * 0.03 }} />
            ))}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-[#a78bfa]/15" />
            <span className="text-[7px] text-gray-600">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-[#a78bfa]/60" />
            <span className="text-[7px] text-gray-600">High</span>
          </div>
        </div>
      </div>
    )
  }
  const MiniStudies = () => (
    <div className="flex flex-col gap-1.5 mt-2 flex-1">
      {[
        { src: 'Social Insider', finding: 'Carousel posts drive 1.4x engagement' },
        { src: 'Hootsuite', finding: 'Best posting: Tue–Thu 9–11 AM' },
        { src: 'Buffer', finding: 'Video posts get 5x reach vs text' },
        { src: 'Sprout Social', finding: 'Optimal hashtags: 3–5 per post' },
        { src: 'WordStream', finding: 'Avg CPC benchmarks across industries' },
      ].map((s, i) => (
        <motion.div key={s.src} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#f472b6]/[0.06]"
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
          <BookOpen size={10} className="text-[#f472b6]/60 shrink-0" />
          <span className="text-[8px] font-bold text-[#f472b6]/80 shrink-0 w-16">{s.src}</span>
          <span className="text-[8px] text-gray-500 flex-1">{s.finding}</span>
        </motion.div>
      ))}
    </div>
  )

  const sources = [
    { name: 'Google Trends', stat: '90-day series', Icon: TrendingUp, color: '#34d399', Preview: MiniTrendChart },
    { name: 'IAB Taxonomy', stat: '1,558 segments', Icon: Users, color: '#f9d85a', Preview: MiniTaxonomy },
    { name: 'Reddit API', stat: 'Live sentiment', Icon: MessageSquare, color: '#f97316', Preview: MiniSentimentBars },
    { name: 'Meta Ad Library', stat: 'Competitor intel', Icon: Briefcase, color: '#60a5fa', Preview: MiniAdGrid },
    { name: 'Benchmarks DB', stat: '10 x 6 matrix', Icon: Database, color: '#a78bfa', Preview: MiniBenchBars },
    { name: 'Published Research', stat: '10 studies', Icon: BookOpen, color: '#f472b6', Preview: MiniStudies },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-12">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[34px] leading-tight font-semibold text-white text-center max-w-[800px]">
        Grounded in <G>6 live data sources</G> and <G>1,558 IAB taxonomy</G> segments
      </motion.h1>

      {/* Source cards — 2 rows of 3, expanded */}
      <div className="grid grid-cols-3 gap-5 w-full max-w-[1060px]">
        {sources.map((s, i) => (
          <motion.div key={s.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
            className="rounded-2xl p-5 bg-white/[0.04] ring-1 ring-white/[0.07] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <s.Icon size={20} style={{ color: s.color }} />
                </div>
                <span className="text-base font-bold text-white">{s.name}</span>
              </div>
              <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${s.color}15`, color: s.color }}>{s.stat}</span>
            </div>
            <s.Preview />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* 8 ── Validation — visual comparisons ─────────────────────────── */
/* Mini bar comparison */
const CompBar = ({ label, ours, benchmark, oursLabel, benchLabel, color, delay = 0 }) => (
  <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }} className="flex flex-col gap-1.5">
    <span className="text-sm text-white font-medium">{label}</span>
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16 text-right">{oursLabel}</span>
        <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${ours}%` }} transition={{ delay: delay + 0.2, duration: 0.6, ease: 'easeOut' }} />
        </div>
        <span className="text-[10px] font-mono w-10" style={{ color }}>{ours}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16 text-right">{benchLabel}</span>
        <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full bg-white/20" initial={{ width: 0 }} animate={{ width: `${benchmark}%` }} transition={{ delay: delay + 0.3, duration: 0.6, ease: 'easeOut' }} />
        </div>
        <span className="text-[10px] font-mono text-gray-500 w-10">{benchmark}%</span>
      </div>
    </div>
  </motion.div>
)

/* Mini QS gauge */
const MiniGauge = ({ value, max = 10, label, color, delay = 0 }) => {
  const r = 28, circ = Math.PI * r // semicircle
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="flex flex-col items-center gap-1">
      <svg width="70" height="42" viewBox="0 0 70 42">
        <path d="M 7 38 A 28 28 0 0 1 63 38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
        <motion.path d="M 7 38 A 28 28 0 0 1 63 38" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - value / max) }}
          transition={{ delay: delay + 0.3, duration: 0.8, ease: 'easeOut' }} />
        <text x="35" y="36" textAnchor="middle" fill="white" fontSize="16" fontFamily="monospace" fontWeight="bold">{value}</text>
      </svg>
      <span className="text-[10px] text-gray-400">{label}</span>
    </motion.div>
  )
}

function S8() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-7 px-12">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[34px] leading-tight font-semibold text-white text-center max-w-[800px]">
        Validated against <G>industry benchmarks</G> and known-good inputs
      </motion.h1>

      <div className="grid grid-cols-2 gap-5 w-full max-w-[960px]">
        {/* QS Formula — show gauges for good vs bad inputs */}
        <GlowCard delay={0.15} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#f9d85a]/10 flex items-center justify-center"><Target size={18} className="text-[#f9d85a]" /></div>
            <span className="text-base font-bold text-white">QS responds to input quality</span>
          </div>
          <div className="flex justify-around items-end">
            <div className="flex flex-col items-center gap-1">
              <MiniGauge value={8.7} label="Positive + trending" color="#22c55e" delay={0.3} />
              <span className="text-[9px] text-[#22c55e]">High QS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MiniGauge value={5.2} label="Neutral + flat" color="#f59e0b" delay={0.4} />
              <span className="text-[9px] text-[#f59e0b]">Mid QS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MiniGauge value={2.1} label="Negative + dying" color="#ef4444" delay={0.5} />
              <span className="text-[9px] text-[#ef4444]">Low QS</span>
            </div>
          </div>
        </GlowCard>

        {/* CPC — animated comparison bars */}
        <GlowCard delay={0.25} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 flex items-center justify-center"><DollarSign size={18} className="text-[#22c55e]" /></div>
            <span className="text-base font-bold text-white">CPC matches platform data</span>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { p: 'LinkedIn', ours: 2.4, industry: 2.5, color: '#60a5fa' },
              { p: 'Google', ours: 1.6, industry: 1.7, color: '#34d399' },
              { p: 'Meta', ours: 1.0, industry: 1.0, color: '#f9d85a' },
              { p: 'TikTok', ours: 0.7, industry: 0.65, color: '#f472b6' },
            ].map((r, i) => (
              <motion.div key={r.p} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-14 text-right">{r.p}</span>
                <div className="flex-1 h-4 bg-white/[0.04] rounded-full overflow-hidden relative">
                  <motion.div className="h-full rounded-full" style={{ background: `${r.color}60` }}
                    initial={{ width: 0 }} animate={{ width: `${(r.ours / 2.8) * 100}%` }} transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }} />
                  {/* Industry marker */}
                  <motion.div className="absolute top-0 h-full w-0.5 bg-white/40" style={{ left: `${(r.industry / 2.8) * 100}%` }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.08 }} />
                </div>
                <span className="text-[10px] font-mono w-8" style={{ color: r.color }}>{r.ours}x</span>
              </motion.div>
            ))}
            <div className="flex items-center gap-3 mt-1 ml-16">
              <span className="text-[9px] text-gray-600">Bar = Ours</span>
              <span className="text-[9px] text-gray-600">| = Industry</span>
            </div>
          </div>
        </GlowCard>

        {/* LinkedIn — engagement rate comparison bars */}
        <GlowCard delay={0.35} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#60a5fa]/10 flex items-center justify-center"><BarChart3 size={18} className="text-[#60a5fa]" /></div>
            <span className="text-base font-bold text-white">LinkedIn matches published rates</span>
          </div>
          <CompBar label="Carousel" ours={66} benchmark={66} oursLabel="Polaris" benchLabel="Soc. Insider" color="#60a5fa" delay={0.5} />
          <CompBar label="Video" ours={56} benchmark={56} oursLabel="Polaris" benchLabel="Soc. Insider" color="#a78bfa" delay={0.6} />
          <CompBar label="Text Only" ours={12} benchmark={12} oursLabel="Polaris" benchLabel="Soc. Insider" color="#f9d85a" delay={0.7} />
        </GlowCard>

        {/* NLP — visual sentiment test */}
        <GlowCard delay={0.45} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#a78bfa]/10 flex items-center justify-center"><Brain size={18} className="text-[#a78bfa]" /></div>
            <span className="text-base font-bold text-white">Sentiment aligns with expected</span>
          </div>
          {/* Sentiment test cases */}
          <div className="flex flex-col gap-2">
            {[
              { input: '"Amazing new product launch!"', score: 0.92, color: '#22c55e', label: 'Positive' },
              { input: '"Check out our latest update"', score: 0.51, color: '#f59e0b', label: 'Neutral' },
              { input: '"Terrible customer experience"', score: 0.08, color: '#ef4444', label: 'Negative' },
            ].map((t, i) => (
              <motion.div key={t.input} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.1 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03]">
                <span className="text-[10px] text-gray-400 flex-1 italic">{t.input}</span>
                <div className="w-20 h-3 bg-white/[0.04] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: t.color }}
                    initial={{ width: 0 }} animate={{ width: `${t.score * 100}%` }} transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }} />
                </div>
                <span className="text-[10px] font-mono w-12" style={{ color: t.color }}>{t.score.toFixed(2)}</span>
                <span className="text-[9px] font-medium w-14" style={{ color: t.color }}>{t.label}</span>
              </motion.div>
            ))}
          </div>
        </GlowCard>
      </div>
    </div>
  )
}

/* 9 ── Evolution ────────────────────────────────────────────────── */
function S9() {
  const upgrades = [
    { Icon: Eye, label: 'Vision', from: 'EfficientNetB0', to: 'Gemini Vision', detail: '30+ prompts', color: '#a78bfa' },
    { Icon: Brain, label: 'LLM', from: 'GPT-4o-mini', to: 'Gemini Flash', detail: 'Deterministic-first', color: '#f9d85a' },
    { Icon: Monitor, label: 'Frontend', from: 'Streamlit', to: 'React + Framer', detail: 'Full SPA', color: '#34d399' },
    { Icon: Activity, label: 'Streaming', from: 'Single response', to: 'SSE', detail: '13 live events', color: '#f97316' },
    { Icon: Layers, label: 'Pipeline', from: '4 steps', to: '13 steps', detail: '3.25x deeper', color: '#60a5fa' },
    { Icon: Users, label: 'Audience', from: 'Hardcoded', to: 'IAB + Transformers', detail: '1,558 segments', color: '#f472b6' },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-12">
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[32px] leading-tight font-semibold text-white text-center max-w-[800px]">
        We expanded <G>well beyond</G> the original proposal
      </motion.h1>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[960px]">
        {upgrades.map((u, i) => (
          <motion.div key={u.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
            className="rounded-2xl p-4 bg-white/[0.04] ring-1 ring-white/[0.07] flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${u.color}15` }}>
                <u.Icon size={18} style={{ color: u.color }} />
              </div>
              <span className="text-base font-bold text-white">{u.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 line-through">{u.from}</span>
              <ArrowRight size={14} className="text-[#f9d85a] shrink-0" />
              <span className="text-sm font-semibold" style={{ color: u.color }}>{u.to}</span>
            </div>
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full self-start" style={{ background: `${u.color}12`, color: u.color }}>{u.detail}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* 10 ── Demo ────────────────────────────────────────────────────── */
function S10() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#f9d85a]/[0.03] blur-[120px]" />
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs uppercase tracking-[0.4em] text-[#f9d85a] font-mono">Live Demo</motion.span>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-5xl font-bold text-white">
        Let&rsquo;s see it in action
      </motion.h1>
      <div className="w-16 h-px bg-[#f9d85a]/30" />
      <div className="flex gap-8">
        <GlowCard delay={0.4} className="w-[320px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#f9d85a]/10 flex items-center justify-center"><Play size={16} className="text-[#f9d85a]" /></div>
            <span className="text-[#f9d85a] font-mono text-[11px] font-bold tracking-widest">SCENARIO 1</span>
          </div>
          <span className="text-white font-bold text-xl block mb-2">Ad Evaluation</span>
          <span className="text-sm text-gray-400 leading-relaxed block mb-3">Upload creative + copy, full streaming pipeline</span>
          <div className="flex gap-1.5">
            {['Meta', 'Google', 'TikTok'].map(p => (
              <div key={p} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[9px] text-gray-500"><PIcon name={p} size={10} />{p}</div>
            ))}
          </div>
        </GlowCard>
        <GlowCard delay={0.5} className="w-[320px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#f9d85a]/10 flex items-center justify-center"><Play size={16} className="text-[#f9d85a]" /></div>
            <span className="text-[#f9d85a] font-mono text-[11px] font-bold tracking-widest">SCENARIO 2</span>
          </div>
          <span className="text-white font-bold text-xl block mb-2">LinkedIn Post</span>
          <span className="text-sm text-gray-400 leading-relaxed block mb-3">Engagement prediction + timing heatmap</span>
          <div className="flex gap-1.5">
            {['LinkedIn'].map(p => (
              <div key={p} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[9px] text-gray-500"><PIcon name={p} size={10} />{p}</div>
            ))}
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[9px] text-gray-500"><Clock size={10} />Timing</div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] text-[9px] text-gray-500"><BarChart3 size={10} />Predict</div>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}

/* 11 ── Impact + Q&A ────────────────────────────────────────────── */
function S11() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[#f9d85a]/[0.03] blur-[100px]" />
      <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-[36px] leading-tight font-semibold text-white text-center max-w-[700px] relative">
        Polaris turns <G>guesswork into data</G> &mdash; saving budget before it&rsquo;s spent
      </motion.h1>
      <div className="flex gap-10 mt-2">
        {[
          { Icon: ShieldCheck, label: 'EVALUATE', desc: '7 models score every dimension before deployment' },
          { Icon: TrendingUp, label: 'PREDICT', desc: 'CPC, engagement, and trend timing in real-time' },
          { Icon: Zap, label: 'ACT', desc: 'Suggestions grounded in benchmarks and market data' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15 }} className="flex flex-col items-center gap-4 w-[220px] text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f9d85a]/10 flex items-center justify-center">
              <item.Icon size={28} className="text-[#f9d85a]" />
            </div>
            <span className="text-[#f9d85a] font-mono text-sm font-bold tracking-widest">{item.label}</span>
            <span className="text-base text-gray-400 leading-relaxed">{item.desc}</span>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex flex-col items-center gap-4 mt-4">
        <div className="w-12 h-px bg-white/[0.08]" />
        <span className="text-base text-gray-300 font-medium">Team 8</span>
        <div className="flex gap-6">{['Member 1', 'Member 2', 'Member 3', 'Member 4', 'Member 5'].map(n => <span key={n} className="text-sm text-gray-500">{n}</span>)}</div>
        <span className="text-2xl text-gray-400 mt-4">Questions?</span>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SLIDES ARRAY                                                       */
/* ═══════════════════════════════════════════════════════════════════ */
const slides = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11]

/* ═══════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
export default function Slides() {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)

  const go = useCallback((next) => {
    if (next < 0 || next >= slides.length) return
    setDir(next > index ? 1 : -1)
    setIndex(next)
  }, [index])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); go(index + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(index - 1) }
      if (e.key === 'Escape') window.location.hash = ''
      if (e.key === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
        else document.exitFullscreen?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, go])

  const Current = slides[index]

  return (
    <div className="fixed inset-0 z-[9999] bg-[#111113] text-white overflow-hidden select-none flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={index} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={tx} className="absolute inset-0">
            <Current />
          </motion.div>
        </AnimatePresence>
        <div onClick={() => go(index - 1)} className="absolute inset-y-0 left-0 w-20 cursor-w-resize z-20" />
        <div onClick={() => go(index + 1)} className="absolute inset-y-0 right-0 w-20 cursor-e-resize z-20" />
      </div>
      <div className="shrink-0 h-12 flex items-center justify-between px-6 border-t border-white/[0.06] relative z-30">
        <span className="font-mono text-xs text-gray-600">{String(index + 1).padStart(2, '0')}<span className="text-gray-700 mx-1">/</span>{String(slides.length).padStart(2, '0')}</span>
        <div className="flex gap-1.5">{slides.map((_, i) => (
          <button key={i} onClick={() => go(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#f9d85a]' : 'w-1.5 bg-white/15 hover:bg-white/30'}`} aria-label={`Slide ${i + 1}`} />
        ))}</div>
        <span className="font-mono text-[10px] text-gray-700">&larr;&rarr; &middot; F fullscreen &middot; ESC exit</span>
      </div>
    </div>
  )
}
