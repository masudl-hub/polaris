# PHASE 7 PLAN: Frontend Signal Node Visualization

## Overview

Phase 7 builds the `ResonanceSection` — a new React component that visualizes the `ResonanceGraph` emitted by Phase 5's `resonance_graph` SSE event. It follows every established frontend pattern exactly: `framer-motion` animations, `CardInsight` flip-reveal explanations, the existing `Card`/`Badge`/`ScoreRing`/`SectionHeader` UI library, and Tailwind utility classes.

**No new npm packages.** The node-graph is rendered as hand-coded SVG using `<circle>`, `<line>`, and `<text>` elements with a simple radial layout computed in pure JavaScript on mount — the same technique already used by `ScoreRing.jsx`.

---

## Scope

### Files created (3):
- `frontend-react/src/components/results/ResonanceSection.jsx` — main section component
- `frontend-react/src/components/ui/SignalGraph.jsx` — standalone SVG graph renderer
- `frontend-react/src/components/results/__tests__/ResonanceSection.test.jsx` — 12 tests

### Files modified (2):
- `frontend-react/src/hooks/useAnalysis.js` — add `resonanceGraph` to `INITIAL_STORE` + handle `resonance_graph` SSE event
- `frontend-react/src/components/Results.jsx` — import + render `<ResonanceSection>`

---

## SSE Integration: `useAnalysis.js`

### `INITIAL_STORE` addition

```javascript
const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  sentiment: null,
  trends: null,
  sem: null,
  landing: null,
  reddit: null,
  benchmark: null,
  alignment: null,
  audience: null,
  linkedin: null,
  competitor: null,
  diagnostic: '',
  resonanceGraph: null,   // ← Phase 7: ResonanceGraph from Phase 5
}
```

### New SSE event handler (one new `else if` block, inserted after `competitor_data`):

```javascript
} else if (evt.type === 'resonance_graph') {
  setStore(prev => {
    const n = { ...prev, resonanceGraph: evt.data }
    storeRef.current = n
    return n
  })
}
```

This follows the identical pattern used for every other data event in the file (12 existing handlers). No other changes to `useAnalysis.js`.

---

## `Results.jsx` Update

### Import

```jsx
import ResonanceSection from './results/ResonanceSection'
```

### Render position

`ResonanceSection` renders **after `TrendsSection`** and **before `LanguageSection`**, matching the backend's pipeline order (Resonance Graph is Step 16, after trends/SEM/entity steps):

```jsx
<TrendsSection trends={store.trends} alignment={store.alignment} />
<ResonanceSection resonanceGraph={store.resonanceGraph} />  {/* ← Phase 7 */}
<LanguageSection text={store.text} />
```

The component self-hides when `resonanceGraph` is `null`, so it produces no visible output during text-only runs or before the Phase 5/6 backend is deployed.

---

## Component: `ResonanceSection.jsx`

### Full structure

```jsx
import { motion } from 'framer-motion'
import { Network } from 'lucide-react'
import { fadeUp, staggerContainer } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import EmptyState from '../ui/EmptyState'
import ScoreRing from '../ui/ScoreRing'
import CardInsight from '../ui/CardInsight'
import SignalGraph from '../ui/SignalGraph'

function tierVariant(tier) {
  if (tier === 'high') return 'success'
  if (tier === 'moderate') return 'warning'
  return 'danger'
}

function tierLabel(tier) {
  if (tier === 'high') return 'HIGH RESONANCE'
  if (tier === 'moderate') return 'MODERATE RESONANCE'
  return 'LOW RESONANCE'
}

export default function ResonanceSection({ resonanceGraph }) {
  if (!resonanceGraph) return null   // ← renders nothing until data arrives

  const {
    nodes = [],
    edges = [],
    composite_resonance_score = 0,
    dominant_signals = [],
    resonance_tier = 'low',
    node_count = 0,
    edge_count = 0,
  } = resonanceGraph

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="Resonance Graph" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Signal Graph SVG — spans 2 columns */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <CardInsight
            meaning="A semantic signal graph mapping all named entities extracted from your ad. Each node represents one entity; its size reflects composite momentum, its colour reflects cultural risk (green = safe, amber = moderate risk, red = high risk)."
            significance="Densely-connected clusters signal a coherent brand vocabulary — the algorithm has found strong semantic links between your entities. Isolated nodes are vocabulary dead-ends that add noise without reinforcing your core message."
            calculation="Node weight = momentum × (1 − cultural_risk) × sentiment × platform_affinity. Edge similarity uses GloVe Twitter 50d cosine distance (threshold ≥ 0.30). Resonance tier: HIGH ≥ 0.60, MODERATE ≥ 0.35, LOW < 0.35."
          >
            <Card padding="none" animate={false} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Signal Node Graph" variant="mono" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    {node_count} nodes · {edge_count} edges
                  </span>
                  <Badge variant={tierVariant(resonance_tier)}>
                    {tierLabel(resonance_tier)}
                  </Badge>
                </div>
              </div>
              <SignalGraph nodes={nodes} edges={edges} />
            </Card>
          </CardInsight>
        </motion.div>

        {/* RIGHT: Composite Score + Dominant Signals */}
        <motion.div variants={fadeUp} className="flex flex-col gap-6">

          {/* Composite Score Ring */}
          <CardInsight
            meaning="The composite resonance score (0–1) is the mean of all signal node weights. It summarises how well your ad's entity vocabulary aligns across momentum, cultural safety, sentiment, and platform fit simultaneously."
            significance="A score above 0.60 means your entities are trending, culturally safe, and well-fitted to the platform. Below 0.35 flags weak momentum, elevated cultural risk, or poor platform fit across your vocabulary."
            calculation="composite = mean(node weights). Each node weight is clamped to [0.01, 1.00] before averaging. If no entities were detected, composite = 0.0."
          >
            <Card variant="dark" padding="none" animate={false} className="p-8 flex flex-col items-center gap-4 min-h-[180px] justify-center">
              <ScoreRing score={composite_resonance_score} size={96} strokeWidth={6} />
              <div className="text-center">
                <p className="text-2xl font-light font-mono text-white">
                  {(composite_resonance_score * 100).toFixed(0)}
                  <span className="text-sm text-white/40 ml-1">/ 100</span>
                </p>
                <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-white/40 mt-1">
                  Composite Resonance
                </p>
              </div>
            </Card>
          </CardInsight>

          {/* Dominant Signals */}
          {dominant_signals.length > 0 && (
            <Card padding="spacious" animate={false}>
              <SectionHeader title="Dominant Signals" variant="mono" className="mb-4" />
              <div className="space-y-3">
                {dominant_signals.map((entity, i) => {
                  const node = nodes.find(n => n.entity === entity)
                  const weight = node?.weight ?? 0
                  return (
                    <div key={entity} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 w-4">
                        #{i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {entity}
                          </span>
                          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                            {(weight * 100).toFixed(0)}
                          </span>
                        </div>
                        <div className="w-full rounded-full h-1.5 bg-gray-100 dark:bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[#f9d85a]"
                            initial={{ width: 0 }}
                            animate={{ width: `${weight * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

        </motion.div>
      </div>
    </motion.div>
  )
}
```

---

## Component: `SignalGraph.jsx`

### Layout algorithm

A **single-pass radial layout** computed once on mount via `useMemo`. No animation loop, no physics engine:

1. Place all nodes in a circle of radius `R = min(width, height) / 2 - padding`
2. Angle for node `i` = `(2π × i) / N`
3. If `node.weight > 0.7` (high-weight nodes): pull toward centre, radius multiplied by `(1 - node.weight * 0.4)` so heavy nodes cluster inward
4. Position is deterministic — same input always produces the same layout

```jsx
import { useMemo, useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const CANVAS_W = 520
const CANVAS_H = 340
const PADDING = 48
const MIN_NODE_R = 8
const MAX_NODE_R = 26

function riskColor(risk) {
  if (risk >= 0.5) return '#ef4444'   // red-500
  if (risk >= 0.25) return '#f59e0b'  // amber-500
  return '#10b981'                     // emerald-500
}

function computeLayout(nodes, width, height) {
  if (!nodes.length) return []
  const cx = width / 2
  const cy = height / 2
  const baseR = Math.min(width, height) / 2 - PADDING
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
    const pull = node.weight > 0.7 ? 1 - node.weight * 0.4 : 1
    const r = baseR * pull
    return {
      ...node,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      radius: MIN_NODE_R + (node.weight * (MAX_NODE_R - MIN_NODE_R)),
    }
  })
}

export default function SignalGraph({ nodes = [], edges = [] }) {
  const layout = useMemo(
    () => computeLayout(nodes, CANVAS_W, CANVAS_H),
    [nodes]
  )

  const nodeMap = useMemo(() => {
    const m = {}
    layout.forEach(n => { m[n.entity] = n })
    return m
  }, [layout])

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-[340px] text-sm text-gray-400 dark:text-gray-500">
        No signal nodes detected
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      height={CANVAS_H}
      className="overflow-visible"
      aria-label="Signal node resonance graph"
    >
      {/* ── Edges ── */}
      {edges.map((edge, i) => {
        const src = nodeMap[edge.source]
        const tgt = nodeMap[edge.target]
        if (!src || !tgt) return null
        return (
          <motion.line
            key={`edge-${i}`}
            x1={src.x} y1={src.y}
            x2={tgt.x} y2={tgt.y}
            stroke="#9ca3af"
            strokeWidth={1 + edge.similarity}
            strokeOpacity={0.15 + edge.similarity * 0.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
          />
        )
      })}

      {/* ── Nodes ── */}
      {layout.map((node, i) => (
        <g key={node.entity}>
          {/* Glow ring (cultural risk indicator) */}
          <motion.circle
            cx={node.x} cy={node.y}
            r={node.radius + 4}
            fill="none"
            stroke={riskColor(node.cultural_risk)}
            strokeWidth={1.5}
            strokeOpacity={0.3 + node.cultural_risk * 0.5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 100, delay: i * 0.07 }}
          />
          {/* Main node circle */}
          <motion.circle
            cx={node.x} cy={node.y}
            r={node.radius}
            fill={riskColor(node.cultural_risk)}
            fillOpacity={0.15 + node.weight * 0.55}
            stroke={riskColor(node.cultural_risk)}
            strokeWidth={1.5}
            strokeOpacity={0.6}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 160, delay: 0.1 + i * 0.07 }}
          />
          {/* Entity label */}
          <motion.text
            x={node.x}
            y={node.y + node.radius + 14}
            textAnchor="middle"
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill="currentColor"
            className="text-gray-600 dark:text-gray-400"
            fillOpacity={0.75}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 + i * 0.07 }}
          >
            {node.entity.length > 12 ? node.entity.slice(0, 11) + '…' : node.entity}
          </motion.text>
          {/* Weight percentage inside node */}
          {node.radius >= 14 && (
            <motion.text
              x={node.x} y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              fill="currentColor"
              fillOpacity={0.6}
              className="text-gray-700 dark:text-gray-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.07 }}
            >
              {Math.round(node.weight * 100)}
            </motion.text>
          )}
        </g>
      ))}
    </svg>
  )
}
```

### Visual encoding summary

| Datum | Visual encoding |
|-------|----------------|
| `node.weight` | Circle radius (8px–26px) + fill opacity |
| `node.cultural_risk` | Fill + stroke colour: emerald (safe) → amber (moderate) → red (high) |
| `node.weight > 0.7` | Pulled toward centre (radial pull factor) |
| `edge.similarity` | Line opacity (0.15–0.65) + stroke width (1–2px) |
| `entity` name | Monospace label below node, truncated at 12 chars |
| `node.weight >= ~0.6` | Two-digit weight percentage rendered inside circle |

---

## Legend Row

A static legend sits below the `SignalGraph` inside the card, implemented as inline flex badges — no library needed:

```jsx
{/* Legend — inside Card, below SignalGraph */}
<div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
  <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-gray-400 dark:text-gray-500">
    Cultural Risk:
  </span>
  {[
    { color: '#10b981', label: 'Safe (< 0.25)' },
    { color: '#f59e0b', label: 'Moderate (0.25–0.50)' },
    { color: '#ef4444', label: 'High (> 0.50)' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  ))}
  <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
    Node size = signal weight
  </span>
</div>
```

---

## Empty / Fallback States

| Condition | Rendered output |
|-----------|----------------|
| `resonanceGraph === null` | `return null` — section is fully invisible |
| `nodes.length === 0` | `"No signal nodes detected"` in centered div inside graph area |
| `dominant_signals.length === 0` | Dominant signals card is omitted (conditional render) |
| `edges.length === 0` | No lines drawn; graph still renders all nodes (isolated nodes are valid) |

---

## Responsive Behaviour

Uses the existing grid pattern from `TrendsSection` / `MarketSection`:
- Mobile (`< lg`): single column, graph full-width, score ring + dominant signals below
- Desktop (`lg+`): graph spans 2/3 columns, stats panel in the final 1/3
- `SignalGraph` uses `width="100%"` on the SVG — it scales with its container via the `viewBox` attribute

---

## Tests: `ResonanceSection.test.jsx`

**12 new tests** using `@testing-library/react` (already installed as a dev dependency):

```
test_renders_null_when_no_resonance_graph
  → Render <ResonanceSection resonanceGraph={null} />
    → container is empty (no DOM output)

test_renders_section_header_when_data_present
  → Render with valid resonanceGraph → "Resonance Graph" heading present in DOM

test_renders_tier_badge_high
  → resonance_tier="high" → Badge text contains "HIGH RESONANCE"

test_renders_tier_badge_moderate
  → resonance_tier="moderate" → Badge text contains "MODERATE RESONANCE"

test_renders_tier_badge_low
  → resonance_tier="low" → Badge text contains "LOW RESONANCE"

test_renders_node_count_and_edge_count
  → node_count=5, edge_count=3 → "5 nodes · 3 edges" text present

test_renders_composite_score
  → composite_resonance_score=0.43 → "43" present in DOM (rounded %)

test_renders_dominant_signals
  → dominant_signals=["Nike","running","performance"]
    → All three entity names present in DOM

test_signal_graph_renders_svg
  → <SignalGraph nodes={[...]} edges={[]} /> renders an <svg> element

test_signal_graph_renders_empty_message_when_no_nodes
  → <SignalGraph nodes={[]} edges={[]} /> renders "No signal nodes detected"

test_signal_graph_node_circle_count
  → <SignalGraph nodes={[nodeA, nodeB, nodeC]} /> renders at least 3 <circle> elements
    (each node has 2 circles — glow ring + main — so >= 6 total)

test_score_ring_receives_correct_prop
  → composite_resonance_score=0.71 → ScoreRing rendered with score=0.71
    (verified via aria or data- attribute)
```

**Total new tests: 12**
**Running total after Phase 7: 326 + 12 = 338 tests**

---

## Test Setup Note

The existing vitest + `@testing-library/react` setup in the frontend already handles SVG rendering (jsdom supports SVG elements). `framer-motion` components render synchronously in the test environment. No additional config is required.

The tests use the existing vitest test runner (already configured with `"test": "vitest run"` in `package.json`) and `@testing-library/react` + `@testing-library/jest-dom` (both already installed as dev dependencies).

---

## Files Changed

| File | Change |
|------|--------|
| `frontend-react/src/hooks/useAnalysis.js` | Add `resonanceGraph: null` to `INITIAL_STORE`; add `resonance_graph` SSE event handler |
| `frontend-react/src/components/Results.jsx` | Import + render `<ResonanceSection resonanceGraph={store.resonanceGraph} />` |
| `frontend-react/src/components/results/ResonanceSection.jsx` | **New file** — main section component |
| `frontend-react/src/components/ui/SignalGraph.jsx` | **New file** — SVG graph renderer |
| `frontend-react/src/components/results/__tests__/ResonanceSection.test.jsx` | **New file** — 12 tests |

---

## Test Count Summary

| Location | New Tests |
|----------|-----------|
| `ResonanceSection.test.jsx` (new file) | 12 |
| **Total new** | **12** |
| Previous total (end of Phase 6) | 326 |
| **Running total after Phase 7** | **338** |

---

## Complete Phase Summary

| Phase | Feature | New Tests | Running Total |
|-------|---------|-----------|---------------|
| 0 | Baseline (existing) | 143 | 143 |
| 1 | Native Gemini video upload + MediaDecomposition | +39 | 182 |
| 2 | Audio intelligence (ffmpeg + AudD + pytrends) | +32 | 214 |
| 3 | Per-entity trend atomization | +32 | 246 |
| 4 | Perplexity Sonar cultural context | +36 | 282 |
| 5 | Resonance Graph Assembly | +28 | 310 |
| 6 | Upgraded Executive Diagnostic | +16 | 326 |
| **7** | **Frontend Signal Node Visualization** | **+12** | **338** |

---

## Implementation Order for Phase 7

1. `useAnalysis.js` — 2-line change (fastest, required for data flow)
2. `SignalGraph.jsx` — standalone SVG component, no external deps
3. `ResonanceSection.jsx` — composes existing UI library + `SignalGraph`
4. `Results.jsx` — 2-line change (import + render)
5. `ResonanceSection.test.jsx` — tests against completed components
