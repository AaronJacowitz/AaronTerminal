import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { calculatePnL } from '../api/client'
import {
  ComposedChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, ReferenceDot,
  ResponsiveContainer,
} from 'recharts'

interface OptionRow {
  contractSymbol: string; strike: number
  bid: number; ask: number; lastPrice: number; iv: number
  delta: number; gamma: number; theta: number; vega: number; rho: number
}

interface Props {
  ticker: string; spot: number
  contract: OptionRow; optType: 'call' | 'put'; expiration: string
}

export default function RobinhoodPnL({ ticker, spot, contract, optType, expiration }: Props) {
  const [numContracts, setNumContracts] = useState(1)
  const [entryPrice, setEntryPrice] = useState(0)

  useEffect(() => {
    const mid = (contract.bid + contract.ask) / 2
    setEntryPrice(mid > 0 ? parseFloat(mid.toFixed(2)) : contract.lastPrice)
  }, [contract.contractSymbol])

  const payload = entryPrice > 0 ? {
    opt_type: optType, strike: contract.strike, expiration,
    spot, entry_price: entryPrice, num_contracts: numContracts,
    iv: contract.iv || 0.3,
  } : null

  const { data } = useQuery({
    queryKey: ['pnl', JSON.stringify(payload)],
    queryFn: () => calculatePnL(payload!),
    enabled: !!payload,
    staleTime: 5_000,
  })

  const isProfitable = (data?.current_pnl ?? 0) >= 0

  // Build two colored segments that meet at breakeven
  let lossSegment: { price: number; pnl: number }[] = []
  let profitSegment: { price: number; pnl: number }[] = []

  if (data?.expiry_curve?.length) {
    const curve: { price: number; pnl: number }[] = data.expiry_curve
    const be = data.breakeven
    const beIdx = curve.findIndex(p => p.price >= be)

    let leftSeg: typeof curve = []
    let rightSeg: typeof curve = []

    if (beIdx <= 0) {
      rightSeg = [{ price: be, pnl: 0 }, ...curve]
    } else if (beIdx >= curve.length) {
      leftSeg = [...curve, { price: be, pnl: 0 }]
    } else {
      leftSeg = [...curve.slice(0, beIdx), { price: be, pnl: 0 }]
      rightSeg = [{ price: be, pnl: 0 }, ...curve.slice(beIdx)]
    }

    // For calls: loss is left of BE, profit is right
    // For puts:  profit is left of BE, loss is right
    if (optType === 'call') {
      lossSegment = leftSeg
      profitSegment = rightSeg
    } else {
      profitSegment = leftSeg
      lossSegment = rightSeg
    }
  }

  const curve = data?.expiry_curve ?? []
  const xMin = curve[0]?.price ?? 0
  const xMax = curve[curve.length - 1]?.price ?? 0

  // Dot positions
  const maxLossDotX = optType === 'call' ? xMin : xMax
  const maxProfitDotY = profitSegment.length > 0
    ? (optType === 'call' ? profitSegment[profitSegment.length - 1].pnl : profitSegment[0].pnl)
    : null
  const maxProfitDotX = profitSegment.length > 0
    ? (optType === 'call' ? profitSegment[profitSegment.length - 1].price : profitSegment[0].price)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px 6px', gap: 6 }}>

      {/* Hero P&L number */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 2 }}>
          EXPECTED PROFIT & LOSS
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-mute)', marginBottom: 4 }}>
          implied P&L based on underlying share price at expiration
        </div>
        <div style={{
          fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px',
          color: isProfitable ? '#00c851' : '#ff6b35',
        }}>
          {data ? `${isProfitable ? '+' : ''}$${data.current_pnl.toFixed(2)}` : '—'}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
          <span style={{ color: 'var(--text-dim)' }}>CONTRACTS</span>
          <button onClick={() => setNumContracts(Math.max(1, numContracts - 1))}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3, padding: '1px 8px', fontFamily: 'inherit', cursor: 'pointer' }}>−</button>
          <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{numContracts}</span>
          <button onClick={() => setNumContracts(numContracts + 1)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3, padding: '1px 8px', fontFamily: 'inherit', cursor: 'pointer' }}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
          <span style={{ color: 'var(--text-dim)' }}>ENTRY</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 6px' }}>
            <span style={{ color: 'var(--text-dim)' }}>$</span>
            <input type="number" step="0.01" min="0" value={entryPrice}
              onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', width: 55, fontSize: 10, fontFamily: 'inherit' }} />
          </div>
        </div>
      </div>

      {/* "Price Now" label — top right of chart area */}
      {data && (
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, paddingRight: 4 }}>
          {ticker} Price Now&nbsp;
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>${spot.toFixed(2)}</span>
        </div>
      )}

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {data && curve.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>

              {/* X axis — no ticks, just for scale */}
              <XAxis
                dataKey="price" type="number"
                domain={[xMin, xMax]}
                tick={false} axisLine={false} tickLine={false}
                allowDuplicatedCategory={false}
              />
              <YAxis
                tick={false} axisLine={false} tickLine={false}
                domain={['auto', 'auto']}
              />

              {/* Loss segment (orange) */}
              {lossSegment.length > 1 && (
                <Area
                  data={lossSegment}
                  dataKey="pnl" type="linear"
                  stroke="#ff6b35" strokeWidth={2.5}
                  fill="rgba(255,107,53,0.18)"
                  dot={false} activeDot={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}

              {/* Profit segment (green) */}
              {profitSegment.length > 1 && (
                <Area
                  data={profitSegment}
                  dataKey="pnl" type="linear"
                  stroke="#00c851" strokeWidth={2.5}
                  fill="rgba(0,200,81,0.18)"
                  dot={false} activeDot={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}

              {/* Zero line */}
              <ReferenceLine y={0} stroke="var(--text)" strokeWidth={1.5} />

              {/* Max loss dotted line */}
              {data.max_loss !== undefined && (
                <ReferenceLine
                  y={data.max_loss}
                  stroke="#ff6b35" strokeDasharray="5 4" strokeWidth={1}
                />
              )}

              {/* Current spot vertical */}
              <ReferenceLine
                x={spot}
                stroke="var(--text)" strokeWidth={1.5}
              />

              {/* Dots */}
              {/* Max Loss */}
              <ReferenceDot
                x={maxLossDotX} y={data.max_loss}
                r={5} fill="#ff6b35" stroke="var(--bg2)" strokeWidth={2}
              />
              {/* Breakeven */}
              <ReferenceDot
                x={data.breakeven} y={0}
                r={5} fill="var(--text)" stroke="var(--bg2)" strokeWidth={2}
              />
              {/* Max Profit */}
              {maxProfitDotX !== null && maxProfitDotY !== null && (
                <ReferenceDot
                  x={maxProfitDotX} y={maxProfitDotY}
                  r={5} fill="#00c851" stroke="var(--bg2)" strokeWidth={2}
                />
              )}

              <Tooltip
                contentStyle={{ background: '#161a23', border: '1px solid #1e2533', borderRadius: 4, fontSize: 10 }}
                labelFormatter={v => `${ticker} @ $${Number(v).toFixed(2)}`}
                formatter={(v: any) => [`${Number(v) >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`, 'P&L']}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 11 }}>
            {entryPrice > 0 ? 'Calculating…' : 'Set entry price'}
          </div>
        )}
      </div>

      {/* Legend */}
      {data && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 10, flexShrink: 0 }}>
          {[
            { label: 'Max Loss',   value: `$${data.max_loss.toFixed(2)}`,                                 color: '#ff6b35' },
            { label: 'Breakeven',  value: `$${data.breakeven.toFixed(2)}`,                                color: 'var(--text)' },
            { label: 'Max Profit', value: data.max_profit != null ? `$${data.max_profit.toFixed(2)}` : '∞', color: '#00c851' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-dim)' }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
