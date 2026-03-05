import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { fadeUp, staggerContainer, pillItem } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import CardInsight from '../ui/CardInsight'

function fitBadge(score) {
  if (score >= 7) return { label: `${parseFloat(score).toFixed(1)}/10 Fit`, variant: 'success' }
  if (score >= 4) return { label: `${parseFloat(score).toFixed(1)}/10 Fit`, variant: 'warning' }
  return { label: `${parseFloat(score).toFixed(1)}/10 Fit`, variant: 'danger' }
}

export default function CreativeCard({ vision }) {
  if (!vision) return null

  const v = vision
  const fit = v.platform_fit_score != null ? fitBadge(v.platform_fit_score) : null

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      <CardInsight
        meaning="An AI vision analysis of your creative asset -- evaluating visual composition, brand presence, clutter level, and how well the format fits your target platform's best practices."
        significance="Platform fit directly impacts ad delivery. A score below 5 means the algorithm is likely to deprioritize your ad. Visual clutter reduces attention span from 3s to under 1s."
        calculation="We pass the creative through a multimodal vision model that scores: (1) platform_fit = format + aspect_ratio + text_overlay_ratio compliance, (2) clutter = object_count > threshold, (3) brand_detection via logo/text recognition, (4) visual_tags via scene classification. Platform fit is scored 0-10 against platform-specific rubrics."
      >
        <Card padding="spacious" animate={false}>
          <div className="flex items-center justify-between mb-6">
            <SectionHeader title="Creative Intelligence" variant="mono" />
            {fit && (
              <Badge variant={fit.variant} className="rounded-full">
                {fit.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-8 mb-6">
            <div>
              <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-1">
                Clutter
              </span>
              <div className="flex items-center gap-2">
                {v.is_cluttered ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-500">CLUTTERED</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-500">CLEAN</span>
                  </>
                )}
              </div>
            </div>

            {v.brand_detected && (
              <div>
                <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 block mb-1">
                  Brand
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {v.brand_detected}
                </span>
              </div>
            )}
          </div>

          {v.visual_tags?.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2 mb-6"
              variants={staggerContainer(50)}
              initial="hidden"
              animate="visible"
            >
              {v.visual_tags.map((tag, i) => (
                <motion.span
                  key={i}
                  variants={pillItem}
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium font-mono bg-[rgba(34,197,94,0.08)] text-[#22c55e]"
                >
                  {tag}
                </motion.span>
              ))}
            </motion.div>
          )}

          {v.platform_suggestions && (
            <div className="border-l-[3px] border-[#f9d85a] pl-5">
              <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {v.platform_suggestions}
              </span>
            </div>
          )}
        </Card>
      </CardInsight>
    </motion.div>
  )
}
