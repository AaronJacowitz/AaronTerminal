import { Activity, Home } from 'lucide-react'

interface Props {
  onSelect: (mode: 'stocks' | 'realestate') => void
}

export default function LandingPage({ onSelect }: Props) {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 48,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 8 }}>
          AARON TERMINAL
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
          What are you analyzing today?
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Stocks card */}
        <button
          onClick={() => onSelect('stocks')}
          style={{
            width: 240, padding: '32px 28px', cursor: 'pointer',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(0,212,170,0.5)'
            el.style.background = 'rgba(0,212,170,0.04)'
            el.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--border)'
            el.style.background = 'var(--bg2)'
            el.style.transform = 'translateY(0)'
          }}
        >
          <Activity size={28} style={{ color: 'var(--green)', marginBottom: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Stocks & Options
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Live charts, options chains, Greeks, P&L modeling, and watchlist tracking
          </div>
          <div style={{
            marginTop: 20, fontSize: 10, fontWeight: 600, color: 'var(--green)',
            letterSpacing: '0.08em',
          }}>
            OPEN TERMINAL →
          </div>
        </button>

        {/* Real Estate card */}
        <button
          onClick={() => onSelect('realestate')}
          style={{
            width: 240, padding: '32px 28px', cursor: 'pointer',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(77,166,255,0.5)'
            el.style.background = 'rgba(77,166,255,0.04)'
            el.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--border)'
            el.style.background = 'var(--bg2)'
            el.style.transform = 'translateY(0)'
          }}
        >
          <Home size={28} style={{ color: 'var(--blue)', marginBottom: 16 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Real Estate
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Browse active listings with rental estimates, mortgage payments, yields, and cash flow analysis
          </div>
          <div style={{
            marginTop: 20, fontSize: 10, fontWeight: 600, color: 'var(--blue)',
            letterSpacing: '0.08em',
          }}>
            OPEN TERMINAL →
          </div>
        </button>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
        POWERED BY YFINANCE · POLYGON · RENTCAST
      </div>
    </div>
  )
}
