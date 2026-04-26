import { Activity } from 'lucide-react'

interface Props {
  onSelect: (mode: 'stocks') => void
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

      {/* Card */}
      <button
        onClick={() => onSelect('stocks')}
        style={{
          width: 280, padding: '36px 32px', cursor: 'pointer',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)'
          e.currentTarget.style.background   = 'rgba(0,212,170,0.04)'
          e.currentTarget.style.transform    = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background   = 'var(--bg2)'
          e.currentTarget.style.transform    = 'translateY(0)'
        }}
      >
        <Activity size={28} style={{ color: 'var(--green)', marginBottom: 16 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Stocks & Options
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Live charts, options chains, Greeks, P&L modeling, watchlist tracking, and AI agent
        </div>
        <div style={{ marginTop: 20, fontSize: 10, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.08em' }}>
          OPEN TERMINAL →
        </div>
      </button>

      <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
        POWERED BY YFINANCE · POLYGON · GROQ
      </div>
    </div>
  )
}
