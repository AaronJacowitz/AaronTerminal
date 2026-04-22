import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../api/client'
import { ExternalLink, RefreshCw, Search, X } from 'lucide-react'

interface Article {
  title: string
  link: string
  published: string
  summary: string
  source: string
}

interface Props { ticker: string }

function timeAgo(published: string) {
  try {
    const d = new Date(published)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return published }
}

export default function NewsPanel({ ticker }: Props) {
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['news', ticker],
    queryFn: () => fetchNews(ticker),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  })

  const allArticles: Article[] = data?.articles ?? []

  // Client-side filter so search is instant without re-fetching
  const articles = search.trim()
    ? allArticles.filter(a => {
        const q = search.toLowerCase()
        return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
      })
    : allArticles

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span>NEWS</span>
        <span style={{ color: 'var(--blue)' }}>{ticker}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {isFetching && <span style={{ color: 'var(--cyan)', fontSize: 9 }}>LIVE</span>}
          <button onClick={() => refetch()}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'var(--bg2)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg)', border: '1px solid var(--border2)',
          borderRadius: 4, padding: '4px 8px',
        }}>
          <Search size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search headlines, tickers, keywords…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 11, fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={10} />
            </button>
          )}
        </div>
        {search && (
          <div style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 4 }}>
            {articles.length} result{articles.length !== 1 ? 's' : ''} for "{search}"
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {isLoading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading news…</div>
        )}
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, lineHeight: '1.4', flex: 1 }}>
                  {a.title}
                </span>
                <ExternalLink size={9} style={{ color: 'var(--text-mute)', flexShrink: 0, marginTop: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--blue)' }}>{a.source}</span>
                <span>{timeAgo(a.published)}</span>
              </div>
              {a.summary && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, lineHeight: '1.4' }}>
                  {a.summary.slice(0, 150)}{a.summary.length > 150 ? '…' : ''}
                </div>
              )}
            </div>
          </a>
        ))}
        {!isLoading && articles.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            {search ? `No results for "${search}"` : 'No news found'}
          </div>
        )}
      </div>
    </div>
  )
}
