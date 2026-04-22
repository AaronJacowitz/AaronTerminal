import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

const KEY = 'aaron-terminal-watchlist'

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
    catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const addItem = (item: Omit<WatchlistItem, 'id'>) => {
    setItems(prev => [...prev, { ...item, id: `${Date.now()}-${Math.random()}` }])
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, patch: Partial<WatchlistItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
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
