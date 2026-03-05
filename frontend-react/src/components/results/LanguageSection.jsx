import { motion } from 'framer-motion'
import { fadeUp, staggerContainer, pillItem } from '../../lib/motion'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import SectionHeader from '../ui/SectionHeader'
import CardInsight from '../ui/CardInsight'

export default function LanguageSection({ text }) {
  if (!text) return null

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer(100, 50)}
    >
      <SectionHeader title="Language & Entities" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Named entities */}
        {text.extracted_entities?.length > 0 && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="People, organizations, products, and locations identified in your ad copy using natural language processing."
              significance="Named entities are what search engines and ad platforms use to match your ad to user intent. Missing key entities means missed targeting opportunities."
              calculation="Extracted via spaCy's en_core_web_sm NER pipeline. Entity types include PERSON, ORG, PRODUCT, GPE (geo-political), and MONEY. Duplicates are merged and ranked by frequency."
            >
              <Card padding="spacious" animate={false}>
                <SectionHeader title="Named Entities" subtitle="spaCy NER" variant="mono" className="mb-4" />
                <motion.div
                  className="flex flex-wrap gap-2"
                  variants={staggerContainer(40)}
                  initial="hidden"
                  animate="visible"
                >
                  {text.extracted_entities.map((entity, i) => (
                    <motion.span key={i} variants={pillItem}>
                      <Badge variant="accent">{entity}</Badge>
                    </motion.span>
                  ))}
                </motion.div>
              </Card>
            </CardInsight>
          </motion.div>
        )}

        {/* Suggested hashtags */}
        {text.suggested_tags?.length > 0 && (
          <motion.div variants={fadeUp}>
            <CardInsight
              meaning="AI-suggested hashtags that are semantically related to your ad's content, designed to expand organic reach on social platforms."
              significance="The right hashtags can increase organic impressions by 30-50% on platforms like Instagram, TikTok, and LinkedIn. These are chosen for relevance, not just popularity."
              calculation="We take your extracted entities and keywords, find their GloVe vector embeddings, then retrieve the nearest neighbors in hashtag-space. Filtered by minimum search volume and deduplicated against your existing hashtags."
            >
              <Card padding="spacious" animate={false}>
                <SectionHeader title="Suggested Hashtags" subtitle="GloVe" variant="mono" className="mb-4" />
                <motion.div
                  className="flex flex-wrap gap-2"
                  variants={staggerContainer(40)}
                  initial="hidden"
                  animate="visible"
                >
                  {text.suggested_tags.map((tag, i) => {
                    const display = tag.startsWith('#') ? tag : `#${tag}`
                    return (
                      <motion.span key={i} variants={pillItem}>
                        <Badge variant="warning">{display}</Badge>
                      </motion.span>
                    )
                  })}
                </motion.div>
              </Card>
            </CardInsight>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}
