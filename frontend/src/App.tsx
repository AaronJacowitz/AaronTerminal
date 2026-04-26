import { useState, useCallback, useRef, useEffect } from 'react'
import { Group as PanelGroup, Panel as ResizablePanel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fetchQuote } from './api/client'
import CandleChart, { type PeriodChange } from './components/CandleChart'
import OptionsView from './components/OptionsView'
import NewsPanel from './components/NewsPanel'
import Watchlist from './components/Watchlist'
import LandingPage from './components/LandingPage'
import AgentChat from './components/AgentChat'
import AuthScreen from './components/AuthScreen'
import NewsNotificationBell from './components/NewsNotificationBell'
import NewsToasts from './components/NewsToasts'
import { useNewsNotifications } from './hooks/useNewsNotifications'
import { WatchlistProvider } from './context/WatchlistContext'
import { useAuth } from './context/AuthContext'
import { Activity, Plus, X, Search } from 'lucide-react'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

type View = 'chart' | 'options' | 'news' | 'watchlist' | 'agent'

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
  { id: 'agent',     label: 'AGENT' },
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
  const [periodChange, setPeriodChange] = useState<import('./components/CandleChart').PeriodChange | null>(null)

  // Reset period change when ticker changes
  useEffect(() => { setPeriodChange(null) }, [panel.ticker])

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

  // When viewing chart tab and period data is ready, show period change;
  // otherwise fall back to daily change from the quote API.
  const showPeriod = panel.view === 'chart' && periodChange != null
  const displayChangePct = showPeriod ? periodChange!.pct : (quote?.change_pct ?? null)
  const displayChange    = showPeriod ? periodChange!.change : (quote?.change ?? null)
  const up = displayChange != null ? displayChange >= 0 : null
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
        position: 'relative',
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

        {/* Live price + period/daily change */}
        {quote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: up ? 'var(--green)' : 'var(--red)' }}>
              ${quote.price?.toFixed(2)}
            </span>
            {displayChangePct != null && (
              <span style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '+' : ''}{displayChangePct.toFixed(2)}%
                {showPeriod && (
                  <span style={{ color: 'var(--text-mute)', marginLeft: 2 }}>
                    ({periodChange!.interval})
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Nav tabs — leave room on the right for the close button */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 6, marginRight: canClose ? 20 : 0, overflow: 'hidden' }}>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`tab-btn ${panel.view === n.id ? 'active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 10, flexShrink: 0 }}
              onClick={() => onChange({ view: n.id })}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* Close — absolute so it's always visible */}
        {canClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '50%', right: 4,
              transform: 'translateY(-50%)',
              background: 'var(--bg3)', border: 'none',
              color: 'var(--red)', padding: 2, display: 'flex',
              alignItems: 'center', cursor: 'pointer', zIndex: 10,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {panel.view === 'chart'     && <CandleChart ticker={panel.ticker} onPeriodChange={setPeriodChange} />}
        {panel.view === 'options'   && <OptionsView ticker={panel.ticker} spot={spot} />}
        {panel.view === 'news'      && <NewsPanel ticker={panel.ticker} />}
        {panel.view === 'watchlist' && <Watchlist />}
        {panel.view === 'agent'     && (
          <AgentChat
            ticker={panel.ticker}
            onNavigate={cmd => {
              const update: Partial<PanelState> = {}
              if (cmd.view && (['chart','options','news','watchlist'] as string[]).includes(cmd.view))
                update.view = cmd.view as View
              if (cmd.ticker) update.ticker = cmd.ticker
              if (Object.keys(update).length) onChange(update)
            }}
          />
        )}
      </div>
    </div>
  )
}

// --- Workspace ---

function Workspace({ onSwitch }: { onSwitch: (mode: AppMode) => void }) {
  const [panels, setPanels] = useState<PanelState[]>([makePanel('SPY', 'chart')])
  const { notifications, toasts, unread, dismissToast, markAllRead, clearAll } = useNewsNotifications()
  const { state: authState, signOut } = useAuth()

  const addPanel = () => {
    setPanels(prev => [...prev, makePanel('SPY', 'chart')])
  }

  const removePanel = useCallback((id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id))
  }, [])

  const updatePanel = useCallback((id: string, update: Partial<PanelState>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...update } : p))
  }, [])

  const count = panels.length

  // Split into 1 or 2 rows depending on panel count
  const splitIdx = count > 3 ? Math.ceil(count / 2) : count
  const row1 = panels.slice(0, splitIdx)
  const row2 = panels.slice(splitIdx)
  const twoRows = row2.length > 0

  // Vertical split state (percentage for top row)
  const [topPct, setTopPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  const onVerticalDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const startY = e.clientY
    const startPct = topPct
    const h = container.getBoundingClientRect().height
    const onMove = (ev: MouseEvent) => {
      const delta = ((ev.clientY - startY) / h) * 100
      setTopPct(() => Math.min(85, Math.max(15, startPct + delta)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const renderRow = (rowPanels: PanelState[]) => {
    const children: React.ReactNode[] = []
    rowPanels.forEach((panel, idx) => {
      if (idx > 0) {
        children.push(
          <PanelResizeHandle key={`h-${panel.id}`} className="resize-handle resize-handle-h" />
        )
      }
      children.push(
        <ResizablePanel key={panel.id} defaultSize={100 / rowPanels.length} minSize={12}>
          <div style={{ height: '100%', padding: '0 2px', boxSizing: 'border-box' }}>
            <Panel
              panel={panel}
              canClose={panels.length > 1}
              onClose={() => removePanel(panel.id)}
              onChange={update => updatePanel(panel.id, update)}
            />
          </div>
        </ResizablePanel>
      )
    })
    return (
      <PanelGroup orientation="horizontal" style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </PanelGroup>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
        padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        {/* Aaron Terminal — click to go home */}
        <button
          onClick={() => onSwitch('landing')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--green)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
            fontFamily: 'inherit', padding: 0, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Activity size={13} /> AARON TERMINAL
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        <button
          onClick={addPanel}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)',
            color: 'var(--green)', borderRadius: 3, padding: '3px 10px',
            fontSize: 10, fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.06em',
            transition: 'all 0.15s', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.1)')}
        >
          <Plus size={11} /> ADD PANEL
        </button>

        <NewsNotificationBell
          notifications={notifications}
          unread={unread}
          onOpen={markAllRead}
          onClear={clearAll}
        />

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 9, color: 'var(--text-mute)' }}>
          {authState.status === 'signed_in' && (
            <>
              <span style={{ color: 'var(--text-dim)' }}>SIGNED IN AS</span>
              <span style={{ color: 'var(--text)', fontWeight: 700, letterSpacing: '0.06em' }}>
                {authState.user.username.toUpperCase()}
              </span>
              <button
                onClick={() => signOut()}
                style={{
                  background: 'none',
                  border: '1px solid var(--border2)',
                  color: 'var(--text-dim)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 9,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                SIGN OUT
              </button>
              <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
            </>
          )}
          <span>
            {count} PANEL{count !== 1 ? 'S' : ''} · 15-MIN DELAYED · YFINANCE + POLYGON
          </span>
        </span>
      </div>

      {/* Resizable panel area */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 2px', boxSizing: 'border-box' }}>
        {twoRows ? (
          <>
            <div style={{ height: `${topPct}%`, minHeight: '15%', boxSizing: 'border-box' }}>
              {renderRow(row1)}
            </div>
            <div
              className="resize-handle resize-handle-v"
              onMouseDown={onVerticalDragStart}
              style={{ flexShrink: 0, zIndex: 10 }}
            />
            <div style={{ flex: 1, minHeight: '15%', boxSizing: 'border-box' }}>
              {renderRow(row2)}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            {renderRow(row1)}
          </div>
        )}
      </div>

      <NewsToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

type AppMode = 'landing' | 'stocks'

export default function App() {
  const [mode, setMode] = useState<AppMode>('landing')
  const { state: authState } = useAuth()

  return (
    <QueryClientProvider client={queryClient}>
      {authState.status === 'loading' ? (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.1em' }}>
          LOADING…
        </div>
      ) : authState.status === 'signed_out' ? (
        <AuthScreen />
      ) : (
        <WatchlistProvider>
          {mode === 'landing' && (
            <LandingPage onSelect={m => setMode(m)} />
          )}
          {mode === 'stocks' && (
            <Workspace onSwitch={setMode} />
          )}

        </WatchlistProvider>
      )}
    </QueryClientProvider>
  )
}
