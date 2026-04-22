import { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchQuote } from './api/client'
import CandleChart from './components/CandleChart'
import OptionsView from './components/OptionsView'
import NewsPanel from './components/NewsPanel'
import Watchlist from './components/Watchlist'
import { WatchlistProvider } from './context/WatchlistContext'
import { Activity, Plus, X, Search } from 'lucide-react'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

type View = 'chart' | 'options' | 'news' | 'watchlist'

interface PanelState {
  id: string
  ticker: string
  view: View
}

let nextId = 1
const makePanel = (ticker = 'SPY', view: View = 'chart'): PanelState => ({
  id: String(nextId++),
  ticker,
  view,
})

const NAV: { id: View; label: string }[] = [
  { id: 'chart',     label: 'CHART' },
  { id: 'options',   label: 'OPTIONS' },
  { id: 'news',      label: 'NEWS' },
  { id: 'watchlist', label: 'WATCHLIST' },
]

// --- Panel ---

function Panel({
  panel, onClose, canClose, onChange,
}: {
  panel: PanelState
  onClose: () => void
  canClose: boolean
  onChange: (update: Partial<PanelState>) => void
}) {
  const [tickerInput, setTickerInput] = useState(panel.ticker)

  const submitTicker = () => {
    const t = tickerInput.trim().toUpperCase()
    if (t && t !== panel.ticker) onChange({ ticker: t })
  }

  const { data: quote } = useQuery({
    queryKey: ['quote', panel.ticker],
    queryFn: () => fetchQuote(panel.ticker),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const up = quote ? quote.change >= 0 : null
  const spot = quote?.price ?? 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', background: 'var(--bg3)',
        borderBottom: '1px solid var(--border)', flexShrink: 0, minWidth: 0,
      }}>
        {/* Ticker search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'var(--bg)', border: '1px solid var(--border2)',
          borderRadius: 3, padding: '2px 6px', flexShrink: 0,
        }}>
          <Search size={9} style={{ color: 'var(--text-dim)' }} />
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submitTicker()}
            onBlur={submitTicker}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', width: 52, fontSize: 11, fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Live price */}
        {quote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: up ? 'var(--green)' : 'var(--red)' }}>
              ${quote.price?.toFixed(2)}
            </span>
            <span style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)' }}>
              {up ? '+' : ''}{quote.change_pct?.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Two tabs */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`tab-btn ${panel.view === n.id ? 'active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 10 }}
              onClick={() => onChange({ view: n.id })}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* Close */}
        {canClose && (
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--text-mute)', padding: 2, display: 'flex',
              alignItems: 'center', flexShrink: 0, cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-mute)')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {panel.view === 'chart'     && <CandleChart ticker={panel.ticker} />}
        {panel.view === 'options'   && <OptionsView ticker={panel.ticker} spot={spot} />}
        {panel.view === 'news'      && <NewsPanel ticker={panel.ticker} />}
        {panel.view === 'watchlist' && <Watchlist />}
      </div>
    </div>
  )
}

// --- Workspace ---

function Workspace() {
  const [panels, setPanels] = useState<PanelState[]>([makePanel('SPY', 'chart')])

  const addPanel = () => {
    setPanels(prev => [...prev, makePanel('SPY', 'chart')])
  }

  const removePanel = useCallback((id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id))
  }, [])

  const updatePanel = useCallback((id: string, update: Partial<PanelState>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...update } : p))
  }, [])

  // Grid layout: up to 3 columns, rows fill remaining height
  const count = panels.length
  const cols = count === 1 ? 1 : count === 2 ? 2 : 3
  const rows = Math.ceil(count / cols)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
        padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em' }}>
          <Activity size={13} />
          AARON TERMINAL
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <button
          onClick={addPanel}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)',
            color: 'var(--green)', borderRadius: 3, padding: '3px 10px',
            fontSize: 10, fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.06em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.1)')}
        >
          <Plus size={11} /> ADD PANEL
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-mute)' }}>
          {count} PANEL{count !== 1 ? 'S' : ''} · 15-MIN DELAYED · YFINANCE + POLYGON
        </div>
      </div>

      {/* Panel grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 4, padding: 4,
      }}>
        {panels.map(panel => (
          <Panel
            key={panel.id}
            panel={panel}
            canClose={panels.length > 1}
            onClose={() => removePanel(panel.id)}
            onChange={update => updatePanel(panel.id, update)}
          />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WatchlistProvider>
        <Workspace />
      </WatchlistProvider>
    </QueryClientProvider>
  )
}
