import { useState, useCallback, useRef } from 'react'

const DB_NAME = 'zeitgeist_sessions'
const DB_VERSION = 1
const STORE_NAME = 'analyses'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e)
  })
}

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const currentIdRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const s = tx.objectStore(STORE_NAME)
      const req = s.getAll()
      req.onsuccess = e => setSessions((e.target.result || []).slice(-6).reverse())
    } catch {}
  }, [])

  const save = useCallback(async (store, platform, inputs) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const s = tx.objectStore(STORE_NAME)
      let label = 'Analysis'
      if (store.vision?.brand_detected) label = store.vision.brand_detected
      else if (store.text?.extracted_entities?.length) {
        const first = store.text.extracted_entities[0]
        if (first && !first.startsWith('(')) label = first
      }
      label = label + ' \u2014 ' + (platform || 'Meta')

      const record = {
        label,
        timestamp: Date.now(),
        qs: store.sem?.quality_score || 0,
        inputs: inputs ? JSON.parse(JSON.stringify(inputs)) : null,
        store: JSON.parse(JSON.stringify(store)),
      }
      return new Promise(resolve => {
        const req = s.add(record)
        req.onsuccess = e => {
          const id = e.target.result
          setCurrentId(id)
          currentIdRef.current = id
          resolve(id)
        }
        req.onerror = () => resolve(null)
      })
    } catch { return null }
  }, [])

  const load = useCallback(async (id) => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const s = tx.objectStore(STORE_NAME)
      return new Promise(resolve => {
        const req = s.get(id)
        req.onsuccess = e => {
          if (e.target.result) {
            setCurrentId(id)
            currentIdRef.current = id
          }
          resolve(e.target.result)
        }
        req.onerror = () => resolve(null)
      })
    } catch { return null }
  }, [])

  return { sessions, currentId, refresh, save, load }
}
