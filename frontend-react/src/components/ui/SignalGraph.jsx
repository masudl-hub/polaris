import { useMemo } from 'react'
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
      <div className="flex items-center justify-center h-[340px] text-sm text-gray-400 dark:text-gray-500 font-mono">
        No signal nodes detected
      </div>
    )
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width="100%"
        height={CANVAS_H}
        className="overflow-visible"
        aria-label="Signal node resonance graph"
      >
        {/* Edges */}
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

        {/* Nodes */}
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
              transition={{ type: 'spring', damping: 12, stiffness: 100, delay: i * 0.07 }}
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
              transition={{ type: 'spring', damping: 12, stiffness: 160, delay: 0.1 + i * 0.07 }}
            />
            {/* Entity label */}
            <motion.text
              x={node.x}
              y={node.y + node.radius + 14}
              textAnchor="middle"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
              fill="currentColor"
              className="text-gray-600 dark:text-gray-400 font-mono"
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
                className="text-gray-900 dark:text-gray-100 font-mono"
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
        <span className="text-[10px] font-mono tracking-[0.1em] uppercase text-gray-400 dark:text-gray-500">
          Risk:
        </span>
        {[
          { color: '#10b981', label: 'Low (<0.25)' },
          { color: '#f59e0b', label: 'Mid (0.25-0.5)' },
          { color: '#ef4444', label: 'High (>0.5)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] font-mono text-gray-400 dark:text-gray-500">
          Node size = weight
        </span>
      </div>
    </div>
  )
}
