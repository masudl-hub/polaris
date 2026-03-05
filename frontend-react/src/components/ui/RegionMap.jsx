import { memo, useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { feature } from 'topojson-client'
import { geoPath, geoMercator, geoAlbersUsa } from 'd3-geo'

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const US_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const US_STATES = new Set([
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','District of Columbia',
])

function isUSState(name) {
  return US_STATES.has(name)
}

function RegionShape({ name, interest, geoFeature, isState, rank }) {
  const svgContent = useMemo(() => {
    if (!geoFeature) return null

    const SIZE = 72
    const projection = isState
      ? geoAlbersUsa().fitSize([SIZE, SIZE], geoFeature)
      : geoMercator().fitSize([SIZE, SIZE], geoFeature)

    if (!projection) {
      const fallback = geoMercator().fitSize([SIZE, SIZE], geoFeature)
      return geoPath(fallback)(geoFeature)
    }

    return geoPath(projection)(geoFeature)
  }, [geoFeature, isState])

  // Gold opacity scales with interest value
  const fillOpacity = interest != null ? 0.4 + (interest / 100) * 0.55 : 0.85

  if (!svgContent) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
        <div className="w-[56px] h-[56px] rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
          <span className="text-lg font-mono font-bold text-gray-300 dark:text-white/10">
            {name.charAt(0)}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
            {name}
          </span>
          {interest != null && (
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100 tracking-tight leading-none">
                {interest}
              </span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                interest
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: rank * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="w-[56px] h-[56px] flex items-center justify-center shrink-0">
        <svg viewBox="0 0 72 72" className="w-full h-full">
          <path
            d={svgContent}
            fill="#f9d85a"
            fillOpacity={fillOpacity}
            stroke="#f5d040"
            strokeWidth={0.5}
          />
        </svg>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
          {name}
        </span>
        {interest != null && (
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-mono font-light text-gray-900 dark:text-gray-100 tracking-tight leading-none">
              {interest}
            </span>
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              interest
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function RegionMap({ regions = [] }) {
  const [worldGeo, setWorldGeo] = useState(null)
  const [usGeo, setUsGeo] = useState(null)

  // Normalize: support both old List[str] and new List[{name, interest}]
  const normalized = useMemo(() =>
    regions.map(r => typeof r === 'string' ? { name: r, interest: null } : r),
    [regions]
  )

  const needsUS = normalized.some(r => isUSState(r.name))
  const needsWorld = normalized.some(r => !isUSState(r.name))

  useEffect(() => {
    if (needsWorld && !worldGeo) {
      fetch(WORLD_URL)
        .then(r => r.json())
        .then(topo => setWorldGeo(feature(topo, topo.objects.countries)))
        .catch(() => {})
    }
  }, [needsWorld, worldGeo])

  useEffect(() => {
    if (needsUS && !usGeo) {
      fetch(US_URL)
        .then(r => r.json())
        .then(topo => setUsGeo(feature(topo, topo.objects.states)))
        .catch(() => {})
    }
  }, [needsUS, usGeo])

  const regionFeatures = useMemo(() => {
    return normalized.map(({ name, interest }) => {
      const state = isUSState(name)
      if (state && usGeo) {
        const feat = usGeo.features.find(f => f.properties.name === name)
        return { name, interest, feature: feat || null, isState: true }
      }
      if (!state && worldGeo) {
        const lower = name.toLowerCase()
        const feat = worldGeo.features.find(f => {
          const n = (f.properties.name || '').toLowerCase()
          return n === lower || n.includes(lower) || lower.includes(n)
        })
        return { name, interest, feature: feat || null, isState: false }
      }
      return { name, interest, feature: null, isState: state }
    })
  }, [normalized, worldGeo, usGeo])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {regionFeatures.map(({ name, interest, feature: feat, isState: state }, i) => (
        <RegionShape key={name} name={name} interest={interest} geoFeature={feat} isState={state} rank={i} />
      ))}
    </div>
  )
}

export default memo(RegionMap)
