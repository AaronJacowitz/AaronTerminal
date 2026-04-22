import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchQuote } from '../api/client'
import { Search, Activity } from 'lucide-react'

interface Props {
  ticker: string
  onTickerChange: (t: string) => void
}

export default function TickerBar({ ticker, onTickerChange }: Props) {
  const [input, setInput] = useState(ticker)
  const { data, isFetching } = useQuery({
    queryKey: ['quote', ticker],
    queryFn: () => fetchQuote(ticker),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const submit = () => {
    const t = input.trim().toUpperCase()
    if (t) onTickerChange(t)
  }

  const up = data ? data.change >= 0 : null

  return (
    <div style={{
      background: 'var(--bg3)',
      borderBottom: '1px solid var(--border)',
      padding: '6px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', minWidth: 140 }}>
        <Activity size={14} />
        AARON TERMINAL
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '3px 8px' }}>
        <Search size={11} style={{ color: 'var(--text-dim)' }} />
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="TICKER"
          style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', width: 80, fontSize: 12 }}
        />
        <button onClick={submit} style={{ background: 'var(--border2)', border: 'none', color: 'var(--text)', borderRadius: 3, padding: '2px 8px', fontSize: 10 }}>GO</button>
      </div>

      {/* Quote */}
      {data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{data.ticker}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: up ? 'var(--green)' : 'var(--red)' }}>
            ${data.price?.toFixed(2)}
          </span>
          <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>
            {up ? '+' : ''}{data.change?.toFixed(2)} ({up ? '+' : ''}{data.change_pct?.toFixed(2)}%)
          </span>
          <div style={{ display: 'flex', gap: 16, color: 'var(--text-dim)', fontSize: 11 }}>
            <span>O <span style={{ color: 'var(--text)' }}>${data.open?.toFixed(2)}</span></span>
            <span>H <span style={{ color: 'var(--green)' }}>${data.high?.toFixed(2)}</span></span>
            <span>L <span style={{ color: 'var(--red)' }}>${data.low?.toFixed(2)}</span></span>
            <span>PC <span style={{ color: 'var(--text)' }}>${data.prev_close?.toFixed(2)}</span></span>
            <span>VOL <span style={{ color: 'var(--amber)' }}>{(data.volume / 1e6).toFixed(2)}M</span></span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-mute)', fontSize: 10 }}>
            {isFetching && <span style={{ color: 'var(--cyan)' }}>●</span>}
            <span>via {data.source}</span>
          </div>
        </div>
      )}
    </div>
  )
}
