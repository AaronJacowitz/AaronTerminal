import { useState, useRef, useCallback } from 'react'
import OptionsChain from './OptionsChain'
import GreekChart from './GreekChart'
import RobinhoodPnL from './RobinhoodPnL'
import { useWatchlist } from '../context/WatchlistContext'
import { X, Plus, Check, GripHorizontal } from 'lucide-react'

interface SelectedContract {
  row: any
  optType: 'call' | 'put'
  expiration: string
}

type DetailTab = 'pnl' | 'greeks'

interface Props {
  ticker: string
  spot: number
}

export default function OptionsView({ ticker, spot }: Props) {
  const [selected, setSelected]       = useState<SelectedContract | null>(null)
  const [detailTab, setDetailTab]     = useState<DetailTab>('pnl')
  const [chainPct, setChainPct]       = useState(52)   // % of container height for chain
  const [showAddForm, setShowAddForm] = useState(false)
  const [addQty, setAddQty]           = useState('1')

  const containerRef = useRef<HTMLDivElement>(null)
  const { addItem } = useWatchlist()

  const handleSelect = (row: any, optType: 'call' | 'put', expiration: string) => {
    setSelected({ row, optType, expiration })
    setDetailTab('pnl')
    setShowAddForm(false)
  }

  // Drag handler for the resizable divider
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const totalH  = container.clientHeight
    const startY  = e.clientY
    const startPct = chainPct

    const onMove = (me: MouseEvent) => {
      const delta = ((me.clientY - startY) / totalH) * 100
      setChainPct(Math.max(20, Math.min(78, startPct + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [chainPct])

  const openAddToWatchlist = () => {
    setAddQty('1')
    setShowAddForm(true)
  }

  const confirmAdd = () => {
    if (!selected) return
    const q = parseFloat(addQty)
    if (!q) return
    addItem({
      ticker,
      type:       'option',
      label:      `${ticker} $${selected.row.strike} ${selected.optType.toUpperCase()} ${selected.expiration}`,
      quantity:   q,
      strike:     selected.row.strike,
      optType:    selected.optType,
      expiration: selected.expiration,
      iv:         selected.row.iv,
    })
    setShowAddForm(false)
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Options chain */}
      <div style={{
        height: selected ? `${chainPct}%` : '100%',
        minHeight: 0, overflow: 'hidden',
        transition: selected ? undefined : 'height 0.2s ease',
      }}>
        <OptionsChain ticker={ticker} spot={spot} onSelectContract={handleSelect} />
      </div>

      {/* Drag handle — only visible when detail panel is open */}
      {selected && (
        <div
          onMouseDown={onDragStart}
          style={{
            height: 8, flexShrink: 0, cursor: 'row-resize',
            background: 'var(--bg3)',
            borderTop: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            userSelect: 'none',
          }}
          title="Drag to resize"
        >
          <GripHorizontal size={12} style={{ color: 'var(--border2)', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Contract detail panel */}
      {selected && (
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--bg2)',
          position: 'relative',
        }}>
          {/* Detail header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 10px', background: 'var(--bg3)',
            borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: selected.optType === 'call' ? 'var(--green)' : 'var(--red)' }}>
              {ticker} ${selected.row.strike} {selected.optType.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>exp {selected.expiration}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
              background: selected.row.inTheMoney ? 'rgba(0,212,170,0.12)' : 'rgba(90,106,138,0.15)',
              color: selected.row.inTheMoney ? 'var(--green)' : 'var(--text-dim)',
              border: `1px solid ${selected.row.inTheMoney ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
            }}>
              {selected.row.inTheMoney ? 'ITM' : 'OTM'}
            </span>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
              {(['pnl', 'greeks'] as DetailTab[]).map(t => (
                <button key={t} className={`tab-btn ${detailTab === t ? 'active' : ''}`}
                  style={{ padding: '3px 10px', fontSize: 10 }}
                  onClick={() => setDetailTab(t)}>
                  {t === 'pnl' ? 'P&L' : 'GREEKS'}
                </button>
              ))}
            </div>

            {/* Add to watchlist */}
            <button
              onClick={openAddToWatchlist}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)',
                color: 'var(--green)', borderRadius: 3, padding: '2px 8px',
                fontSize: 9, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              <Plus size={9} /> WATCHLIST
            </button>

            {/* Close */}
            <button
              onClick={() => { setSelected(null); setShowAddForm(false) }}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-mute)', cursor: 'pointer', padding: 2,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-mute)')}
            >
              <X size={12} />
            </button>
          </div>

          {/* Add to watchlist inline form */}
          {showAddForm && (
            <div style={{
              position: 'absolute', top: 32, right: 40, zIndex: 200,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 4, padding: '10px 12px', width: 210,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em' }}>
                ADD OPTION TO WATCHLIST
              </div>

              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Contracts</div>
                <input
                  type="number" step="1" min="1" value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 3,
                    color: 'var(--text)', padding: '3px 6px', fontSize: 11, width: '100%',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => setShowAddForm(false)} style={{
                  flex: 1, background: 'var(--border)', border: 'none', color: 'var(--text-dim)',
                  borderRadius: 3, padding: '4px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}><X size={10} /> Cancel</button>
                <button onClick={confirmAdd} style={{
                  flex: 1, background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.4)',
                  color: 'var(--green)', borderRadius: 3, padding: '4px', fontSize: 10, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}><Check size={10} /> Add</button>
              </div>
            </div>
          )}

          {/* Tab content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {detailTab === 'pnl' && (
              <RobinhoodPnL ticker={ticker} spot={spot}
                contract={selected.row} optType={selected.optType} expiration={selected.expiration} />
            )}
            {detailTab === 'greeks' && (
              <GreekChart ticker={ticker} expiration={selected.expiration}
                strike={selected.row.strike} optType={selected.optType} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
