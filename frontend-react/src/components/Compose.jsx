import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImagePlus, X, Link, Swords, Sparkles, Loader2,
  ShoppingCart, Landmark, HeartPulse, Scale, Home,
  Cpu, GraduationCap, Car, Plane, Building2,
  Users, Briefcase, Crown, BadgeDollarSign, Dumbbell,
  Monitor, BookOpen, Store, Utensils, Gamepad2, Leaf, Trophy,
  ChevronRight, RefreshCcw, Youtube, Volume2, VolumeX
} from 'lucide-react'
import { feature } from 'topojson-client'
import { geoPath, geoMercator } from 'd3-geo'

/* ── Platform SVG paths (Simple Icons, CC0) ────────────────────────── */
const PLATFORM_SVG = {
  Meta: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z',
  Google: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  TikTok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  X: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  LinkedIn: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  Snapchat: 'M12.166.053C12.86.053 16.26.396 17.854 4.09c.673 1.567.43 4.235.262 5.604l-.009.058a.636.636 0 00.355.676c.407.196.862.302 1.29.38.164.03.527.093.603.325.082.252-.149.501-.307.632-.35.289-.72.464-1.078.63-.26.12-.506.234-.71.38-.327.234-.504.574-.178 1.093.973 1.549 2.327 2.673 4.178 3.004.152.027.39.09.395.267.011.363-.71.744-1.127.891-.565.2-1.165.26-1.754.402-.321.078-.65.17-.953.326-.372.192-.468.534-.807.86-.404.389-1.018.864-2.07.864-.893 0-1.591-.368-2.35-.755-.795-.403-1.613-.664-2.576-.664-.992 0-1.785.285-2.573.664-.757.364-1.437.755-2.35.755-1.118 0-1.709-.521-2.114-.889-.32-.29-.434-.644-.785-.835a5.51 5.51 0 00-.952-.325c-.59-.143-1.19-.203-1.755-.403-.417-.147-1.138-.528-1.127-.891.005-.176.243-.24.395-.267 1.85-.33 3.205-1.455 4.178-3.004.327-.52.15-.86-.178-1.094-.205-.146-.45-.259-.71-.38-.358-.165-.728-.34-1.078-.629-.158-.131-.389-.38-.307-.632.076-.232.44-.296.603-.325.428-.078.883-.184 1.29-.38a.636.636 0 00.355-.676l-.01-.058c-.166-1.37-.41-4.037.263-5.604C7.876.396 11.277.053 11.97.053h.196z',
}

function PlatformIcon({ platform, size = 20, className = '' }) {
  const path = PLATFORM_SVG[platform]
  if (!path) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      <path d={path} fill="currentColor" />
    </svg>
  )
}

/* ── Platform placements ───────────────────────────────────────────── */
const PLATFORMS = ['Meta', 'Google', 'TikTok', 'X', 'LinkedIn', 'Snapchat']
const PLATFORM_PLACEMENTS = {
  Meta: ['Feed', 'Stories', 'Reels', 'Right Column', 'Marketplace'],
  Google: ['Search', 'Display', 'YouTube Pre-roll', 'Discovery', 'Shopping'],
  TikTok: ['In-Feed', 'TopView', 'Branded Effect', 'Spark Ads'],
  X: ['Timeline', 'Explore', 'Amplify Pre-roll'],
  LinkedIn: ['Feed', 'Sponsored Message', 'Dynamic', 'Video'],
  Snapchat: ['Full Screen', 'Story', 'Spotlight', 'Collection'],
}

/* ── Audience tags (IAB Taxonomy-grounded) ─────────────────────────── */
const AUDIENCE_TAGS = [
  { key: 'Gen-Z (18-24)', label: 'Gen-Z', Icon: Users },
  { key: 'Millennials (25-39)', label: 'Millennials', Icon: Users },
  { key: 'Parents', label: 'Parents', Icon: Users },
  { key: 'Professionals', label: 'Professionals', Icon: Briefcase },
  { key: 'Luxury Buyers', label: 'Luxury', Icon: Crown },
  { key: 'Budget Shoppers', label: 'Budget', Icon: BadgeDollarSign },
  { key: 'Health & Fitness', label: 'Health', Icon: Dumbbell },
  { key: 'Tech Enthusiasts', label: 'Tech', Icon: Monitor },
  { key: 'Homeowners', label: 'Homeowners', Icon: Home },
  { key: 'Students', label: 'Students', Icon: BookOpen },
  { key: 'Small Business Owners', label: 'SMB', Icon: Store },
  { key: 'Foodies', label: 'Foodies', Icon: Utensils },
  { key: 'Gamers', label: 'Gamers', Icon: Gamepad2 },
  { key: 'Eco-Conscious', label: 'Eco', Icon: Leaf },
  { key: 'Sports Fans', label: 'Sports', Icon: Trophy },
]

/* ── Industries with icons ─────────────────────────────────────────── */
const INDUSTRIES = [
  { key: 'e-commerce', label: 'E-Commerce', Icon: ShoppingCart },
  { key: 'finance', label: 'Finance', Icon: Landmark },
  { key: 'healthcare', label: 'Healthcare', Icon: HeartPulse },
  { key: 'legal', label: 'Legal', Icon: Scale },
  { key: 'real-estate', label: 'Real Estate', Icon: Home },
  { key: 'technology', label: 'Technology', Icon: Cpu },
  { key: 'education', label: 'Education', Icon: GraduationCap },
  { key: 'automotive', label: 'Automotive', Icon: Car },
  { key: 'travel', label: 'Travel', Icon: Plane },
  { key: 'b2b', label: 'B2B', Icon: Building2 },
]

/* ── Geo targets ───────────────────────────────────────────────────── */
const GEO_TARGETS = [
  { code: 'US', name: 'United States of America', label: 'United States' },
  { code: 'GB', name: 'United Kingdom', label: 'United Kingdom' },
  { code: 'CA', name: 'Canada', label: 'Canada' },
  { code: 'DE', name: 'Germany', label: 'Germany' },
  { code: 'FR', name: 'France', label: 'France' },
  { code: 'AU', name: 'Australia', label: 'Australia' },
  { code: 'JP', name: 'Japan', label: 'Japan' },
  { code: 'BR', name: 'Brazil', label: 'Brazil' },
  { code: 'IN', name: 'India', label: 'India' },
  { code: 'KR', name: 'South Korea', label: 'South Korea' },
]
const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

function GeoShape({ name, size = 40 }) {
  const [worldGeo, setWorldGeo] = useState(null)

  useEffect(() => {
    // Use a module-level cache
    if (GeoShape._cache) {
      setWorldGeo(GeoShape._cache)
      return
    }
    fetch(WORLD_URL)
      .then(r => r.json())
      .then(topo => {
        const geo = feature(topo, topo.objects.countries)
        GeoShape._cache = geo
        setWorldGeo(geo)
      })
      .catch(() => {})
  }, [])

  const pathD = useMemo(() => {
    if (!worldGeo) return null
    const lower = name.toLowerCase()
    const feat = worldGeo.features.find(f => {
      const n = (f.properties.name || '').toLowerCase()
      return n === lower || n.includes(lower) || lower.includes(n)
    })
    if (!feat) return null

    // For countries with distant overseas territories, clip to continental bounds
    // so the main landmass fills the shape nicely
    let geoToRender = feat
    if (feat.geometry.type === 'MultiPolygon') {
      const isUSA = lower.includes('united states')
      const isFrance = lower === 'france'

      if (isUSA || isFrance) {
        // Bounding boxes for continental regions [minLon, maxLon, minLat, maxLat]
        const bounds = isUSA
          ? [-130, -65, 24, 50]   // contiguous US
          : [-6, 10, 41, 52]      // metropolitan France
        const filtered = feat.geometry.coordinates.filter(polygon => {
          // Check if any point of the polygon falls within the continental bounds
          const coords = polygon[0] // outer ring
          return coords.some(([lon, lat]) =>
            lon >= bounds[0] && lon <= bounds[1] && lat >= bounds[2] && lat <= bounds[3]
          )
        })
        if (filtered.length > 0) {
          geoToRender = {
            ...feat,
            geometry: { ...feat.geometry, coordinates: filtered },
          }
        }
      }
    }

    const projection = geoMercator().fitSize([size, size], geoToRender)
    return geoPath(projection)(geoToRender)
  }, [worldGeo, name, size])

  if (!pathD) {
    return (
      <div
        className="rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] font-mono font-bold text-gray-300 dark:text-white/10">
          {name.charAt(0)}
        </span>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <path d={pathD} fill="currentColor" fillOpacity={0.7} stroke="currentColor" strokeOpacity={0.3} strokeWidth={0.3} />
    </svg>
  )
}
GeoShape._cache = null

/* ── Motion ────────────────────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const chipVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 25 } },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
}

/* ── Shared card wrapper ───────────────────────────────────────────── */
const CARD = 'bg-white dark:bg-[#1e1e21] rounded-[1.25rem] border border-gray-200/60 dark:border-white/[0.10]'
const CARD_DARK = 'bg-[#1a1a1c] rounded-[1.25rem] text-white'

/* ── Label component ───────────────────────────────────────────────── */
function Label({ children }) {
  return (
    <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-3">
      {children}
    </div>
  )
}

/* ── Variant Suggestion component ───────────────────────────────────── */
function VariantSelector({ variants, onSelect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl animate-pulse">
        <Loader2 size={20} className="animate-spin text-[#f9d85a]" />
        <span className="text-[13px] font-medium text-gray-500">Generating AI variants...</span>
      </div>
    )
  }
  if (!variants || variants.length === 0) return null

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2 px-1">
        <Sparkles size={14} className="text-[#f9d85a]" />
        <span className="text-[12px] font-bold uppercase tracking-wider text-gray-400">AI Improvements</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {variants.map((v, i) => (
          <button
            key={i}
            onClick={() => onSelect(v)}
            className="text-left p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#252527] hover:border-[#f9d85a] transition-all group flex flex-col gap-2 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-900 dark:text-white group-hover:text-[#f9d85a] transition-colors">
                {v.headline}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 italic">
              {v.rationale}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Compose({ loading, onSubmit, analysis, demoData }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isVideo, setIsVideo] = useState(false)
  const [muted, setMuted] = useState(true)
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('')
  const [hashtags, setHashtags] = useState([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [platform, setPlatform] = useState('Meta')
  const [placements, setPlacements] = useState([])
  const [industry, setIndustry] = useState('')
  const [geo, setGeo] = useState('US')
  const [landingUrl, setLandingUrl] = useState('')
  const [competitor, setCompetitor] = useState('')
  const [cpc, setCpc] = useState(1.50)
  const [budget, setBudget] = useState(100)
  // LinkedIn-specific
  const [postType, setPostType] = useState('text')
  const [followerCount, setFollowerCount] = useState(5000)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()
  const videoRef = useRef()
  // YouTube download state
  const [ytUrl, setYtUrl] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytProgress, setYtProgress] = useState(0)
  const [ytMsg, setYtMsg] = useState('')
  const [ytError, setYtError] = useState('')

  // Populate from demo shortcut
  useEffect(() => {
    if (demoData) {
      if (demoData.headline !== undefined) setHeadline(demoData.headline)
      if (demoData.body !== undefined) setBody(demoData.body)
      if (demoData.platform) setPlatform(demoData.platform)
      if (demoData.industry) setIndustry(demoData.industry)
      if (demoData.postType) setPostType(demoData.postType)
      if (demoData.followerCount) setFollowerCount(demoData.followerCount)
      // Populate all optional fields for richer analysis
      if (demoData.audience) setAudience(demoData.audience)
      if (demoData.hashtags) setHashtags(demoData.hashtags.map(h => h.replace(/^#/, '')))
      if (demoData.placements) setPlacements(demoData.placements)
      if (demoData.geo) setGeo(demoData.geo)
      if (demoData.landingUrl !== undefined) setLandingUrl(demoData.landingUrl)
      if (demoData.competitor !== undefined) setCompetitor(demoData.competitor)
      if (demoData.cpc != null) setCpc(demoData.cpc)
      if (demoData.budget != null) setBudget(demoData.budget)
      
      if (demoData.localAsset) {
        setYtUrl('')
        fetch(demoData.localAsset)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.blob()
          })
          .then(blob => {
            const filename = demoData.localAsset.split('/').pop()
            const videoFile = new File([blob], filename, { type: 'video/mp4' })
            setFile(videoFile)
            setPreview(URL.createObjectURL(blob))
            setIsVideo(true)
          })
          .catch(err => {
            console.warn('Local asset failed, falling back to URL:', err)
            // Fall back to YouTube URL if local asset unavailable
            if (demoData.url) {
              setYtUrl(demoData.url)
              setFile(null)
              setPreview(null)
              setIsVideo(false)
            }
          })
      } else if (demoData.url) {
        // No local asset — use YouTube URL directly
        setYtUrl(demoData.url)
        setFile(null)
        setPreview(null)
        setIsVideo(false)
      } else {
        setYtUrl('')
        setFile(null)
        setPreview(null)
        setIsVideo(false)
      }
    }
  }, [demoData])

  // Restore all form fields when a session is loaded
  useEffect(() => {
    const inp = analysis?.inputs
    if (!inp) return
    if (inp.headline != null) setHeadline(inp.headline)
    if (inp.body != null) setBody(inp.body)
    if (inp.audience != null) setAudience(inp.audience)
    if (inp.hashtags?.length) setHashtags(inp.hashtags)
    if (inp.platform) setPlatform(inp.platform)
    if (inp.placements?.length) setPlacements(inp.placements)
    if (inp.geo) setGeo(inp.geo)
    if (inp.industry) setIndustry(inp.industry)
    if (inp.landingUrl != null) setLandingUrl(inp.landingUrl)
    if (inp.competitor != null) setCompetitor(inp.competitor)
    if (inp.cpc != null) setCpc(inp.cpc)
    if (inp.budget != null) setBudget(inp.budget)
    if (inp.postType) setPostType(inp.postType)
    if (inp.followerCount != null) setFollowerCount(inp.followerCount)
    // Restore thumbnail preview (actual File can't be serialized, so we skip re-analysis)
    if (inp.thumbnail) {
      setPreview(inp.thumbnail)
      setIsVideo(false)
    } else if (inp.fileName && inp.fileType?.startsWith('video/')) {
      setIsVideo(true)
      setMuted(true)
    }
  }, [analysis?.inputs])

  const handleFile = useCallback((f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    const isVid = f.type.startsWith('video/')
    setIsVideo(isVid)
    if (isVid) setMuted(true)
  }, [])

  const clearFile = useCallback((e) => {
    e.stopPropagation()
    setFile(null)
    setPreview(null)
    setIsVideo(false)
    setMuted(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleYouTube = useCallback(async (url) => {
    if (!url.trim()) return
    setYtLoading(true)
    setYtProgress(0)
    setYtMsg('Starting download…')
    setYtError('')

    try {
      const resp = await fetch('/api/v1/fetch_youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || 'Download request failed')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fileId = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // last incomplete line back to buffer
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'progress') {
              setYtProgress(evt.pct)
              setYtMsg(evt.msg || `Downloading… ${evt.pct}%`)
            } else if (evt.type === 'done') {
              fileId = evt.file_id
              setYtProgress(100)
              setYtMsg(`Processing ${evt.filename} (${evt.size_mb} MB)…`)
            } else if (evt.type === 'error') {
              throw new Error(evt.msg)
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }

      if (!fileId) throw new Error('Download finished but no file ID received')

      // Retrieve the downloaded video blob
      setYtMsg('Fetching video…')
      const fileResp = await fetch(`/api/v1/fetch_youtube/${fileId}`)
      if (!fileResp.ok) throw new Error('Could not retrieve downloaded file')

      const blob = await fileResp.blob()
      const filename = fileResp.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'youtube.mp4'
      const videoFile = new File([blob], filename, { type: 'video/mp4' })

      handleFile(videoFile)
      setYtUrl('')
      setYtMsg('')
    } catch (err) {
      setYtError(err.message || 'Download failed')
    } finally {
      setYtLoading(false)
      setYtProgress(0)
    }
  }, [handleFile])

  const addHashtag = useCallback((tag) => {
    const clean = tag.replace(/[#,\s]/g, '').trim()
    if (clean && !hashtags.includes(clean)) setHashtags(prev => [...prev, clean])
  }, [hashtags])

  const handleHashtagKey = useCallback((e) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault()
      addHashtag(hashtagInput)
      setHashtagInput('')
    }
    if (e.key === 'Backspace' && !hashtagInput && hashtags.length) {
      setHashtags(prev => prev.slice(0, -1))
    }
  }, [hashtagInput, hashtags, addHashtag])

  const handleHashtagPaste = useCallback((e) => {
    e.preventDefault()
    const text = (e.clipboardData || window.clipboardData).getData('text')
    const tags = text.split(/[,\s#]+/).filter(Boolean)
    setHashtags(prev => {
      const next = [...prev]
      tags.forEach(t => { if (!next.includes(t)) next.push(t) })
      return next
    })
    setHashtagInput('')
  }, [])

  const handleSubmit = useCallback(() => {
    const fd = new FormData()
    if (file) fd.append('media_file', file)
    fd.append('headline', headline)
    fd.append('body', body)
    fd.append('audience', audience || '')
    fd.append('hashtags', hashtags.join(','))
    fd.append('platform', platform)
    if (placements.length) fd.append('ad_placements', placements.join(','))
    fd.append('geo', geo)
    fd.append('base_cpc', cpc)
    fd.append('budget', budget)
    if (industry) fd.append('industry', industry)
    if (landingUrl) fd.append('landing_page_url', landingUrl)
    if (competitor) fd.append('competitor_brand', competitor)
    if (isLinkedIn) {
      fd.append('post_type', postType)
      fd.append('follower_count', followerCount)
    }

    const inputs = {
      headline, body, audience, hashtags: [...hashtags],
      platform, placements: [...placements], industry, geo,
      ...(isLinkedIn ? { postType, followerCount } : {}),
      landingUrl, competitor, cpc, budget,
      fileName: file?.name || null,
      fileType: file?.type || null,
      fileSize: file?.size || null,
    }

    if (file && file.type.startsWith('image/') && preview) {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 200
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        inputs.thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        onSubmit(fd, platform, inputs)
      }
      img.onerror = () => onSubmit(fd, platform, inputs)
      img.src = preview
    } else {
      onSubmit(fd, platform, inputs)
    }
  }, [file, preview, headline, body, audience, hashtags, platform, placements, geo, cpc, budget, industry, landingUrl, competitor, onSubmit])

  const estimatedClicks = budget > 0 && cpc > 0 ? Math.round(budget / cpc) : 0
  const placementOptions = PLATFORM_PLACEMENTS[platform] || []
  const isLinkedIn = platform === 'LinkedIn'

  return (
    <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 pb-32">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5"
      >
        {/* ── CREATIVE ASSET ─ left, spans 2 rows ──────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} overflow-hidden lg:col-span-5 lg:row-span-2 flex flex-col`}
        >
          <div className="px-5 pt-5 pb-2">
            <Label>Creative Asset</Label>
          </div>
          <div
            className={`relative cursor-pointer flex-1 flex flex-col items-center justify-center transition-colors ${
              file || preview
                ? ''
                : dragOver
                  ? 'border-2 border-dashed border-[#f9d85a] bg-[rgba(249,216,90,0.06)] mx-3 mb-3 rounded-[1rem]'
                  : 'border-2 border-dashed border-gray-300/40 mx-3 mb-3 rounded-[1rem]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]) }}
          >
            {!file && !preview && (
              <div className="flex flex-col items-center gap-2.5">
                <ImagePlus size={40} className="text-gray-300" strokeWidth={1.2} />
                <span className="text-[14px] font-medium text-gray-500">Drop your creative here</span>
                <span className="text-[11px] text-gray-400 font-mono">PNG, JPG, MP4, MOV</span>
              </div>
            )}
            {preview && !isVideo && (
              <img className="absolute inset-0 w-full h-full object-cover" src={preview} alt="" />
            )}
            {preview && isVideo && (
              <video className="absolute inset-0 w-full h-full object-cover" src={preview} ref={videoRef} muted={muted} loop autoPlay />
            )}
            {preview && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                <span className="absolute bottom-3 left-4 text-white text-[12px] font-medium truncate max-w-[70%] pointer-events-none">
                  {file?.name || 'Previous creative (re-upload to re-analyse)'}
                </span>
                <button
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                  onClick={clearFile}
                >
                  <X size={14} />
                </button>
                {isVideo && (
                  <button
                    className="absolute top-3 right-12 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                )}
              </>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            hidden
            onChange={e => { if (e.target.files.length) handleFile(e.target.files[0]) }}
          />

          {/* YouTube URL input — hidden once a file is loaded */}
          {!file && !preview && (
            <div className="mx-3 mb-3 mt-1">
              {/* Divider */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/[0.06]" />
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest">or paste YouTube URL</span>
                <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/[0.06]" />
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=…"
                    value={ytUrl}
                    onChange={e => { setYtUrl(e.target.value); setYtError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleYouTube(ytUrl)}
                    disabled={ytLoading}
                    className="w-full pl-8 pr-3 py-2 text-[12px] rounded-[0.75rem] bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#f9d85a]/60 disabled:opacity-50 transition"
                  />
                </div>
                <button
                  onClick={() => handleYouTube(ytUrl)}
                  disabled={ytLoading || !ytUrl.trim()}
                  className="px-3 py-2 rounded-[0.75rem] bg-[#f9d85a]/10 hover:bg-[#f9d85a]/20 text-[#f9d85a] disabled:opacity-40 transition text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  {ytLoading ? <Loader2 size={12} className="animate-spin" /> : <Youtube size={12} />}
                  {ytLoading ? 'Downloading' : 'Fetch'}
                </button>
              </div>

              {/* Progress bar */}
              {ytLoading && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span className="truncate">{ytMsg}</span>
                    <span className="ml-2 shrink-0">{ytProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#f9d85a] transition-all duration-300"
                      style={{ width: `${ytProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {ytError && (
                <p className="mt-2 text-[11px] text-red-500">{ytError}</p>
              )}
            </div>
          )}
        </motion.div>

        {/* ── AD COPY ─ right top ──────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} p-5 lg:col-span-7`}
        >
          <div className="flex items-center justify-between mb-3">
            <Label>Ad Copy</Label>
            {analysis?.store?.diagnostic && (
              <button
                onClick={() => analysis.generateVariants()}
                disabled={analysis.variantsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f9d85a]/10 text-[#f9d85a] hover:bg-[#f9d85a]/20 disabled:opacity-50 transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer"
              >
                {analysis.variantsLoading ? (
                  <RefreshCcw size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                Refine with AI
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Headline</span>
              <input
                className="w-full text-lg font-semibold bg-transparent border-b-2 border-gray-200 dark:border-white/10 focus:border-[#f9d85a] outline-none pb-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-colors"
                type="text"
                placeholder="Get 50% Off Your First Order Today"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Body</span>
              <textarea
                className="w-full bg-[#f4f5f7] dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10 focus:border-[#f9d85a] focus:ring-2 focus:ring-[#f9d85a]/10 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 resize-none transition-colors text-[14px]"
                placeholder="Shop our award-winning collection and discover why millions trust us. Free shipping on orders over $50. Limited time offer."
                rows="2"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
            
            <VariantSelector 
              variants={analysis?.store?.variants} 
              loading={analysis?.variantsLoading}
              onSelect={(v) => {
                setHeadline(v.headline)
                setBody(v.body_text)
              }}
            />

            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Hashtags</span>
              <div className="flex flex-wrap items-center gap-1.5 bg-[#f4f5f7] dark:bg-white/5 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-white/10 focus-within:border-[#f9d85a] focus-within:ring-2 focus-within:ring-[#f9d85a]/10 transition-colors">
                <AnimatePresence mode="popLayout">
                  {hashtags.map((tag, i) => (
                    <motion.span
                      key={tag}
                      variants={chipVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      layout
                      className="inline-flex items-center gap-1 bg-[#1a1a1c] text-white rounded-full px-2.5 py-0.5 text-[12px]"
                    >
                      <span className="text-[#f9d85a]">#</span>{tag}
                      <button
                        className="ml-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
                        onClick={() => setHashtags(prev => prev.filter((_, j) => j !== i))}
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  className="flex-1 min-w-[100px] bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 text-[13px]"
                  type="text"
                  placeholder="#shopnow, #deals, #freeshipping"
                  value={hashtagInput}
                  onChange={e => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKey}
                  onPaste={handleHashtagPaste}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── PLATFORM + PLACEMENTS ─ right bottom ─────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} p-5 lg:col-span-7`}
        >
          <Label>Platform</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {PLATFORMS.map(p => (
              <button
                key={p}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all cursor-pointer ${
                  platform === p
                    ? 'border-[#f9d85a] bg-[rgba(249,216,90,0.08)] text-gray-900 dark:text-white'
                    : 'border-gray-200 dark:border-white/10 bg-[#f4f5f7] dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                onClick={() => { setPlatform(p); setPlacements([]) }}
              >
                <PlatformIcon platform={p} size={18} />
                <span className="text-[11px] font-medium">{p}</span>
              </button>
            ))}
          </div>

          {placementOptions.length > 0 && !isLinkedIn && (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
                    Placements
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">optional</span>
                </div>
                {placements.length > 0 && (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    {placements.length} selected
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {placementOptions.map(pl => {
                  const active = placements.includes(pl)
                  return (
                    <button
                      key={pl}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#1a1a1c] text-white border-[#1a1a1c] dark:bg-white dark:text-[#1a1a1c] dark:border-white'
                          : 'bg-[#f4f5f7] dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                      }`}
                      onClick={() => setPlacements(prev =>
                        active ? prev.filter(x => x !== pl) : [...prev, pl]
                      )}
                    >
                      {pl}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* LinkedIn-specific: post type, followers, timing */}
          {isLinkedIn && (
            <div className="mt-4 space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <div>
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] block mb-2">
                  Post Type
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['text', 'image', 'video', 'document', 'poll', 'article'].map(t => (
                    <button
                      key={t}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all cursor-pointer capitalize ${
                        postType === t
                          ? 'bg-[#1a1a1c] text-white border-[#1a1a1c] dark:bg-white dark:text-[#1a1a1c] dark:border-white'
                          : 'bg-[#f4f5f7] dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                      }`}
                      onClick={() => setPostType(t)}
                    >
                      {t === 'document' ? 'Carousel / PDF' : t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
                    Followers
                  </span>
                  <input
                    type="number" min="1" max="10000000" step="1"
                    value={followerCount}
                    onChange={e => setFollowerCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 bg-transparent text-right font-mono text-[13px] text-gray-900 dark:text-gray-100 outline-none border-b border-gray-300 dark:border-white/20 focus:border-[#f9d85a]"
                  />
                </div>
                <input
                  type="range" min="100" max="500000" step="100"
                  value={Math.min(500000, followerCount)}
                  onChange={e => setFollowerCount(parseInt(e.target.value))}
                  className="w-full appearance-none h-[3px] bg-gray-200 dark:bg-white/10 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f9d85a] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#f9d85a] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* ── INDUSTRY ─────────────────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} p-5 lg:col-span-5`}
        >
          <div className="flex items-baseline gap-2">
            <Label>Industry</Label>
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mb-3">optional</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {INDUSTRIES.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                  industry === key
                    ? 'bg-[#f9d85a] text-[#1a1a1c] border-[#f9d85a]'
                    : 'bg-[#f4f5f7] dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                onClick={() => setIndustry(prev => prev === key ? '' : key)}
              >
                <Icon size={14} strokeWidth={1.8} className="shrink-0" />
                <span className="text-[12px] font-medium truncate">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── AUDIENCE + GEO ─────────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} p-5 lg:col-span-7`}
        >
          <Label>Audience</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-4">
            {AUDIENCE_TAGS.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 transition-all cursor-pointer ${
                  audience === key
                    ? 'bg-[#f9d85a] text-[#1a1a1c] border-[#f9d85a]'
                    : 'bg-[#f4f5f7] dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                onClick={() => setAudience(prev => prev === key ? '' : key)}
              >
                <Icon size={12} strokeWidth={1.8} className="shrink-0" />
                <span className="text-[11px] font-medium truncate">{label}</span>
              </button>
            ))}
          </div>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] block mb-2">
            Geo Target
          </span>
          <div className="grid grid-cols-5 gap-2">
            {GEO_TARGETS.map(g => (
              <button
                key={g.code}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-1 transition-all cursor-pointer ${
                  geo === g.code
                    ? 'border-[#f9d85a] bg-[rgba(249,216,90,0.08)] text-[#f9d85a]'
                    : 'border-gray-200 dark:border-white/10 bg-[#f4f5f7] dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                onClick={() => setGeo(g.code)}
              >
                <GeoShape name={g.name} size={36} />
                <span className={`text-[10px] font-medium leading-tight text-center ${
                  geo === g.code ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {g.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── CONTEXT ──────────────────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD} p-5 lg:col-span-5`}
        >
          <div className="flex items-baseline gap-2 mb-3">
            <Label>Context</Label>
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">optional</span>
          </div>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Landing Page</span>
              <div className="relative">
                <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full bg-[#f4f5f7] dark:bg-white/5 rounded-xl pl-9 pr-3 py-2.5 border border-gray-200 dark:border-white/10 focus:border-[#f9d85a] focus:ring-2 focus:ring-[#f9d85a]/10 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-colors text-[13px]"
                  type="text"
                  placeholder="https://example.com/landing-page"
                  value={landingUrl}
                  onChange={e => setLandingUrl(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Competitor</span>
              <div className="relative">
                <Swords size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full bg-[#f4f5f7] dark:bg-white/5 rounded-xl pl-9 pr-3 py-2.5 border border-gray-200 dark:border-white/10 focus:border-[#f9d85a] focus:ring-2 focus:ring-[#f9d85a]/10 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-colors text-[13px]"
                  type="text"
                  placeholder="Nike, Glossier, Shopify..."
                  value={competitor}
                  onChange={e => setCompetitor(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── BUDGET ─ dark card ────────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          className={`${CARD_DARK} p-5 lg:col-span-7`}
        >
          <Label>Budget</Label>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Base CPC</div>
              <div className="text-[24px] font-mono font-bold text-[#f9d85a] leading-none mb-3">${cpc.toFixed(2)}</div>
              <input
                type="range"
                min="0.10" max="10.00" step="0.10"
                value={cpc}
                onChange={e => setCpc(parseFloat(e.target.value))}
                className="w-full appearance-none h-[3px] bg-white/10 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f9d85a] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#f9d85a] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <input
                type="number" min="0.10" max="10.00" step="0.10"
                value={cpc}
                onChange={e => setCpc(parseFloat(e.target.value) || 0.10)}
                className="mt-2 w-20 bg-[#252527] border border-white/10 rounded-lg px-2 py-1 text-right font-mono text-[13px] text-[#f9d85a] outline-none focus:border-[#f9d85a] transition-colors"
              />
            </div>
            <div>
              <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1.5">Daily Budget</div>
              <div className="text-[24px] font-mono font-bold text-[#f9d85a] leading-none mb-3">${budget}</div>
              <input
                type="range"
                min="10" max="5000" step="10"
                value={budget}
                onChange={e => setBudget(parseInt(e.target.value))}
                className="w-full appearance-none h-[3px] bg-white/10 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f9d85a] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#f9d85a] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <input
                type="number" min="10" max="5000" step="10"
                value={budget}
                onChange={e => setBudget(parseInt(e.target.value) || 10)}
                className="mt-2 w-20 bg-[#252527] border border-white/10 rounded-lg px-2 py-1 text-right font-mono text-[13px] text-[#f9d85a] outline-none focus:border-[#f9d85a] transition-colors"
              />
            </div>
          </div>
          <div className="mt-4 text-[10px] font-mono text-white/25">
            ~{estimatedClicks} estimated clicks / day
          </div>
        </motion.div>

        {/* ── SUBMIT ───────────────────────────────────────────── */}
        <motion.button
          variants={cardVariants}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={`relative lg:col-span-12 h-14 rounded-[1rem] bg-[#f9d85a] text-[#1a1a1c] font-semibold text-[14px] tracking-wide uppercase shadow-lg shadow-[rgba(249,216,90,0.2)] overflow-hidden flex items-center justify-center gap-2 transition-opacity cursor-pointer ${
            loading || (!file && !headline) ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          onClick={handleSubmit}
          disabled={loading}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: loading ? 'none' : 'shimmer 3s ease-in-out infinite',
            }}
          />
          <span className="relative flex items-center gap-2">
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Launching analysis...</>
            ) : (
              <><Sparkles size={16} /> Analyze</>
            )}
          </span>
        </motion.button>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </section>
  )
}
