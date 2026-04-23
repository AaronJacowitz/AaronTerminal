import { useState, useRef, useEffect } from 'react'
import { Bell, ExternalLink, Trash2 } from 'lucide-react'
import type { NewsNotif } from '../hooks/useNewsNotifications'

interface Props {
  notifications: NewsNotif[]
  unread: number
  onOpen: () => void
  onClear: () => void
}

function timeAgo(published: string) {
  try {
    const diff = Date.now() - new Date(published).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return '' }
}

export default function NewsNotificationBell({ notifications, unread, onOpen, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const toggle = () => {
    setOpen(o => !o)
    if (!open) onOpen()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="News alerts"
        style={{
          background: open ? 'rgba(0,212,170,0.1)' : 'none',
          border: open ? '1px solid rgba(0,212,170,0.3)' : '1px solid transparent',
          color: unread > 0 ? 'var(--green)' : 'var(--text-dim)',
          borderRadius: 3, padding: '3px 8px',
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
          position: 'relative', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.color = unread > 0 ? 'var(--green)' : 'var(--text-dim)' }}
      >
        <Bell size={11} />
        {unread > 0 && (
          <span style={{
            background: 'var(--green)', color: '#000',
            borderRadius: '50%', fontSize: 8, fontWeight: 700,
            width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'absolute', top: -5, right: -5,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, maxHeight: 420, overflowY: 'auto',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 6, zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--bg2)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
              NEWS ALERTS
            </span>
            {notifications.length > 0 && (
              <button
                onClick={() => { onClear(); setOpen(false) }}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-mute)',
                  cursor: 'pointer', padding: 0, display: 'flex', gap: 4,
                  alignItems: 'center', fontSize: 9, fontFamily: 'inherit',
                }}
              >
                <Trash2 size={9} /> CLEAR ALL
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-mute)', fontSize: 11 }}>
              No new headlines yet
              <div style={{ fontSize: 9, marginTop: 4 }}>Checks for new articles every 5 min</div>
            </div>
          ) : (
            notifications.map(n => (
              <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
                      {n.title}
                    </span>
                    <ExternalLink size={8} style={{ color: 'var(--text-mute)', flexShrink: 0, marginTop: 2 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9 }}>
                    <span style={{
                      background: 'rgba(0,212,170,0.15)', color: 'var(--green)',
                      padding: '1px 5px', borderRadius: 2, fontWeight: 700,
                    }}>
                      {n.ticker}
                    </span>
                    <span style={{ color: 'var(--blue)' }}>{n.source}</span>
                    <span style={{ color: 'var(--text-mute)' }}>{timeAgo(n.published)}</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  )
}
