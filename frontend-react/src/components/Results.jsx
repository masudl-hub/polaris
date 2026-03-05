import { motion } from 'framer-motion'
import { viewTransition } from '../lib/motion'
import OverviewHero from './results/OverviewHero'
import SentimentCard from './results/SentimentCard'
import CreativeCard from './results/CreativeCard'
import TrendsSection from './results/TrendsSection'
import LanguageSection from './results/LanguageSection'
import MarketSection from './results/MarketSection'
import DiagnosticSection from './results/DiagnosticSection'
import PipelineSection from './results/PipelineSection'
import LinkedInSection from './results/LinkedInSection'

export default function Results({ store }) {
  return (
    <motion.section
      className="flex-1 overflow-y-auto bg-[#f4f5f7] dark:bg-[#111113]"
      initial={viewTransition.initial}
      animate={viewTransition.animate}
      exit={viewTransition.exit}
      transition={viewTransition.transition}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 space-y-8">
        <OverviewHero store={store} />

        {store.linkedin && <LinkedInSection linkedin={store.linkedin} />}

        <SentimentCard sentiment={store.sentiment} compositeScore={store.text?.sentiment_score} />

        <TrendsSection trends={store.trends} alignment={store.alignment} />
        <LanguageSection text={store.text} />
        <MarketSection
          benchmark={store.benchmark}
          landing={store.landing}
          reddit={store.reddit}
          competitor={store.competitor}
        />
        <CreativeCard vision={store.vision} />
        <DiagnosticSection diagnostic={store.diagnostic} />
        <PipelineSection steps={store.steps} />
      </div>
    </motion.section>
  )
}
