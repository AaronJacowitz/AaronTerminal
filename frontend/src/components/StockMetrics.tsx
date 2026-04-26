import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchStockInfo } from '../api/client'
import { useWatchlist } from '../context/WatchlistContext'
import { Plus, X, Check } from 'lucide-react'

interface Props { ticker: string }

function fmt(n: number | null | undefined, prefix = '', suffix = '', dec = 2) {
  if (n == null) return '—'
  return `${prefix}${n.toFixed(dec)}${suffix}`
}

function fmtBig(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toFixed(0)}`
}

export default function StockMetrics({ ticker }: Props) {
  const { data } = useQuery({
    queryKey: ['info', ticker],
    queryFn: () => fetchStockInfo(ticker),
    staleTime: 5 * 60_000,
  })

  const { addItem } = useWatchlist()
  const [showAdd, setShowAdd] = useState(false)
  const [qty, setQty] = useState('1')

  const confirmAdd = () => {
    const q = parseFloat(qty)
    if (!q) return
    addItem({ ticker, type: 'stock', label: ticker, quantity: q })
    setShowAdd(false)
  }

  const METRICS = data ? [
    { label: 'MKT CAP',     value: fmtBig(data.market_cap) },
    { label: 'P/E',         value: fmt(data.pe_ratio, '', '', 1) },
    { label: 'PEG',         value: fmt(data.peg_ratio, '', '', 2) },
    { label: 'EARNINGS',    value: data.earnings_date ?? '—' },
    { label: 'VOLUME',      value: data.volume ? `${(data.volume / 1e6).toFixed(2)}M` : '—' },
    { label: 'TODAY HIGH',  value: fmt(data.day_high, '$') },
    { label: 'TODAY LOW',   value: fmt(data.day_low, '$') },
    { label: '52W HIGH',    value: fmt(data.week_52_high, '$') },
    { label: '52W LOW',     value: fmt(data.week_52_low, '$') },
    { label: 'DIV YIELD',   value: data.dividend_yield != null ? `${data.dividend_yield.toFixed(2)}%` : '—' },
    { label: 'SHORT RATIO', value: fmt(data.short_ratio, '', 'x', 1) },
  ] : []

  return (
    <div style={{
      borderTop: '1px solid var(--border)', background: 'var(--bg3)',
      padding: '6px 10px', flexShrink: 0, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {METRICS.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', gap: 4, fontSize: 10, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-dim)' }}>{label}</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
            <span style={{ color: 'var(--border2)', marginRight: 2 }}>·</span>
          </div>
        ))}

        <button
          onClick={() => { setQty('1'); setShowAdd(true) }}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)',
            color: 'var(--green)', borderRadius: 3, padding: '2px 8px',
            fontSize: 9, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          <Plus size={9} /> WATCHLIST
        </button>
      </div>

      {showAdd && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 10, zIndex: 200,
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 4, padding: '10px 12px', width: 180,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em' }}>
            ADD {ticker} TO WATCHLIST
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Shares</div>
            <input
              type="number" step="1" min="1" value={qty}
              onChange={e => setQty(e.target.value)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 3,
                color: 'var(--text)', padding: '3px 6px', fontSize: 11, width: '100%',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowAdd(false)} style={{
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
    </div>
  )
}
