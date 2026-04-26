import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { calculatePnL } from '../api/client'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid, Legend,
} from 'recharts'

interface OptionRow {
  contractSymbol: string
  strike: number
  bid: number
  ask: number
  lastPrice: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

interface Props {
  ticker: string
  spot: number
  contract: OptionRow | null
  optType: 'call' | 'put'
  expiration: string
  compact?: boolean  // when true, no outer panel wrapper (OptionsView provides its own header)
}

export default function PnLCalculator({ ticker, spot, contract, optType, expiration, compact }: Props) {
  const [numContracts, setNumContracts] = useState(1)
  const [entryPrice, setEntryPrice] = useState(0)

  useEffect(() => {
    if (contract) {
      const mid = (contract.bid + contract.ask) / 2
      setEntryPrice(mid > 0 ? parseFloat(mid.toFixed(2)) : contract.lastPrice)
    }
  }, [contract?.contractSymbol])

  const payload = contract && expiration && entryPrice > 0 ? {
    opt_type:      optType,
    strike:        contract.strike,
    expiration,
    spot,
    entry_price:   entryPrice,
    num_contracts: numContracts,
    iv:            contract.iv || 0.3,
  } : null

  const { data } = useQuery({
    queryKey: ['pnl', JSON.stringify(payload)],
    queryFn:  () => calculatePnL(payload!),
    enabled:  !!payload,
    staleTime: 5_000,
  })

  const isProfitable = (data?.current_pnl ?? 0) >= 0
  const costBasis = entryPrice * numContracts * 100

  const inner = (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Left: controls + stats + greeks */}
      <div style={{
        width: 170, padding: '8px 10px', flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto',
      }}>
        {/* Contracts stepper */}
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3, letterSpacing: '0.06em' }}>CONTRACTS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setNumContracts(Math.max(1, numContracts - 1))}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3, padding: '1px 8px', fontSize: 13 }}>−</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{numContracts}</span>
            <button onClick={() => setNumContracts(numContracts + 1)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3, padding: '1px 8px', fontSize: 13 }}>+</button>
          </div>
        </div>

        {/* Entry price */}
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3, letterSpacing: '0.06em' }}>ENTRY / SHARE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 3, padding: '3px 6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>$</span>
            <input
              type="number" step="0.01" min="0"
              value={entryPrice}
              onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', width: '100%', fontSize: 11, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Stats */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'COST',      value: `$${costBasis.toFixed(2)}`,                                                   color: 'var(--text)' },
            { label: 'BREAKEVEN', value: data ? `$${data.breakeven.toFixed(2)}` : '—',                                  color: 'var(--amber)' },
            { label: 'CURR P&L',  value: data ? `${data.current_pnl >= 0 ? '+' : ''}$${data.current_pnl.toFixed(2)}` : '—', color: isProfitable ? 'var(--green)' : 'var(--red)' },
            { label: 'MAX LOSS',  value: data ? `$${data.max_loss.toFixed(2)}` : '—',                                   color: 'var(--red)' },
            { label: 'MAX PROFIT',value: data ? (data.max_profit != null ? `$${data.max_profit.toFixed(2)}` : '∞') : '—', color: 'var(--green)' },
            { label: 'DTE',       value: data ? `${data.T_remaining}d` : '—',                                           color: 'var(--text-dim)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: 'var(--text-dim)' }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Greeks */}
        {contract && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 1 }}>GREEKS</div>
            {[
              { g: 'Δ Delta',   v: contract.delta,   dec: 4 },
              { g: 'Γ Gamma',   v: contract.gamma,   dec: 4 },
              { g: 'Θ Theta',   v: contract.theta,   dec: 4 },
              { g: 'V Vega',    v: contract.vega,    dec: 4 },
              { g: 'ρ Rho',     v: contract.rho,     dec: 4 },
              { g: 'IV',        v: contract.iv * 100, dec: 1, pct: true },
            ].map(({ g, v, dec, pct }) => (
              <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'var(--text-dim)' }}>{g}</span>
                <span style={{ color: 'var(--blue)' }}>{v.toFixed(dec)}{pct ? '%' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: payoff chart */}
      <div style={{ flex: 1, padding: '6px 4px 4px', minHeight: 0 }}>
        {data ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2533" strokeDasharray="2 4" />
              <XAxis
                dataKey="price" type="number"
                domain={['dataMin', 'dataMax']}
                allowDuplicatedCategory={false}
                tick={{ fill: '#5a6a8a', fontSize: 9 }} tickLine={false}
                tickFormatter={v => `$${v.toFixed(0)}`}
              />
              <YAxis
                tick={{ fill: '#5a6a8a', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 0 ? `+$${v.toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{ background: '#161a23', border: '1px solid #1e2533', borderRadius: 4, fontSize: 11 }}
                labelFormatter={v => `Underlying: $${Number(v).toFixed(2)}`}
                formatter={(v: any, name: any) => [`${Number(v) >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`, String(name)]}
              />
              <ReferenceLine y={0} stroke="#2a3346" strokeWidth={1} />
              <ReferenceLine x={spot} stroke="#ffb347" strokeDasharray="4 2"
                label={{ value: `$${spot?.toFixed(0)}`, fill: '#ffb347', fontSize: 9, position: 'insideTopLeft' }} />
              <ReferenceLine x={data.breakeven} stroke="#4da6ff" strokeDasharray="4 2"
                label={{ value: `BE $${data.breakeven}`, fill: '#4da6ff', fontSize: 9, position: 'insideTopRight' }} />
              <Area data={data.expiry_curve} type="monotone" dataKey="pnl"
                stroke="#00d4aa" strokeWidth={2} fill="url(#gainGrad)" name="At Expiry" />
              <Area data={data.mid_curve} type="monotone" dataKey="pnl"
                stroke="#4da6ff" strokeWidth={1.5} strokeDasharray="4 2" fill="none" name="Mid-term" />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }}
                formatter={v => <span style={{ color: 'var(--text-dim)' }}>{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 11 }}>
            {entryPrice > 0 ? 'Loading…' : 'Set entry price to calculate'}
          </div>
        )}
      </div>
    </div>
  )

  if (compact) {
    return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{inner}</div>
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span>P&L CALCULATOR</span>
        {contract && (
          <>
            <span style={{ color: optType === 'call' ? 'var(--green)' : 'var(--red)' }}>
              {ticker} ${contract.strike} {optType.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>exp {expiration}</span>
          </>
        )}
      </div>
      {!contract ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
          Click any option in the chain to open P&L calculator
        </div>
      ) : inner}
    </div>
  )
}
