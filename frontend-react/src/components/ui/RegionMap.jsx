import { memo, useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { feature } from 'topojson-client'
import { geoPath, geoMercator, geoAlbersUsa } from 'd3-geo'

// 50m atlas includes ~241 countries + territories (vs 177 in 110m)
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
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

/**
 * Google Trends returns full region names, but the world-atlas TopoJSON uses
 * Natural Earth abbreviated names. This map resolves the mismatch.
 * Keys are lowercased Google Trends names → values are atlas names.
 */
const NAME_ALIASES = {
  // Abbreviation expansions (atlas uses short forms)
  'cayman islands': 'Cayman Is.',
  'british virgin islands': 'British Virgin Is.',
  'u.s. virgin islands': 'U.S. Virgin Is.',
  'us virgin islands': 'U.S. Virgin Is.',
  'northern mariana islands': 'N. Mariana Is.',
  'marshall islands': 'Marshall Is.',
  'solomon islands': 'Solomon Is.',
  'falkland islands': 'Falkland Is.',
  'cook islands': 'Cook Is.',
  'turks and caicos islands': 'Turks and Caicos Is.',
  'french polynesia': 'Fr. Polynesia',
  'french southern territories': 'Fr. S. Antarctic Lands',
  'western sahara': 'W. Sahara',
  'central african republic': 'Central African Rep.',
  'dominican republic': 'Dominican Rep.',
  'czech republic': 'Czechia',
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'republic of the congo': 'Congo',
  'equatorial guinea': 'Eq. Guinea',
  'south sudan': 'S. Sudan',
  'north korea': 'North Korea',
  'south korea': 'South Korea',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'north macedonia': 'North Macedonia',
  'saint helena': 'St. Helena',
  'st. helena': 'St. Helena',
  'saint kitts and nevis': 'St. Kitts and Nevis',
  'saint lucia': 'St. Lucia',
  'saint vincent and the grenadines': 'St. Vin. and Gren.',
  'saint pierre and miquelon': 'St-Pierre-et-Miquelon',
  'são tomé and príncipe': 'São Tomé and Principe',
  'sint maarten': 'Sint Maarten',
  'antigua and barbuda': 'Antigua and Barb.',
  'trinidad and tobago': 'Trinidad and Tobago',
  'bosnia & herzegovina': 'Bosnia and Herz.',
  'united states': 'United States of America',
  'usa': 'United States of America',
  'united kingdom': 'United Kingdom',
  'uk': 'United Kingdom',
  'macau': 'Macao',
  'myanmar': 'Myanmar',
  'burma': 'Myanmar',
  'ivory coast': "Côte d'Ivoire",
  'cote d\'ivoire': "Côte d'Ivoire",
  'east timor': 'Timor-Leste',
  'timor-leste': 'Timor-Leste',
  'eswatini': 'eSwatini',
  'swaziland': 'eSwatini',
}

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
        // Check alias map first (Google Trends name → atlas name)
        const aliasTarget = NAME_ALIASES[lower]
        const feat = worldGeo.features.find(f => {
          const n = (f.properties.name || '')
          const nLower = n.toLowerCase()
          // Exact match (case-insensitive)
          if (nLower === lower) return true
          // Alias match (resolved name)
          if (aliasTarget && n === aliasTarget) return true
          // Substring match (either direction) as fallback
          if (nLower.length > 3 && lower.length > 3) {
            if (nLower.includes(lower) || lower.includes(nLower)) return true
          }
          return false
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
