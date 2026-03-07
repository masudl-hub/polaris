import { useState, useCallback, useRef } from 'react'

const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  mediaDecomposition: null,
  audioIntelligence: null,
  entityAtomization: null,
  culturalContext: null,
  sentiment: null,
  compositeSentiment: null,
  trends: null,
  sem: null,
  landing: null,
  reddit: null,
  benchmark: null,
  alignment: null,
  audience: null,
  linkedin: null,
  competitor: null,
  resonanceGraph: null,
  diagnostic: '',
  variants: null,
}

export function useAnalysis() {
  const [store, setStore] = useState(INITIAL_STORE)
  const [inputs, setInputs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stepCount, setStepCount] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [variantsLoading, setVariantsLoading] = useState(false)
  const storeRef = useRef(INITIAL_STORE)

  const resetStore = useCallback(() => {
    const fresh = { ...INITIAL_STORE, steps: [] }
    storeRef.current = fresh
    setStore(fresh)
    setStepCount(0)
    setTotalSteps(0)
    setProgress(0)
    setCurrentStep('')
    setDone(false)
    setVariantsLoading(false)
  }, [])

  const loadStore = useCallback((s, inp = null) => {
    storeRef.current = s
    setStore(s)
    setInputs(inp)
    setDone(true)
  }, [])

  const run = useCallback(async (formData, onDone, onError) => {
    setLoading(true)
    setDone(false)
    resetStore()
    let count = 0

    try {
      const resp = await fetch('/api/v1/evaluate_ad_stream', { method: 'POST', body: formData })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || 'Analysis failed')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const msg = part.trim()
          if (!msg.startsWith('data: ')) continue
          let evt
          try { evt = JSON.parse(msg.substring(6)) } catch { continue }

          if (evt.type === 'pipeline_started') {
            // Immediate feedback — pipeline is running, show the UI right away
            setTotalSteps(evt.total_steps || 13)
            setCurrentStep(evt.has_media ? 'Uploading media…' : 'Initializing pipeline…')
          } else if (evt.type === 'progress_msg') {
            // A granular progress update from within a long step
            setCurrentStep(evt.msg || '')
          } else if (evt.type === 'step_starting') {
            // A step is about to run — show its name before the slow call
            setCurrentStep(evt.name || '')
            if (evt.total_steps) setTotalSteps(evt.total_steps)
          } else if (evt.type === 'step') {
            count++
            // Use total_steps from the backend if available
            const total = evt.total_steps || 13
            setTotalSteps(total)
            const pct = Math.round((count / total) * 100)
            setStepCount(count)
            setProgress(pct)
            setCurrentStep(evt.name || '')
            setStore(prev => {
              const next = { ...prev, steps: [...prev.steps, evt] }
              storeRef.current = next
              return next
            })
          } else if (evt.type === 'text_data') {
            setStore(prev => {
              const next = { ...prev, text: evt.data, sentiment: evt.data.sentiment_breakdown }
              storeRef.current = next
              return next
            })
          } else if (evt.type === 'vision_data') {
            setStore(prev => { const n = { ...prev, vision: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'media_decomposition') {
            setStore(prev => { const n = { ...prev, mediaDecomposition: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'audio_intelligence_data') {
            setStore(prev => { const n = { ...prev, audioIntelligence: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'entity_atomization_data') {
            setStore(prev => { const n = { ...prev, entityAtomization: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'cultural_context_data') {
            setStore(prev => { const n = { ...prev, culturalContext: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'trend_data') {
            setStore(prev => { const n = { ...prev, trends: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'sem_metrics') {
            setStore(prev => { const n = { ...prev, sem: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'composite_sentiment') {
            setStore(prev => { const n = { ...prev, compositeSentiment: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'benchmark_data') {
            setStore(prev => { const n = { ...prev, benchmark: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'landing_page_data') {
            setStore(prev => { const n = { ...prev, landing: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'reddit_data') {
            setStore(prev => { const n = { ...prev, reddit: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'creative_angles') {
            setStore(prev => { const n = { ...prev, alignment: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'audience_data') {
            setStore(prev => { const n = { ...prev, audience: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'linkedin_data') {
            setStore(prev => { const n = { ...prev, linkedin: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'competitor_data') {
            setStore(prev => { const n = { ...prev, competitor: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'resonance_graph') {
            setStore(prev => { const n = { ...prev, resonanceGraph: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'diagnostic') {
            setStore(prev => { const n = { ...prev, diagnostic: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'done') {
            setProgress(100)
            setDone(true)
            setTimeout(() => onDone?.(storeRef.current), 600)
          } else if (evt.type === 'error') {
            onError?.(evt.detail || 'Pipeline error')
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }, [resetStore])

  const generateVariants = useCallback(async (onSuccess, onError) => {
    setVariantsLoading(true)
    try {
      const payload = {
        status: "success",
        executive_diagnostic: storeRef.current.diagnostic,
        pipeline_trace: storeRef.current.steps || [],
        quantitative_metrics: {
          text_data: storeRef.current.text,
          vision_data: storeRef.current.vision,
          media_decomposition: storeRef.current.mediaDecomposition,
          trend_data: storeRef.current.trends,
          entity_atomization: storeRef.current.entityAtomization,
          cultural_context: storeRef.current.culturalContext,
          resonance_graph: storeRef.current.resonanceGraph,
          sem_metrics: storeRef.current.sem,
          industry_benchmark: storeRef.current.benchmark,
          landing_page: storeRef.current.landing,
          reddit_sentiment: storeRef.current.reddit,
          creative_alignment: storeRef.current.alignment,
          audience_analysis: storeRef.current.audience,
          linkedin_analysis: storeRef.current.linkedin,
          competitor_intel: storeRef.current.competitor,
        }
      }

      const resp = await fetch('/api/v1/generate_variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) throw new Error('Variant generation failed')
      const data = await resp.json()
      
      setStore(prev => ({ ...prev, variants: data.variants }))
      storeRef.current = { ...storeRef.current, variants: data.variants }
      onSuccess?.(data.variants)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setVariantsLoading(false)
    }
  }, [])

  return { 
    store,
    inputs,
    loading, 
    stepCount, 
    totalSteps, 
    currentStep, 
    progress, 
    done, 
    run, 
    resetStore, 
    loadStore, 
    storeRef,
    variantsLoading,
    generateVariants
  }
}
