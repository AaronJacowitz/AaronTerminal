import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWatchlist, type WatchlistItem } from '../context/WatchlistContext'
import { fetchQuote, calculatePnL } from '../api/client'
import { Trash2, TrendingUp } from 'lucide-react'

// --- Daily P&L hooks ---

function useStockDaily(item: WatchlistItem) {
  const { data: quote } = useQuery({
    queryKey: ['quote', item.ticker],
    queryFn: () => fetchQuote(item.ticker),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: item.type === 'stock',
  })
  const price     = quote?.price      ?? null
  const prevClose = quote?.prev_close ?? null
  const pnl    = price != null && prevClose != null ? (price - prevClose) * item.quantity : null
  const pnlPct = price != null && prevClose != null && prevClose > 0
    ? ((price - prevClose) / prevClose) * 100 : null
  return { price, pnl, pnlPct }
}

function useOptionDaily(item: WatchlistItem) {
  const { data: quote } = useQuery({
    queryKey: ['quote', item.ticker],
    queryFn: () => fetchQuote(item.ticker),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: item.type === 'option',
  })
  const spot      = quote?.price      ?? null
  const prevClose = quote?.prev_close ?? null

  const baseArgs = item.type === 'option' && item.expiration ? {
    opt_type: item.optType, strike: item.strike, expiration: item.expiration,
    num_contracts: item.quantity, iv: item.iv || 0.3, entry_price: 0,
  } : null

  const currPayload = baseArgs && spot      ? { ...baseArgs, spot }      : null
  const prevPayload = baseArgs && prevClose ? { ...baseArgs, spot: prevClose } : null

  const { data: currData } = useQuery({
    queryKey: ['pnl-curr', JSON.stringify(currPayload)],
    queryFn: () => calculatePnL(currPayload!),
    enabled: !!currPayload, staleTime: 15_000,
  })
  const { data: prevData } = useQuery({
    queryKey: ['pnl-prev', JSON.stringify(prevPayload)],
    queryFn: () => calculatePnL(prevPayload!),
    enabled: !!prevPayload, staleTime: 15_000,
  })

  const currVal = currData?.current_value ?? null
  const prevVal = prevData?.current_value ?? null
  const price  = currVal
  const pnl    = currVal != null && prevVal != null
    ? (currVal - prevVal) * 100 * item.quantity : null
  const pnlPct = currVal != null && prevVal != null && prevVal > 0
    ? ((currVal - prevVal) / prevVal) * 100 : null
  return { price, pnl, pnlPct }
}

// --- Single row ---

function Row({ item, onUpdate, onRemove }: {
  item: WatchlistItem
  onUpdate: (patch: Partial<WatchlistItem>) => void
  onRemove: () => void
}) {
  const [editQty, setEditQty] = useState(String(item.quantity))

  const stockDaily  = useStockDaily(item)
  const optionDaily = useOptionDaily(item)
  const { price, pnl, pnlPct } = item.type === 'stock' ? stockDaily : optionDaily

  const good     = (pnl ?? 0) >= 0
  const pnlColor = good ? 'var(--green)' : 'var(--red)'

  const commitQty = () => {
    const q = parseFloat(editQty)
    if (q > 0) onUpdate({ quantity: q })
    else setEditQty(String(item.quantity))
  }

  const cell: React.CSSProperties = {
    padding: '7px 8px', fontSize: 11, verticalAlign: 'middle',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <tr
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Symbol */}
      <td style={cell}>
        <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.ticker}
        </div>
        {item.type === 'option' && (
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
            ${item.strike} {item.optType?.toUpperCase()} {item.expiration}
          </div>
        )}
      </td>

      {/* Type */}
      <td style={{ ...cell, textAlign: 'center' }}>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
          background: item.type === 'stock' ? 'rgba(77,166,255,0.12)' : item.optType === 'call' ? 'rgba(0,212,170,0.12)' : 'rgba(255,77,109,0.12)',
          color: item.type === 'stock' ? 'var(--blue)' : item.optType === 'call' ? 'var(--green)' : 'var(--red)',
        }}>
          {item.type === 'stock' ? 'STK' : item.optType?.toUpperCase()}
        </span>
      </td>

      {/* Qty — inline editable */}
      <td style={{ ...cell, textAlign: 'right' }}>
        <input
          value={editQty}
          onChange={e => setEditQty(e.target.value)}
          onBlur={commitQty}
          onKeyDown={e => e.key === 'Enter' && commitQty()}
          style={{
            background: 'none', border: 'none', outline: 'none', width: '100%',
            color: 'var(--text)', fontFamily: 'inherit', fontSize: 11,
            borderBottom: '1px dashed var(--border2)', textAlign: 'right',
          }}
          title="Click to edit qty"
        />
      </td>

      {/* Current price */}
      <td style={{ ...cell, textAlign: 'right' }}>
        {price != null
          ? <span style={{ color: 'var(--text)' }}>${price.toFixed(2)}</span>
          : <span style={{ color: 'var(--text-mute)', fontSize: 10 }}>…</span>}
      </td>

      {/* Daily P&L */}
      <td style={{ ...cell, textAlign: 'right' }}>
        {pnl != null ? (
          <div>
            <div style={{ color: pnlColor, fontWeight: 700 }}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: pnlColor }}>
              {pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : ''}
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-mute)', fontSize: 10 }}>—</span>}
      </td>

      {/* Remove */}
      <td style={{ ...cell, textAlign: 'center' }}>
        <button
          onClick={onRemove}
          style={{
            background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
            color: 'var(--red)', borderRadius: 3, padding: '3px 8px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontFamily: 'inherit', fontWeight: 600,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,77,109,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,77,109,0.08)')}
        >
          <Trash2 size={10} /> Remove
        </button>
      </td>
    </tr>
  )
}

// --- Main ---

export default function Watchlist() {
  const { items, removeItem, updateItem } = useWatchlist()

  const TH: React.CSSProperties = {
    padding: '5px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '0.07em',
    color: 'var(--text-dim)', borderBottom: '1px solid var(--border2)',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  }

  if (items.length === 0) {
    return (
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="panel-header"><TrendingUp size={11} /><span>WATCHLIST</span></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-dim)' }}>
          <TrendingUp size={28} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 12 }}>Your watchlist is empty</div>
          <div style={{ fontSize: 10, color: 'var(--text-mute)', textAlign: 'center', maxWidth: 220 }}>
            Go to a CHART or OPTIONS panel and click<br />
            <span style={{ color: 'var(--green)' }}>+ WATCHLIST</span> to add positions
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <TrendingUp size={11} />
        <span>WATCHLIST</span>
        <span style={{ color: 'var(--text-dim)' }}>{items.length} position{items.length !== 1 ? 's' : ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-mute)' }}>
          daily return · P&L refreshes every 15s
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 420 }}>
          <colgroup>
            <col style={{ width: '140px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '88px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg3)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ ...TH, textAlign: 'left' }}>SYMBOL</th>
              <th style={{ ...TH, textAlign: 'center' }}>TYPE</th>
              <th style={{ ...TH, textAlign: 'right' }}>QTY</th>
              <th style={{ ...TH, textAlign: 'right' }}>PRICE</th>
              <th style={{ ...TH, textAlign: 'right' }}>TODAY</th>
              <th style={{ ...TH, textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <Row
                key={item.id}
                item={item}
                onUpdate={patch => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        borderTop: '1px solid var(--border2)', background: 'var(--bg3)',
        padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>PORTFOLIO</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          {items.filter(i => i.type === 'stock').length} stock{items.filter(i => i.type === 'stock').length !== 1 ? 's' : ''}
          {' · '}
          {items.filter(i => i.type === 'option').length} option{items.filter(i => i.type === 'option').length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
