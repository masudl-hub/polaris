import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from './components/TopBar'
import Compose from './components/Compose'
import Analyze from './components/Analyze'
import Results from './components/Results'
import Slides from './components/Slides'
import Toast from './components/Toast'
import DemoGallery from './components/DemoGallery'
import { useTheme } from './hooks/useTheme'
import { useAnalysis } from './hooks/useAnalysis'
import { useSessions } from './hooks/useSessions'
import { viewTransition } from './lib/motion'

export default function App() {
  // Render slide deck if hash is #slides
  const [isSlides, setIsSlides] = useState(window.location.hash === '#slides')
  useEffect(() => {
    const onHash = () => setIsSlides(window.location.hash === '#slides')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  if (isSlides) return <Slides />
  const [view, setView] = useState('compose')
  const [dark, toggleTheme] = useTheme()
  const analysis = useAnalysis()
  const sessions = useSessions()
  const [selectedDemo, setSelectedDemo] = useState(null)
  const toastRef = useRef()
  const platformRef = useRef('Meta')
  const inputsRef = useRef(null)
  const mainRef = useRef(null)

  // Scroll to top on view change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0)
    }
  }, [view])

  useEffect(() => { sessions.refresh() }, [])

  const handleSubmit = useCallback((formData, platform, inputs) => {
    platformRef.current = platform
    inputsRef.current = inputs || null
    setView('analyze')
    analysis.run(
      formData,
      (store) => {
        toastRef.current?.show('Analysis complete', 'success')
        sessions.save(store, platform, inputsRef.current).then(() => sessions.refresh())
        setView('results')
      },
      (err) => {
        toastRef.current?.show(err, 'error')
        setView('compose')
      },
    )
  }, [analysis, sessions])

  const handleDemoSelect = useCallback((demo) => {
    // Just load it into state for Compose to pick up via prop
    setSelectedDemo(demo);
    
    // Scroll to top so the user sees the filled input form
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSessionClick = useCallback(async (id) => {
    const record = await sessions.load(id)
    if (record?.store) {
      analysis.loadStore(record.store, record.inputs || null)
      setView('results')
      sessions.refresh()
    }
  }, [analysis, sessions])

  const handleBack = useCallback(() => setView('compose'), [])

  return (
    <div className="h-screen flex flex-col bg-[#f4f5f7] dark:bg-[#111113] text-gray-900 dark:text-gray-100 transition-colors duration-200 antialiased">
      <Toast ref={toastRef} />
      <TopBar
        view={view}
        dark={dark}
        sessions={sessions.sessions}
        currentSessionId={sessions.currentId}
        onBack={handleBack}
        onSessionClick={handleSessionClick}
        onToggleTheme={toggleTheme}
      />
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          {view === 'compose' && (
            <motion.div
              key="compose"
              {...viewTransition}
            >
              <div className="max-w-7xl mx-auto py-8">
                <Compose 
                  loading={analysis.loading} 
                  onSubmit={handleSubmit} 
                  analysis={analysis} 
                  demoData={selectedDemo}
                />

                <div className="mt-16 mb-8 px-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-[#f4f5f7] dark:bg-[#111113] text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Quick Demo Library
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pb-12">
                  <DemoGallery onSelect={handleDemoSelect} />
                </div>
              </div>
            </motion.div>
          )}
          {view === 'analyze' && (
            <motion.div
              key="analyze"
              {...viewTransition}
            >
              <Analyze
                steps={analysis.store.steps}
                stepCount={analysis.stepCount}
                totalSteps={analysis.totalSteps}
                currentStep={analysis.currentStep}
                progress={analysis.progress}
                done={analysis.done}
              />
            </motion.div>
          )}
          {view === 'results' && (
            <motion.div
              key="results"
              {...viewTransition}
            >
              <Results 
                store={analysis.store} 
                sessions={sessions.sessions}
                currentSessionId={sessions.currentId}
                onBackToCompose={() => setView('compose')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
