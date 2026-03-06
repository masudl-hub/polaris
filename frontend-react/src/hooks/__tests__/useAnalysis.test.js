import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAnalysis } from '../useAnalysis'

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Build a ReadableStream that emits SSE events from an array of objects.
 */
function makeSSEStream(events) {
  const chunks = events.map(evt => `data: ${JSON.stringify(evt)}\n\n`)
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]))
      } else {
        controller.close()
      }
    },
  })
}

function mockFetchOk(events) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      body: makeSSEStream(events).pipeThrough(new TextDecoderStream()).pipeThrough(new TextEncoderStream()),
      json: () => Promise.resolve({}),
    })
  )
}

function makeReadableResponse(events) {
  return {
    ok: true,
    body: makeSSEStream(events),
    json: () => Promise.resolve({}),
  }
}

// ─── Tests ───────────────────────────────────────────────────

describe('useAnalysis', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ── Initial State ──────────────────────────────────────────

  it('starts with initial state', () => {
    const { result } = renderHook(() => useAnalysis())

    expect(result.current.loading).toBe(false)
    expect(result.current.done).toBe(false)
    expect(result.current.stepCount).toBe(0)
    expect(result.current.totalSteps).toBe(0)
    expect(result.current.progress).toBe(0)
    expect(result.current.currentStep).toBe('')
    expect(result.current.store.steps).toEqual([])
    expect(result.current.store.text).toBeNull()
    expect(result.current.store.vision).toBeNull()
    expect(result.current.store.sentiment).toBeNull()
    expect(result.current.store.trends).toBeNull()
    expect(result.current.store.diagnostic).toBe('')
  })

  // ── loadStore ──────────────────────────────────────────────

  it('loadStore hydrates the store and sets done=true', () => {
    const { result } = renderHook(() => useAnalysis())
    const mockStore = {
      steps: [{ type: 'step', name: 'text' }],
      text: { entities: ['brand'] },
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
      diagnostic: 'loaded',
    }

    act(() => result.current.loadStore(mockStore))

    expect(result.current.store).toEqual(mockStore)
    expect(result.current.done).toBe(true)
  })

  // ── resetStore ─────────────────────────────────────────────

  it('resetStore clears everything', () => {
    const { result } = renderHook(() => useAnalysis())

    act(() => result.current.loadStore({ steps: [1], text: 'loaded', diagnostic: 'x' }))
    act(() => result.current.resetStore())

    expect(result.current.store.steps).toEqual([])
    expect(result.current.store.text).toBeNull()
    expect(result.current.store.diagnostic).toBe('')
    expect(result.current.done).toBe(false)
    expect(result.current.stepCount).toBe(0)
    expect(result.current.progress).toBe(0)
  })

  // ── run() — pipeline_started event ─────────────────────────

  it('handles pipeline_started event', async () => {
    const events = [
      { type: 'pipeline_started', total_steps: 10, has_media: true },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())
    const onDone = vi.fn()

    await act(async () => {
      await result.current.run(new FormData(), onDone)
    })

    expect(result.current.totalSteps).toBe(10)
  })

  // ── run() — step events increment progress ────────────────

  it('tracks step progress', async () => {
    const events = [
      { type: 'pipeline_started', total_steps: 3 },
      { type: 'step', name: 'NER', total_steps: 3 },
      { type: 'step', name: 'Sentiment', total_steps: 3 },
      { type: 'step', name: 'Trends', total_steps: 3 },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(new FormData(), vi.fn())
    })

    expect(result.current.stepCount).toBe(3)
    expect(result.current.progress).toBe(100)
    expect(result.current.store.steps).toHaveLength(3)
  })

  // ── run() — data events populate store ─────────────────────

  it('populates store from data events', async () => {
    const textPayload = {
      entities: ['Nike'],
      sentiment_breakdown: { positive: 0.8, negative: 0.1, neutral: 0.1 },
    }
    const visionPayload = { hook: 'athlete running', visual_tone: 'energetic' }
    const trendPayload = { entity_trends: { Nike: { momentum: 0.75 } } }
    const semPayload = { quality_score: 8, estimated_cpc: 1.2 }

    const events = [
      { type: 'text_data', data: textPayload },
      { type: 'vision_data', data: visionPayload },
      { type: 'trend_data', data: trendPayload },
      { type: 'sem_metrics', data: semPayload },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(new FormData(), vi.fn())
    })

    expect(result.current.store.text).toEqual(textPayload)
    expect(result.current.store.sentiment).toEqual(textPayload.sentiment_breakdown)
    expect(result.current.store.vision).toEqual(visionPayload)
    expect(result.current.store.trends).toEqual(trendPayload)
    expect(result.current.store.sem).toEqual(semPayload)
  })

  // ── run() — diagnostic event ───────────────────────────────

  it('handles diagnostic event', async () => {
    const events = [
      { type: 'diagnostic', data: '## Analysis\nStrong creative alignment.' },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(new FormData(), vi.fn())
    })

    expect(result.current.store.diagnostic).toBe('## Analysis\nStrong creative alignment.')
  })

  // ── run() — all ancillary data events ──────────────────────

  it('handles all ancillary data events', async () => {
    const events = [
      { type: 'benchmark_data', data: { industry: 'tech', ctr: 2.1 } },
      { type: 'landing_page_data', data: { coherence_score: 0.85 } },
      { type: 'reddit_data', data: { posts: [] } },
      { type: 'creative_angles', data: { score: 0.7 } },
      { type: 'audience_data', data: { segments: ['18-24'] } },
      { type: 'linkedin_data', data: { predicted_likes: 50 } },
      { type: 'competitor_data', data: { brands: ['Adidas'] } },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(new FormData(), vi.fn())
    })

    expect(result.current.store.benchmark).toEqual({ industry: 'tech', ctr: 2.1 })
    expect(result.current.store.landing).toEqual({ coherence_score: 0.85 })
    expect(result.current.store.reddit).toEqual({ posts: [] })
    expect(result.current.store.alignment).toEqual({ score: 0.7 })
    expect(result.current.store.audience).toEqual({ segments: ['18-24'] })
    expect(result.current.store.linkedin).toEqual({ predicted_likes: 50 })
    expect(result.current.store.competitor).toEqual({ brands: ['Adidas'] })
  })

  // ── run() — HTTP error calls onError ───────────────────────

  it('calls onError on HTTP failure', async () => {
    globalThis.fetch = () =>
      Promise.resolve({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ detail: 'Pipeline crashed' }),
      })

    const { result } = renderHook(() => useAnalysis())
    const onError = vi.fn()

    await act(async () => {
      await result.current.run(new FormData(), vi.fn(), onError)
    })

    expect(onError).toHaveBeenCalledWith('Pipeline crashed')
    expect(result.current.loading).toBe(false)
  })

  // ── run() — network error calls onError ────────────────────

  it('calls onError on network failure', async () => {
    globalThis.fetch = () => Promise.reject(new Error('Network error'))

    const { result } = renderHook(() => useAnalysis())
    const onError = vi.fn()

    await act(async () => {
      await result.current.run(new FormData(), vi.fn(), onError)
    })

    expect(onError).toHaveBeenCalledWith('Network error')
    expect(result.current.loading).toBe(false)
  })

  // ── run() — pipeline error event calls onError ─────────────

  it('calls onError on pipeline error event', async () => {
    const events = [
      { type: 'step', name: 'NER', total_steps: 3 },
      { type: 'error', detail: 'Gemini quota exceeded' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())
    const onError = vi.fn()

    await act(async () => {
      await result.current.run(new FormData(), vi.fn(), onError)
    })

    expect(onError).toHaveBeenCalledWith('Gemini quota exceeded')
  })

  // ── run() — done=true at the end ──────────────────────────

  it('sets done=true and progress=100 on done event', async () => {
    const events = [
      { type: 'step', name: 'NER', total_steps: 2 },
      { type: 'done' },
    ]
    globalThis.fetch = () => Promise.resolve(makeReadableResponse(events))

    const { result } = renderHook(() => useAnalysis())

    await act(async () => {
      await result.current.run(new FormData(), vi.fn())
    })

    expect(result.current.done).toBe(true)
    expect(result.current.progress).toBe(100)
  })

  // ── run() — sends formData to correct endpoint ─────────────

  it('POSTs to the correct streaming endpoint', async () => {
    const events = [{ type: 'done' }]
    const mockFetch = vi.fn(() => Promise.resolve(makeReadableResponse(events)))
    globalThis.fetch = mockFetch

    const { result } = renderHook(() => useAnalysis())
    const formData = new FormData()
    formData.append('ad_copy', 'Test ad')

    await act(async () => {
      await result.current.run(formData, vi.fn())
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/evaluate_ad_stream', {
      method: 'POST',
      body: formData,
    })
  })
})
