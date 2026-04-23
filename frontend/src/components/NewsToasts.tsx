import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import type { NewsNotif } from '../hooks/useNewsNotifications'

interface Props {
  toasts: NewsNotif[]
  onDismiss: (id: string) => void
}

export default function NewsToasts({ toasts, onDismiss }: Props) {
  // Auto-dismiss each toast after 7 seconds
  useEffect(() => {
    if (toasts.length === 0) return
    const newest = toasts[toasts.length - 1]
    const timer = setTimeout(() => onDismiss(newest.id), 7_000)
    return () => clearTimeout(timer)
  }, [toasts.length])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 320, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--green)',
            borderRadius: 6, padding: '10px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            pointerEvents: 'all',
            animation: 'toastIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                <span style={{
                  background: 'rgba(0,212,170,0.15)', color: 'var(--green)',
                  padding: '1px 5px', borderRadius: 2, fontSize: 9, fontWeight: 700,
                }}>
                  {t.ticker}
                </span>
                <span style={{ fontSize: 9, color: 'var(--blue)' }}>{t.source}</span>
              </div>
              <a href={t.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{
                  fontSize: 10, color: 'var(--text)', fontWeight: 500,
                  lineHeight: 1.4, display: 'flex', gap: 5, alignItems: 'flex-start',
                }}>
                  <span style={{ flex: 1 }}>
                    {t.title.length > 100 ? t.title.slice(0, 100) + '…' : t.title}
                  </span>
                  <ExternalLink size={8} style={{ color: 'var(--text-mute)', flexShrink: 0, marginTop: 2 }} />
                </div>
              </a>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-mute)',
                cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0,
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
