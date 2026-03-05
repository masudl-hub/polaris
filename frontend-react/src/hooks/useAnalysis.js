import { useState, useCallback, useRef } from 'react'

const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  sentiment: null,
  trends: null,
  sem: null,
  landing: null,
  reddit: null,
  benchmark: null,
  alignment: null,
  audience: null,
  linkedin: null,
  competitor: null,
  diagnostic: '',
}

export function useAnalysis() {
  const [store, setStore] = useState(INITIAL_STORE)
  const [loading, setLoading] = useState(false)
  const [stepCount, setStepCount] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const storeRef = useRef(INITIAL_STORE)

  const resetStore = useCallback(() => {
    const fresh = { ...INITIAL_STORE, steps: [] }
    storeRef.current = fresh
    setStore(fresh)
    setStepCount(0)
    setProgress(0)
    setCurrentStep('')
    setDone(false)
  }, [])

  const loadStore = useCallback((s) => {
    storeRef.current = s
    setStore(s)
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

          if (evt.type === 'step') {
            count++
            const pct = Math.round((count / 12) * 100)
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
          } else if (evt.type === 'trend_data') {
            setStore(prev => { const n = { ...prev, trends: evt.data }; storeRef.current = n; return n })
          } else if (evt.type === 'sem_metrics') {
            setStore(prev => { const n = { ...prev, sem: evt.data }; storeRef.current = n; return n })
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
    } catch (err) {
      onError?.(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [resetStore])

  return { store, loading, stepCount, currentStep, progress, done, run, resetStore, loadStore, storeRef }
}
