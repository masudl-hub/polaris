/**
 * MediaSection — Phase 1
 * Displays native Gemini media decomposition: scene timeline, OCR text,
 * entities, audio description, and platform fit score.
 */
import { Film, Mic, Type, Tag, Star, Layers, ChevronDown } from 'lucide-react'
import { SectionHeader } from '../ui'
import { Card } from '../ui'
import { useState } from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  if (score == null) return null
  const pct = ((score - 1) / 9) * 100
  const color =
    score >= 8 ? '#22c55e'  // green
    : score >= 6 ? '#f59e0b' // amber
    : '#ef4444'              // red

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>
        {score.toFixed(1)}/10
      </span>
    </div>
  )
}

function SceneCard({ scene }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          Scene {scene.scene_number}
        </span>
        <span className="text-xs text-neutral-400 tabular-nums">
          {scene.start_seconds.toFixed(1)}s – {scene.end_seconds.toFixed(1)}s
        </span>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">
        {scene.visual_summary}
      </p>
      {scene.primary_setting && (
        <p className="text-xs text-neutral-500 italic">{scene.primary_setting}</p>
      )}
      {scene.all_ocr_text?.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {scene.all_ocr_text.map((t, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {scene.key_entities?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scene.key_entities.map((e, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs"
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MediaSection({ mediaDecomposition }) {
  if (!mediaDecomposition) return null

  const {
    media_type,
    duration_seconds,
    scenes = [],
    audio,
    all_extracted_text = [],
    all_entities = [],
    overall_visual_style,
    platform_fit,
    platform_fit_score,
    brand_detected,
    platform_suggestions,
  } = mediaDecomposition

  const isVideo = media_type === 'video'
  const [scenesExpanded, setScenesExpanded] = useState(false)

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={<Film size={18} />}
        title="Media Intelligence"
        subtitle={
          isVideo
            ? `${scenes.length} scene${scenes.length !== 1 ? 's' : ''} · ${duration_seconds != null ? `${duration_seconds.toFixed(1)}s` : 'video'}`
            : 'Image analysis'
        }
      />

      {/* Platform Fit */}
      {(platform_fit_score != null || platform_fit || brand_detected) && (
        <Card className="p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                <Star size={13} /> Platform Fit
              </p>
              {platform_fit && (
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                  {platform_fit}
                </p>
              )}
            </div>
            {brand_detected && (
              <div>
                <p className="text-xs text-neutral-500">Brand detected</p>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {brand_detected}
                </p>
              </div>
            )}
            {overall_visual_style && (
              <div>
                <p className="text-xs text-neutral-500">Visual style</p>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                  {overall_visual_style}
                </p>
              </div>
            )}
          </div>
          {platform_fit_score != null && <ScoreBar score={platform_fit_score} />}
          {platform_suggestions && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-3">
              💡 {platform_suggestions}
            </p>
          )}
        </Card>
      )}

      {/* Audio */}
      {isVideo && audio && (
        <Card className="p-4 flex gap-3 items-start">
          <Mic size={16} className="text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {audio.has_audio ? 'Audio detected' : 'No audio / silent'}
            </p>
            {audio.description && (
              <p className="text-sm text-neutral-500 mt-0.5 italic">"{audio.description}"</p>
            )}
          </div>
        </Card>
      )}

      {/* Scene Timeline — collapsed by default */}
      {scenes.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setScenesExpanded(!scenesExpanded)}
            className="w-full flex items-center justify-between px-1 group cursor-pointer"
          >
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
              <Layers size={13} /> Scene Breakdown
              <span className="text-neutral-400 font-normal normal-case tracking-normal">
                ({scenes.length} scene{scenes.length !== 1 ? 's' : ''})
              </span>
            </p>
            <ChevronDown
              size={14}
              className={`text-neutral-400 group-hover:text-neutral-600 transition-transform duration-200 ${scenesExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {scenesExpanded && (
            <div className="grid gap-3 sm:grid-cols-2">
              {scenes.map(scene => (
                <SceneCard key={scene.scene_number} scene={scene} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All OCR Text */}
      {all_extracted_text.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
            <Type size={13} /> Extracted Text (all frames)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {all_extracted_text.map((t, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* All Entities */}
      {all_entities.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
            <Tag size={13} /> Visual Entities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {all_entities.map((e, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm"
              >
                {e}
              </span>
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}
