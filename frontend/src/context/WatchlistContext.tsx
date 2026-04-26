import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { addWatchlistItem, deleteWatchlistItem, fetchWatchlist, patchWatchlistItem, type WatchlistItem as ApiWatchlistItem } from '../api/client'

export interface WatchlistItem {
  id: string
  ticker: string
  type: 'stock' | 'option'
  label: string
  quantity: number
  // option-specific
  strike?: number
  optType?: 'call' | 'put'
  expiration?: string
  iv?: number
}

interface WatchlistCtx {
  items: WatchlistItem[]
  addItem: (item: Omit<WatchlistItem, 'id'>) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<WatchlistItem>) => void
}

const WatchlistContext = createContext<WatchlistCtx | null>(null)

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>([])

  useEffect(() => {
    let alive = true
    fetchWatchlist()
      .then((rows: ApiWatchlistItem[]) => { if (alive) setItems(rows as any) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [])

  const addItem = (item: Omit<WatchlistItem, 'id'>) => {
    // optimistic insert then replace id with server id
    const tmpId = `tmp-${Date.now()}-${Math.random()}`
    setItems(prev => [...prev, { ...item, id: tmpId }])
    addWatchlistItem(item as any)
      .then(saved => {
        setItems(prev => prev.map(i => i.id === tmpId ? (saved as any) : i))
      })
      .catch(() => {
        setItems(prev => prev.filter(i => i.id !== tmpId))
      })
  }

  const removeItem = (id: string) => {
    const prevItems = items
    setItems(prev => prev.filter(i => i.id !== id))
    if (id.startsWith('tmp-')) return
    deleteWatchlistItem(id).catch(() => {
      setItems(prevItems)
    })
  }

  const updateItem = (id: string, patch: Partial<WatchlistItem>) => {
    const prevItems = items
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    if (id.startsWith('tmp-')) return
    patchWatchlistItem(id, patch as any)
      .then(saved => setItems(prev => prev.map(i => i.id === id ? (saved as any) : i)))
      .catch(() => setItems(prevItems))
  }

  return (
    <WatchlistContext.Provider value={{ items, addItem, removeItem, updateItem }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be inside WatchlistProvider')
  return ctx
}
