import { useMemo, useState } from 'react'
import { Activity, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmMismatch = mode === 'signup' && confirm.length > 0 && confirm !== password

  const canSubmit = useMemo(() => {
    const e = email.trim()
    const p = password
    if (!e || !p) return false
    if (mode === 'signup') {
      if (username.trim().length < 3) return false
      if (p !== confirm) return false
    }
    return true
  }, [email, password, confirm, username, mode])

  const submit = async () => {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signin') await signIn(email.trim(), password)
      else await signUp(username.trim(), email.trim(), password)
    } catch (e: any) {
      console.error('Auth error:', e?.response?.status, JSON.stringify(e?.response?.data))
      const detail = e?.response?.data?.detail
      let msg: string
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d?.msg || d?.message || JSON.stringify(d)).join('; ')
      } else {
        msg = detail || e?.message || 'Authentication failed'
      }
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6,
    padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 700, letterSpacing: '0.08em',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{
        width: 420, maxWidth: '92vw',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 14px 40px rgba(0,0,0,0.55)',
      }}>
        <div style={{ padding: '14px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontWeight: 800, letterSpacing: '0.12em', fontSize: 11 }}>
            <Activity size={14} /> AARON TERMINAL
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              onClick={() => switchMode('signin')}
              className={`tab-btn ${mode === 'signin' ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: 10 }}
            >
              SIGN IN
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: 10 }}
            >
              CREATE ACCOUNT
            </button>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 10 }}>
              <div style={labelStyle}>USERNAME</div>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. aaron"
                autoComplete="username"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>EMAIL</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: mode === 'signup' ? 10 : 12 }}>
            <div style={labelStyle}>PASSWORD</div>
            <div style={{ position: 'relative' }}>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', display: 'flex', alignItems: 'center', padding: 0,
                }}
              >
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...labelStyle, color: confirmMismatch ? 'var(--red)' : 'var(--text-dim)' }}>
                CONFIRM PASSWORD{confirmMismatch ? ' — PASSWORDS DO NOT MATCH' : ''}
              </div>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ ...inputStyle, borderColor: confirmMismatch ? 'var(--red)' : 'var(--border2)' }}
              />
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: 6, fontSize: 11, color: 'var(--red)', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit || loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 12px',
              background: 'rgba(0,212,170,0.18)',
              border: '1px solid rgba(0,212,170,0.45)',
              color: 'var(--green)',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontWeight: 800,
              letterSpacing: '0.10em',
              cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
              opacity: !canSubmit || loading ? 0.6 : 1,
            }}
          >
            {mode === 'signin' ? <LogIn size={14} /> : <UserPlus size={14} />}
            {loading ? 'PLEASE WAIT…' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>

          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-mute)', lineHeight: 1.4 }}>
            Your watchlist is saved to your account so different users can keep separate lists.
          </div>
        </div>
      </div>
    </div>
  )
}
