import { useState, useEffect, useRef } from 'react'
import { useWatchlist } from '../context/WatchlistContext'
import { fetchNews } from '../api/client'

export interface NewsNotif {
  id: string
  ticker: string
  title: string
  link: string
  source: string
  published: string
}

const SEEN_KEY = 'aaron-news-seen'
const POLL_MS  = 5 * 60_000

export function useNewsNotifications() {
  const { items } = useWatchlist()
  const [notifications, setNotifications] = useState<NewsNotif[]>([])
  const [toasts, setToasts] = useState<NewsNotif[]>([])
  const [unread, setUnread] = useState(0)

  const seenRef         = useRef<Set<string>>(new Set())
  const initedTickersRef = useRef<Set<string>>(new Set())

  // Load persisted seen set once on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
      seenRef.current = new Set(saved)
    } catch {}
  }, [])

  const tickers    = [...new Set(items.map(i => i.ticker))]
  const tickersKey = tickers.sort().join(',')

  useEffect(() => {
    if (tickers.length === 0) return

    async function poll() {
      const uninited = tickers.filter(t => !initedTickersRef.current.has(t))

      const allTickers = tickers
      const results = await Promise.allSettled(
        allTickers.map(t => fetchNews(t).catch(() => ({ articles: [] })))
      )

      const fresh: NewsNotif[] = []

      results.forEach((r, idx) => {
        if (r.status !== 'fulfilled') return
        const ticker   = allTickers[idx]
        const isInit   = uninited.includes(ticker)
        const articles = r.value?.articles ?? []

        if (isInit) initedTickersRef.current.add(ticker)

        articles.forEach((a: any) => {
          const key = a.link || a.title
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key)
            if (!isInit) {
              fresh.push({
                id: `${Date.now()}-${Math.random()}`,
                ticker,
                title:     a.title,
                link:      a.link,
                source:    a.source,
                published: a.published,
              })
            }
          }
        })
      })

      // Persist (cap at 2000 to avoid unbounded growth)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current].slice(-2000)))
      } catch {}

      if (fresh.length > 0) {
        setNotifications(prev => [...fresh, ...prev].slice(0, 50))
        setToasts(prev => [...prev, ...fresh].slice(-5))
        setUnread(n => n + fresh.length)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey])

  const dismissToast  = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))
  const markAllRead   = () => setUnread(0)
  const clearAll      = () => { setNotifications([]); setUnread(0) }

  return { notifications, toasts, unread, dismissToast, markAllRead, clearAll }
}
