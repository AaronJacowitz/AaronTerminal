import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchExpirations, fetchChain } from '../api/client'

interface OptionRow {
  contractSymbol: string
  strike: number
  bid: number
  ask: number
  lastPrice: number
  volume: number
  openInterest: number
  inTheMoney: boolean
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  iv: number
}

interface Props {
  ticker: string
  spot: number
  onSelectContract: (row: OptionRow, type: 'call' | 'put', expiration: string) => void
}

function fmt(n: number, dec = 2) { return n?.toFixed(dec) ?? '—' }
function fmtVol(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v) }

const TH: React.CSSProperties = {
  padding: '4px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border2)',
  textAlign: 'right', whiteSpace: 'nowrap',
}

function OptionCell({ children, itm, onClick }: { children: React.ReactNode; itm: boolean; onClick: () => void }) {
  return (
    <td
      onClick={onClick}
      style={{ padding: '2px 6px', fontSize: 11, textAlign: 'right', cursor: 'pointer',
               color: itm ? 'var(--green)' : 'var(--text-dim)' }}
    >
      {children}
    </td>
  )
}

function ChainRow({ call, put, strike, spot, onSelect }: {
  call: OptionRow; put: OptionRow; strike: number; spot: number
  onSelect: (row: OptionRow, type: 'call' | 'put') => void
}) {
  const atm = Math.abs(strike - spot) / spot < 0.005
  const sel = (type: 'call' | 'put') => onSelect(type === 'call' ? call : put, type)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', background: atm ? 'rgba(0,212,170,0.04)' : undefined }}>
      {/* CALLS */}
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>${fmt(call.bid)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>${fmt(call.ask)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>${fmt(call.lastPrice)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmtVol(call.volume)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmtVol(call.openInterest)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.iv * 100, 1)}%</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.delta, 3)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.gamma, 4)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.theta, 4)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.vega, 4)}</OptionCell>
      <OptionCell itm={call.inTheMoney} onClick={() => sel('call')}>{fmt(call.rho, 4)}</OptionCell>

      {/* STRIKE */}
      <td style={{
        padding: '2px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11,
        color: atm ? 'var(--amber)' : 'var(--text)',
        background: 'var(--bg3)',
        borderLeft: '1px solid var(--border2)', borderRight: '1px solid var(--border2)',
        whiteSpace: 'nowrap',
      }}>
        {atm && <span style={{ color: 'var(--amber)', marginRight: 3 }}>▶</span>}
        ${strike}
      </td>

      {/* PUTS */}
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>${fmt(put.bid)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>${fmt(put.ask)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>${fmt(put.lastPrice)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmtVol(put.volume)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmtVol(put.openInterest)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.iv * 100, 1)}%</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.delta, 3)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.gamma, 4)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.theta, 4)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.vega, 4)}</OptionCell>
      <OptionCell itm={put.inTheMoney} onClick={() => sel('put')}>{fmt(put.rho, 4)}</OptionCell>
    </tr>
  )
}

export default function OptionsChain({ ticker, spot, onSelectContract }: Props) {
  const [expiration, setExpiration] = useState<string>('')

  const { data: expData } = useQuery({
    queryKey: ['expirations', ticker],
    queryFn: () => fetchExpirations(ticker),
  })

  useEffect(() => {
    if (!expiration && expData?.expirations?.length) {
      setExpiration(expData.expirations[0])
    }
  }, [expData, expiration])

  const { data: chainData, isLoading } = useQuery({
    queryKey: ['chain', ticker, expiration],
    queryFn: () => fetchChain(ticker, expiration),
    enabled: !!expiration,
    staleTime: 60_000,
  })

  const strikes: number[] = []
  const callMap: Record<number, OptionRow> = {}
  const putMap:  Record<number, OptionRow> = {}

  if (chainData) {
    const allStrikes = new Set<number>()
    chainData.calls.forEach((r: OptionRow) => { allStrikes.add(r.strike); callMap[r.strike] = r })
    chainData.puts.forEach((r: OptionRow)  => { allStrikes.add(r.strike); putMap[r.strike]  = r })
    strikes.push(...Array.from(allStrikes).sort((a, b) => a - b))
  }

  const CALL_COLS = ['BID', 'ASK', 'LAST', 'VOL', 'OI', 'IV%', 'Δ', 'Γ', 'Θ', 'V', 'RHO']

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span>OPTIONS CHAIN</span>
        <span style={{ color: 'var(--blue)' }}>{ticker}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>SPOT ${spot?.toFixed(2)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {expData?.expirations?.slice(0, 14).map((e: string) => (
            <button key={e} className={`tab-btn ${expiration === e ? 'active' : ''}`} onClick={() => setExpiration(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        {isLoading && (
          <div style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>Loading chain for {expiration}…</div>
        )}
        {!isLoading && strikes.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th colSpan={11} style={{ ...TH, textAlign: 'center', color: 'var(--green)' }}>— CALLS —</th>
                <th style={{ ...TH, textAlign: 'center', color: 'var(--amber)' }}>STRIKE</th>
                <th colSpan={11} style={{ ...TH, textAlign: 'center', color: 'var(--red)' }}>— PUTS —</th>
              </tr>
              <tr style={{ background: 'var(--bg3)', position: 'sticky', top: 24, zIndex: 1 }}>
                {CALL_COLS.map(c => <th key={`ch-${c}`} style={TH}>{c}</th>)}
                <th style={{ ...TH, textAlign: 'center' }}>$</th>
                {CALL_COLS.map(c => <th key={`ph-${c}`} style={TH}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {strikes.map(strike => {
                const call = callMap[strike]
                const put  = putMap[strike]
                if (!call || !put) return null
                return (
                  <ChainRow
                    key={strike}
                    call={call} put={put}
                    strike={strike} spot={spot}
                    onSelect={(row, type) => onSelectContract(row, type, expiration)}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
