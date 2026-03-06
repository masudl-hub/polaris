import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
const Dim = ({ children }) => <span className="text-gray-500">{children}</span>

/* Animated number ring — circular SVG gauge */
const Ring = ({ value, max, size = 100, stroke = 6, label, color = '#f9d85a' }) => {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = value / max
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <span className="absolute font-mono font-bold text-white" style={{ fontSize: size * 0.28 }}>{value}</span>
      {label && <span className="text-[11px] text-gray-400 uppercase tracking-widest">{label}</span>}
    </div>
  )
}

/* Pipeline node with glow */
const PipeNode = ({ label, sub, color = '#f9d85a', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    className="flex flex-col items-center gap-1.5"
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
      style={{ background: `${color}20`, border: `1.5px solid ${color}40`, color }}
    >
      {label}
    </div>
    <span className="text-[10px] text-gray-400 text-center max-w-[80px] leading-tight">{sub}</span>
  </motion.div>
)

/* Arrow connector */
const Arrow = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scaleX: 0 }}
    animate={{ opacity: 1, scaleX: 1 }}
    transition={{ delay, duration: 0.3 }}
    className="flex items-center h-12"
  >
    <div className="w-8 h-px bg-gradient-to-r from-[#f9d85a]/60 to-[#f9d85a]/20" />
    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-[#f9d85a]/40" />
  </motion.div>
)

/* Stat block — big number with label */
const Stat = ({ value, label, sub, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: 'easeOut' }}
    className="flex flex-col items-center gap-1"
  >
    <span className="font-mono font-black text-[52px] leading-none text-[#f9d85a]">{value}</span>
    <span className="text-sm font-semibold text-white">{label}</span>
    {sub && <span className="text-[11px] text-gray-500 max-w-[180px] text-center leading-snug">{sub}</span>}
  </motion.div>
)

/* Card with glow border */
const GlowCard = ({ children, gold, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    className={`rounded-2xl p-5 ${gold ? 'bg-[#f9d85a]/[0.08] ring-1 ring-[#f9d85a]/20' : 'bg-white/[0.04] ring-1 ring-white/[0.07]'} ${className}`}
  >
    {children}
  </motion.div>
)

/* Model icon block */
const ModelBlock = ({ name, icon, task, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4 }}
    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]"
  >
    <span className="text-2xl">{icon}</span>
    <span className="font-mono text-xs font-bold text-[#f9d85a]">{name}</span>
    <span className="text-[11px] text-gray-400 text-center leading-snug">{task}</span>
  </motion.div>
)

/* Flow step with number */
const FlowStep = ({ num, title, desc, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="flex gap-4 items-start"
  >
    <div className="w-10 h-10 rounded-xl bg-[#f9d85a] text-[#111113] flex items-center justify-center font-mono font-black text-lg shrink-0">
      {num}
    </div>
    <div className="flex flex-col gap-0.5">
      <span className="text-white font-semibold text-base">{title}</span>
      <span className="text-sm text-gray-400 leading-relaxed">{desc}</span>
    </div>
  </motion.div>
)

/* Check validation row */
const Check = ({ text, detail, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="flex gap-3 items-start"
  >
    <div className="w-6 h-6 rounded-full bg-[#22c55e]/15 flex items-center justify-center shrink-0 mt-0.5">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
    <div className="flex flex-col gap-0.5">
      <span className="text-white text-sm font-medium">{text}</span>
      <span className="text-xs text-gray-500 leading-relaxed">{detail}</span>
    </div>
  </motion.div>
)

/* Evolution row — before → after */
const EvoRow = ({ label, before, after, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="flex items-center gap-4"
  >
    <span className="w-[140px] shrink-0 text-xs font-semibold text-gray-500 text-right">{label}</span>
    <span className="text-xs text-gray-600 flex-1 text-right">{before}</span>
    <svg width="20" height="12" viewBox="0 0 20 12" className="shrink-0"><path d="M2 6H16M16 6L12 2M16 6L12 10" stroke="#f9d85a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <span className="text-sm text-white flex-1">{after}</span>
  </motion.div>
)

/* ═══════════════════════════════════════════════════════════════════ */
/*  SLIDE DEFINITIONS                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/* 1 ── Title ────────────────────────────────────────────────────── */
function S1() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      {/* Radial glow behind logo */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[#f9d85a]/[0.04] blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="flex items-center gap-4 relative"
      >
        <span className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#f9d85a] text-[#1a1a1c] font-mono font-black text-4xl shadow-[0_0_60px_rgba(249,216,90,0.3)]">
          P
        </span>
        <span className="font-mono font-black text-7xl tracking-tight text-white">OLARIS</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-xl text-gray-400 font-light tracking-wide"
      >
        Ad &amp; Post Performance Analysis Platform
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="flex flex-col items-center gap-3 mt-6"
      >
        <div className="w-12 h-px bg-[#f9d85a]/40" />
        <span className="text-xs uppercase tracking-[0.25em] text-gray-500 font-mono">MSIS 521 &mdash; Final Project</span>
        <span className="text-base text-gray-300 font-medium">Team 8</span>
        <div className="flex gap-6 mt-3">
          {['Member 1', 'Member 2', 'Member 3', 'Member 4', 'Member 5'].map((n, i) => (
            <motion.span
              key={n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="text-sm text-gray-500"
            >{n}</motion.span>
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
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-[36px] leading-tight font-semibold text-white text-center max-w-[800px]"
      >
        Advertisers waste budget because they <G>can&rsquo;t evaluate creative</G> before deploying
      </motion.h1>

      {/* Big stats row */}
      <div className="flex gap-20 items-end">
        <Stat value="$740B" label="Global ad spend" sub="Digital advertising market, 2025" delay={0.2} />
        <Stat value="~26%" label="Wasted" sub="On underperforming creative (Juniper Research)" delay={0.4} />
        <Stat value="$0" label="Pre-flight evaluation" sub="No tools exist to score creative before launch" delay={0.6} />
      </div>

      {/* Three pain points as visual cards */}
      <div className="flex gap-5 mt-2">
        <GlowCard delay={0.6} className="flex-1 max-w-[260px]">
          <div className="flex gap-3 items-start">
            <span className="text-2xl">&#x1F6AB;</span>
            <div>
              <span className="text-sm font-semibold text-white block">No pre-testing</span>
              <span className="text-xs text-gray-400">Ads go live without quality scores or sentiment checks</span>
            </div>
          </div>
        </GlowCard>
        <GlowCard delay={0.7} className="flex-1 max-w-[260px]">
          <div className="flex gap-3 items-start">
            <span className="text-2xl">&#x1F500;</span>
            <div>
              <span className="text-sm font-semibold text-white block">Platform blind spots</span>
              <span className="text-xs text-gray-400">Same creative reused across TikTok, LinkedIn, Meta</span>
            </div>
          </div>
        </GlowCard>
        <GlowCard delay={0.8} className="flex-1 max-w-[260px]">
          <div className="flex gap-3 items-start">
            <span className="text-2xl">&#x1F4B8;</span>
            <div>
              <span className="text-sm font-semibold text-white block">Post-hoc only</span>
              <span className="text-xs text-gray-400">Platforms tell you what failed after budget is gone</span>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}

/* 3 ── Who Needs This ───────────────────────────────────────────── */
function S3() {
  const personas = [
    { icon: '&#x1F4B0;', role: 'SMB Marketer', pain: '$500/day budget, one shot to get creative right. Can\'t afford A/B testing at scale.', need: 'Score creative before publishing' },
    { icon: '&#x1F4CA;', role: 'Media Buyer', pain: 'Manages 20+ accounts across platforms. Needs fast quality checks to justify spend.', need: 'Compare creative options instantly' },
    { icon: '&#x270D;&#xFE0F;', role: 'Social Manager', pain: 'Posts 3-5x/week on LinkedIn. Wants to know optimal timing and hook quality.', need: 'Predict engagement before posting' },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[32px] leading-tight font-semibold text-white text-center max-w-[750px]"
      >
        Three roles need a <G>pre-flight check</G> for every campaign
      </motion.h1>

      <div className="flex gap-6">
        {personas.map((p, i) => (
          <GlowCard key={p.role} delay={0.2 + i * 0.15} className="w-[280px] flex flex-col gap-4">
            <span className="text-3xl" dangerouslySetInnerHTML={{ __html: p.icon }} />
            <span className="text-lg font-bold text-white">{p.role}</span>
            <span className="text-sm text-gray-400 leading-relaxed flex-1">{p.pain}</span>
            <div className="pt-3 border-t border-white/[0.06]">
              <span className="text-xs font-semibold text-[#f9d85a]">{p.need}</span>
            </div>
          </GlowCard>
        ))}
      </div>
    </div>
  )
}

/* 4 ── Solution Overview ────────────────────────────────────────── */
function S4() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[32px] leading-tight font-semibold text-white text-center max-w-[800px]"
      >
        Polaris evaluates ads across <G>6 platforms</G> using <G>7 ML models</G> before a dollar is spent
      </motion.h1>

      {/* User journey — visual flow */}
      <div className="flex items-center gap-3">
        {[
          { num: '1', title: 'Compose', desc: 'Upload creative, write copy, set targeting' },
          { num: '2', title: 'Analyze', desc: '13 ML steps stream results in real-time' },
          { num: '3', title: 'Results', desc: 'Dashboard with scores, predictions, diagnostics' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.2, duration: 0.5 }}
              className="w-[240px] rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07] p-5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#f9d85a] text-[#111113] flex items-center justify-center font-mono font-black text-base">{s.num}</span>
                <span className="text-white font-bold text-lg">{s.title}</span>
              </div>
              <span className="text-xs text-gray-400 leading-relaxed">{s.desc}</span>
            </motion.div>
            {i < 2 && <Arrow delay={0.4 + i * 0.2} />}
          </div>
        ))}
      </div>

      {/* Platform pills + key stats */}
      <div className="flex flex-col items-center gap-5">
        <div className="flex gap-3">
          {['Meta', 'Google', 'TikTok', 'X', 'LinkedIn', 'Snapchat'].map((p, i) => (
            <motion.div
              key={p}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.06 }}
              className="px-4 py-2 rounded-full bg-white/[0.05] ring-1 ring-white/[0.08] text-sm text-gray-300 font-medium"
            >
              {p}
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex gap-8 text-center"
        >
          <div><span className="font-mono text-2xl font-bold text-[#f9d85a]">7</span><span className="text-xs text-gray-500 ml-2">ML Models</span></div>
          <div><span className="font-mono text-2xl font-bold text-[#f9d85a]">13</span><span className="text-xs text-gray-500 ml-2">Pipeline Steps</span></div>
          <div><span className="font-mono text-2xl font-bold text-[#f9d85a]">~30s</span><span className="text-xs text-gray-500 ml-2">End to End</span></div>
          <div><span className="font-mono text-2xl font-bold text-[#f9d85a]">SSE</span><span className="text-xs text-gray-500 ml-2">Real-time Streaming</span></div>
        </motion.div>
      </div>
    </div>
  )
}

/* 5 ── Architecture Diagram ─────────────────────────────────────── */
function S5() {
  const groups = [
    { label: 'SEMANTIC', color: '#f9d85a', nodes: [
      { icon: 'S', name: 'spaCy NER' },
      { icon: 'R', name: 'RoBERTa' },
      { icon: 'G', name: 'GloVe' },
    ]},
    { label: 'VISUAL', color: '#a78bfa', nodes: [
      { icon: 'V', name: 'Gemini Vision' },
      { icon: 'O', name: 'OCR + Brand' },
      { icon: 'F', name: 'Platform Fit' },
    ]},
    { label: 'FORECAST', color: '#34d399', nodes: [
      { icon: 'T', name: 'Trends API' },
      { icon: 'R', name: 'Regions' },
      { icon: 'Q', name: 'Queries' },
    ]},
  ]
  const scoring = [
    { icon: 'QS', name: 'SEM Auction' },
    { icon: 'B', name: 'Benchmarks' },
    { icon: 'LP', name: 'Landing Page' },
    { icon: 'Re', name: 'Reddit' },
  ]
  const intel = [
    { icon: 'A', name: 'Audience' },
    { icon: 'CA', name: 'Creative Align' },
    { icon: 'LI', name: 'LinkedIn' },
    { icon: 'CI', name: 'Competitors' },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-12">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] leading-tight font-semibold text-white text-center max-w-[800px]"
      >
        A deterministic pipeline <G>streams results</G> through 13 steps in ~30 seconds
      </motion.h1>

      {/* Three parallel input pipelines */}
      <div className="flex gap-6 items-start">
        {groups.map((g, gi) => (
          <motion.div
            key={g.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + gi * 0.15 }}
            className="flex flex-col items-center gap-3 rounded-2xl p-4 ring-1 ring-white/[0.06] bg-white/[0.02] min-w-[180px]"
          >
            <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: g.color }}>{g.label}</span>
            <div className="flex gap-2">
              {g.nodes.map(n => (
                <div key={n.name} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: `${g.color}15`, border: `1px solid ${g.color}30`, color: g.color }}>{n.icon}</div>
                  <span className="text-[9px] text-gray-500 text-center w-16">{n.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Converge arrows */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-2"
      >
        <svg width="200" height="24" viewBox="0 0 200 24">
          <path d="M20 4 L100 20 L180 4" stroke="#f9d85a" strokeWidth="1" fill="none" opacity="0.3" />
          <circle cx="100" cy="20" r="3" fill="#f9d85a" opacity="0.5" />
        </svg>
      </motion.div>

      {/* Scoring + Intelligence */}
      <div className="flex gap-6 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col items-center gap-3 rounded-2xl p-4 ring-1 ring-[#22c55e]/20 bg-[#22c55e]/[0.03]"
        >
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#22c55e]">SCORING</span>
          <div className="flex gap-2">
            {scoring.map(n => (
              <div key={n.name} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e]">{n.icon}</div>
                <span className="text-[9px] text-gray-500 text-center w-16">{n.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <Arrow delay={0.8} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="flex flex-col items-center gap-3 rounded-2xl p-4 ring-1 ring-[#a78bfa]/20 bg-[#a78bfa]/[0.03]"
        >
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#a78bfa]">INTELLIGENCE</span>
          <div className="flex gap-2">
            {intel.map(n => (
              <div key={n.name} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[#a78bfa]">{n.icon}</div>
                <span className="text-[9px] text-gray-500 text-center w-16">{n.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <Arrow delay={0.9} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          className="flex flex-col items-center gap-2 rounded-2xl p-4 ring-1 ring-[#f9d85a]/30 bg-[#f9d85a]/[0.06]"
        >
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#f9d85a]">SYNTHESIS</span>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#f9d85a]/15 border border-[#f9d85a]/30">
            <span className="text-[#f9d85a] text-lg">&#x2728;</span>
          </div>
          <span className="text-[9px] text-gray-500">Gemini Flash</span>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="text-xs text-gray-500 text-center max-w-[500px]"
      >
        SSE streaming renders each result the moment it&rsquo;s computed &mdash; users see data arriving, never a loading spinner
      </motion.p>
    </div>
  )
}

/* 6 ── ML Models ────────────────────────────────────────────────── */
function S6() {
  const models = [
    { name: 'spaCy', icon: '&#x1F50D;', task: 'Entity extraction (ORG, PRODUCT, GPE)' },
    { name: 'RoBERTa', icon: '&#x1F9E0;', task: 'Sentiment scoring (pos / neu / neg)' },
    { name: 'GloVe 50d', icon: '&#x1F517;', task: 'Hashtag expansion via cosine similarity' },
    { name: 'Gemini Vision', icon: '&#x1F441;', task: 'Image/video analysis, 30+ prompts' },
    { name: 'MiniLM-L6', icon: '&#x1F465;', task: 'Audience alignment embeddings' },
    { name: 'HistGBR', icon: '&#x1F4C8;', task: 'LinkedIn engagement prediction' },
    { name: 'Gemini Flash', icon: '&#x26A1;', task: 'Executive diagnostic (narration only)' },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] leading-tight font-semibold text-white text-center max-w-[700px]"
      >
        Each step uses <G>purpose-built ML</G> &mdash; no black boxes
      </motion.h1>

      <div className="grid grid-cols-7 gap-3 w-full max-w-[900px]">
        {models.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] hover:ring-[#f9d85a]/30 transition-all"
          >
            <span className="text-3xl" dangerouslySetInnerHTML={{ __html: m.icon }} />
            <span className="font-mono text-[11px] font-bold text-[#f9d85a]">{m.name}</span>
            <span className="text-[10px] text-gray-400 text-center leading-snug">{m.task}</span>
          </motion.div>
        ))}
      </div>

      {/* Design principle callout */}
      <GlowCard gold delay={0.8} className="max-w-[600px] text-center">
        <span className="text-sm text-white font-semibold block mb-1">Deterministic before Generative</span>
        <span className="text-xs text-gray-400">Every number on the dashboard is computed by traditional ML. The LLM only writes prose &mdash; it performs zero math, zero analysis, zero scoring.</span>
      </GlowCard>
    </div>
  )
}

/* 7 ── Data Sources ─────────────────────────────────────────────── */
function S7() {
  const sources = [
    { name: 'Google Trends', stat: '90-day series', desc: 'Trailing search volume, regional interest, related & rising queries', color: '#34d399' },
    { name: 'IAB Taxonomy', stat: '1,558 segments', desc: 'Industry-standard audience classification used by DSPs/SSPs worldwide', color: '#f9d85a' },
    { name: 'Reddit API', stat: 'Live sentiment', desc: 'Community sentiment from relevant subreddits with theme extraction', color: '#f97316' },
    { name: 'Meta Ad Library', stat: 'Competitor intel', desc: 'Active ad count, longevity, format breakdown for any brand', color: '#60a5fa' },
    { name: 'Benchmarks DB', stat: '10 x 6 matrix', desc: 'CPC, CTR, CVR, CPA across 10 industries and 6 platforms', color: '#a78bfa' },
    { name: 'Published Research', stat: '10 studies', desc: 'Social Insider, Hootsuite, Buffer, Sprout Social, ConnectSafely 2026', color: '#f472b6' },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] leading-tight font-semibold text-white text-center max-w-[750px]"
      >
        Grounded in <G>6 live data sources</G> and <G>1,558 IAB taxonomy</G> segments
      </motion.h1>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[860px]">
        {sources.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="rounded-2xl p-5 bg-white/[0.03] ring-1 ring-white/[0.06] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{s.name}</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${s.color}18`, color: s.color }}>{s.stat}</span>
            </div>
            <span className="text-xs text-gray-400 leading-relaxed">{s.desc}</span>
            <div className="h-1 rounded-full mt-auto" style={{ background: `linear-gradient(to right, ${s.color}40, ${s.color}00)` }} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* 8 ── Validation ───────────────────────────────────────────────── */
function S8() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] leading-tight font-semibold text-white text-center max-w-[750px]"
      >
        Validated against <G>industry benchmarks</G> and known-good inputs
      </motion.h1>

      <div className="grid grid-cols-2 gap-5 w-full max-w-[900px]">
        <GlowCard delay={0.2} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f9d85a]/10 flex items-center justify-center text-[#f9d85a] text-sm">QS</div>
            <span className="text-sm font-bold text-white">Quality Score Formula</span>
          </div>
          <Check text="Positive copy + trending topic = QS 8-10" detail="Negative copy + dying trend = QS 2-3. Matches expected behavior." delay={0.3} />
          <Check text="Graceful degradation tested" detail="QS re-weights dynamically when vision or trends unavailable." delay={0.4} />
        </GlowCard>

        <GlowCard delay={0.3} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] text-sm">$</div>
            <span className="text-sm font-bold text-white">CPC vs. Industry Averages</span>
          </div>
          <Check text="LinkedIn CPC ~2.4x Meta baseline" detail="Matches real platform premiums from WordStream data." delay={0.4} />
          <Check text="Platform multipliers calibrated" detail="Google 1.6x, TikTok 0.7x, Snapchat 0.6x against 2025 reports." delay={0.5} />
        </GlowCard>

        <GlowCard delay={0.4} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#60a5fa]/10 flex items-center justify-center text-[#60a5fa] text-sm">LI</div>
            <span className="text-sm font-bold text-white">LinkedIn Predictor</span>
          </div>
          <Check text="Engagement rates match published data" detail="Carousel 6.6%, Video 5.6%, Text 1.2% per Social Insider 2025." delay={0.5} />
          <Check text="5,000 training posts from 10 studies" detail="Social Insider, Hootsuite, Buffer, Sprout Social, ClosleyHQ." delay={0.6} />
        </GlowCard>

        <GlowCard delay={0.5} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a78bfa]/10 flex items-center justify-center text-[#a78bfa] text-sm">&#x2713;</div>
            <span className="text-sm font-bold text-white">NLP Sanity Checks</span>
          </div>
          <Check text="Sentiment aligns with obvious inputs" detail={'"Amazing new product!" scores positive. "Terrible experience" scores negative.'} delay={0.6} />
          <Check text="NER extracts real brand names" detail="Tested against real ad copy. Falls back to noun phrases gracefully." delay={0.7} />
        </GlowCard>
      </div>
    </div>
  )
}

/* 9 ── Evolution ────────────────────────────────────────────────── */
function S9() {
  const rows = [
    { label: 'Vision', before: 'EfficientNetB0', after: 'Gemini Vision (30+ prompts)' },
    { label: 'LLM', before: 'GPT-4o-mini', after: 'Gemini Flash (deterministic-first)' },
    { label: 'Frontend', before: 'Streamlit', after: 'React + Framer Motion + D3' },
    { label: 'Streaming', before: 'Single response', after: 'SSE (13 progressive events)' },
    { label: 'Pipeline', before: '4 steps', after: '13 steps' },
    { label: 'Audience', before: 'Hardcoded', after: 'IAB Taxonomy + Sentence Transformers' },
    { label: 'LinkedIn', before: 'Not in scope', after: 'HistGBR predictor + timing heatmap' },
    { label: 'Persistence', before: 'None', after: 'IndexedDB (full session replay)' },
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] leading-tight font-semibold text-white text-center max-w-[700px]"
      >
        We expanded <G>well beyond</G> the original proposal
      </motion.h1>

      <div className="w-full max-w-[700px] flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-4 pb-2 border-b border-white/[0.08]">
          <span className="w-[140px] shrink-0 text-[10px] uppercase tracking-widest text-gray-600 text-right font-mono">Component</span>
          <span className="flex-1 text-[10px] uppercase tracking-widest text-gray-600 text-right font-mono">Original</span>
          <span className="w-5" />
          <span className="flex-1 text-[10px] uppercase tracking-widest text-[#f9d85a]/60 font-mono">What We Built</span>
        </div>
        {rows.map((r, i) => (
          <EvoRow key={r.label} {...r} delay={0.2 + i * 0.07} />
        ))}
      </div>

      <GlowCard gold delay={1} className="max-w-[500px] text-center">
        <span className="text-xs text-gray-300">The core thesis stayed the same &mdash; <span className="text-white font-semibold">pre-deployment evaluation</span>. The implementation grew from a prototype to a full platform.</span>
      </GlowCard>
    </div>
  )
}

/* 10 ── Demo ────────────────────────────────────────────────────── */
function S10() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#f9d85a]/[0.03] blur-[120px]" />

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs uppercase tracking-[0.4em] text-[#f9d85a] font-mono"
      >Live Demo</motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl font-bold text-white"
      >Let&rsquo;s see it in action</motion.h1>

      <div className="w-16 h-px bg-[#f9d85a]/30" />

      <div className="flex gap-8">
        <GlowCard delay={0.4} className="w-[260px]">
          <span className="text-[#f9d85a] font-mono text-[10px] font-bold tracking-widest block mb-3">SCENARIO 1</span>
          <span className="text-white font-bold text-lg block mb-1">Ad Evaluation</span>
          <span className="text-xs text-gray-400 leading-relaxed">Upload creative + ad copy on Meta. Full 13-step pipeline with streaming results.</span>
        </GlowCard>
        <GlowCard delay={0.5} className="w-[260px]">
          <span className="text-[#f9d85a] font-mono text-[10px] font-bold tracking-widest block mb-3">SCENARIO 2</span>
          <span className="text-white font-bold text-lg block mb-1">LinkedIn Post</span>
          <span className="text-xs text-gray-400 leading-relaxed">Quality score breakdown, engagement predictions, and timing heatmap.</span>
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

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[36px] leading-tight font-semibold text-white text-center max-w-[700px] relative"
      >
        Polaris turns <G>guesswork into data</G> &mdash; saving budget before it&rsquo;s spent
      </motion.h1>

      <div className="flex gap-10 mt-2">
        {[
          { label: 'EVALUATE', desc: '7 ML models score every dimension of an ad before deployment' },
          { label: 'PREDICT', desc: 'CPC simulation, engagement forecasts, and trend timing in real-time' },
          { label: 'ACT', desc: 'Actionable suggestions grounded in benchmarks and market intelligence' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="flex flex-col gap-2 w-[200px] text-center"
          >
            <span className="text-[#f9d85a] font-mono text-xs font-bold tracking-widest">{item.label}</span>
            <span className="text-sm text-gray-400 leading-relaxed">{item.desc}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center gap-4 mt-4"
      >
        <div className="w-12 h-px bg-white/[0.08]" />
        <span className="text-base text-gray-300 font-medium">Team 8</span>
        <div className="flex gap-6">
          {['Member 1', 'Member 2', 'Member 3', 'Member 4', 'Member 5'].map(n => (
            <span key={n} className="text-sm text-gray-500">{n}</span>
          ))}
        </div>
        <span className="text-xl text-gray-400 mt-4">Questions?</span>
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
      {/* Background grid — pointer-events-none so it doesn't block clicks */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Slide content */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={tx}
            className="absolute inset-0"
          >
            <Current />
          </motion.div>
        </AnimatePresence>

        {/* Click zones for navigation */}
        <div onClick={() => go(index - 1)} className="absolute inset-y-0 left-0 w-20 cursor-w-resize z-20" />
        <div onClick={() => go(index + 1)} className="absolute inset-y-0 right-0 w-20 cursor-e-resize z-20" />
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 h-12 flex items-center justify-between px-6 border-t border-white/[0.06] relative z-30">
        <span className="font-mono text-xs text-gray-600">
          {String(index + 1).padStart(2, '0')}<span className="text-gray-700 mx-1">/</span>{String(slides.length).padStart(2, '0')}
        </span>

        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#f9d85a]' : 'w-1.5 bg-white/15 hover:bg-white/30'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <span className="font-mono text-[10px] text-gray-700">
          &larr;&rarr; &middot; F fullscreen &middot; ESC exit
        </span>
      </div>
    </div>
  )
}
