import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGreekHistory } from '../api/client'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts'

type Greek = 'delta' | 'gamma' | 'theta' | 'vega' | 'rho' | 'iv'
type Period = '1wk' | '1mo' | '1y'

const GREEK_COLORS: Record<Greek, string> = {
  delta: '#4da6ff',
  gamma: '#b47aff',
  theta: '#ff4d6d',
  vega:  '#ffb347',
  rho:   '#00e5ff',
  iv:    '#00d4aa',
}

const GREEK_LABELS: Record<Greek, string> = {
  delta: 'Delta (Δ)',
  gamma: 'Gamma (Γ)',
  theta: 'Theta (Θ) /day',
  vega:  'Vega (V) /1%',
  rho:   'Rho (ρ) /1%',
  iv:    'Impl. Vol',
}

interface Props {
  ticker: string
  expiration: string
  strike: number
  optType: 'call' | 'put'
}

const GREEKS: Greek[] = ['delta', 'gamma', 'theta', 'vega', 'rho', 'iv']
const PERIODS: Period[] = ['1wk', '1mo', '1y']

export default function GreekChart({ ticker, expiration, strike, optType }: Props) {
  const [greek, setGreek] = useState<Greek>('delta')
  const [period, setPeriod] = useState<Period>('1mo')

  const { data, isLoading, error } = useQuery({
    queryKey: ['greek-history', ticker, expiration, strike, optType, period],
    queryFn: () => fetchGreekHistory(ticker, expiration, strike, optType, period),
    enabled: !!expiration && !!strike,
    staleTime: 120_000,
  })

  const history = data?.history ?? []
  const color = GREEK_COLORS[greek]
  const label = GREEK_LABELS[greek]

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span>GREEK HISTORY</span>
        {expiration && (
          <span style={{ color: 'var(--text-dim)' }}>
            {ticker} ${strike} {optType.toUpperCase()} exp {expiration}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {GREEKS.map(g => (
            <button key={g} className={`tab-btn ${greek === g ? 'active' : ''}`}
              style={{ '--active-color': GREEK_COLORS[g] } as any}
              onClick={() => setGreek(g)}>
              {g === 'iv' ? 'IV' : g.charAt(0).toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          {PERIODS.map(p => (
            <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 4px 4px', minHeight: 0 }}>
        {!expiration || !strike ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 11 }}>
            Select a contract from the options chain
          </div>
        ) : isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
            Loading {label} history…
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--red)' }}>
            Error loading data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1e2533" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#5a6a8a', fontSize: 9 }}
                tickLine={false}
                tickFormatter={d => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#5a6a8a', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => greek === 'iv' ? `${(v * 100).toFixed(0)}%` : v.toFixed(3)}
              />
              <Tooltip
                contentStyle={{ background: '#161a23', border: '1px solid #1e2533', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: '#5a6a8a' }}
                itemStyle={{ color }}
                formatter={(v: any) => [
                  greek === 'iv' ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(4),
                  label,
                ]}
              />
              <ReferenceLine y={0} stroke="#2a3346" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey={greek}
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
