/**
 * AudioSection — Phase 2
 * Displays AudD song identification result with trend momentum bar.
 * Rendered in Results.jsx when store.audioIntelligence is populated.
 */
import { Music, TrendingUp, ExternalLink, Calendar, Disc } from 'lucide-react'
import { SectionHeader } from '../ui'
import { Card } from '../ui'

// ── Momentum Bar ─────────────────────────────────────────────────────────────

function MomentumBar({ value }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const color =
    pct >= 70 ? '#22c55e'   // green — trending strong
    : pct >= 40 ? '#f59e0b' // amber — moderate
    : '#ef4444'             // red — fading

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="font-medium">90-day Search Momentum</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AudioSection({ data }) {
  if (!data) return null

  const { title, artist, album, release_date, match_timecode, song_link, trend_momentum } = data

  return (
    <section aria-label="Audio Intelligence">
      <SectionHeader
        icon={<Music size={18} />}
        title="Music Detected"
        subtitle="Background track identified via AudD audio fingerprinting"
      />

      <Card className="p-5 space-y-4">
        {/* Song identity */}
        <div className="space-y-0.5">
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
            {title}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
            {artist}
          </p>
        </div>

        {/* Optional metadata */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {album && (
            <span className="flex items-center gap-1">
              <Disc size={12} />
              {album}
            </span>
          )}
          {release_date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {release_date}
            </span>
          )}
          {match_timecode && (
            <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              match @ {match_timecode}
            </span>
          )}
        </div>

        {/* Trend momentum bar */}
        <MomentumBar value={trend_momentum} />

        {/* Listen link */}
        {song_link && (
          <a
            href={song_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink size={13} />
            Listen
          </a>
        )}
      </Card>
    </section>
  )
}
