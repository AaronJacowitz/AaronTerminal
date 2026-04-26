import { useEffect, useMemo, useRef, useState } from 'react'
import { chatAgent, type AgentChatMessage } from '../api/client'
import { Send, Bot, User, AlertTriangle, Navigation } from 'lucide-react'

export interface NavCommand {
  view?: string
  ticker?: string
}

interface Props {
  ticker: string
  onNavigate?: (cmd: NavCommand) => void
}

// ─── NAV command parsing ───────────────────────────────────────────────────────
// Format: [NAV:view=chart|ticker=AAPL]  (each key=value pair optional)
const NAV_RE = /\[NAV:([^\]]+)\]/g

function parseNav(raw: string): NavCommand {
  const cmd: NavCommand = {}
  raw.split('|').forEach(part => {
    const [k, v] = part.split('=')
    if (k === 'view')   cmd.view   = v?.trim()
    if (k === 'ticker') cmd.ticker = v?.trim().toUpperCase()
  })
  return cmd
}

function navLabel(cmd: NavCommand): string {
  const parts: string[] = []
  if (cmd.view)   parts.push(cmd.view.toUpperCase())
  if (cmd.ticker) parts.push(cmd.ticker)
  return parts.join(' → ')
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Handles **bold**, `code`, bullet lists, and strips NAV tags from display text.
function MessageContent({ raw, onNavigate }: { raw: string; onNavigate?: (cmd: NavCommand) => void }) {
  // Split the message around NAV tags — render text segments and nav buttons
  const parts: Array<{ type: 'text'; content: string } | { type: 'nav'; cmd: NavCommand; label: string }> = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  const re = new RegExp(NAV_RE.source, 'g')
  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: raw.slice(lastIdx, match.index) })
    }
    const cmd = parseNav(match[1])
    parts.push({ type: 'nav', cmd, label: navLabel(cmd) })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < raw.length) {
    parts.push({ type: 'text', content: raw.slice(lastIdx) })
  }

  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
      {parts.map((p, i) => {
        if (p.type === 'nav') {
          return (
            <button
              key={i}
              onClick={() => onNavigate?.(p.cmd)}
              title={`Navigate: ${navLabel(p.cmd)}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.4)',
                color: 'var(--green)', borderRadius: 4, padding: '2px 8px',
                fontSize: 10, fontFamily: 'inherit', fontWeight: 700,
                letterSpacing: '0.05em', cursor: 'pointer', margin: '2px 3px',
                verticalAlign: 'middle', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,170,0.12)')}
            >
              <Navigation size={10} /> {p.label}
            </button>
          )
        }
        // Render text with basic markdown (bold, inline code, bullet lists)
        return <MarkdownText key={i} text={p.content} />
      })}
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, li) => {
        const isBullet = /^(\s*[-*•]\s)/.test(line)
        const content  = isBullet ? line.replace(/^\s*[-*•]\s/, '') : line

        return (
          <span key={li} style={{ display: isBullet ? 'flex' : 'inline', gap: 6, alignItems: 'flex-start' }}>
            {isBullet && <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }}>›</span>}
            <span>{inlineMarkdown(content)}</span>
            {li < lines.length - 1 && !isBullet && <br />}
          </span>
        )
      })}
    </>
  )
}

function inlineMarkdown(text: string): React.ReactNode[] {
  // Split on **bold** and `code` spans
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} style={{
          background: 'rgba(0,212,170,0.1)', color: 'var(--green)',
          borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace',
        }}>
          {p.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{p}</span>
  })
}

// ─── Suggested prompts shown on first load ────────────────────────────────────
const SUGGESTIONS = [
  'Explain theta decay',
  'What does IV crush mean?',
  'Best stocks this week?',
  'How do I use the options chain?',
  'What is an iron condor?',
  'Explain the yield curve',
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentChat({ ticker, onNavigate }: Props) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [mode,     setMode]     = useState<string>('unknown')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, error])

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setLoading(true)

    const next: AgentChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)

    try {
      const res = await chatAgent({ messages: next, ticker })
      const answer = (res?.answer ?? '').toString().trim() || '—'
      if (res?.mode) setMode(res.mode)
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
        : detail || e?.message || 'Agent request failed. Is the backend running?'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, letterSpacing: '0.08em', fontSize: 11 }}>
          <Bot size={13} /> AGENT
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {mode !== 'unknown' && (
            <span style={{
              fontSize: 8, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 3, fontWeight: 700,
              background: mode === 'groq' ? 'rgba(0,212,170,0.12)' : mode === 'openai' ? 'rgba(77,166,255,0.12)' : 'rgba(120,120,120,0.12)',
              color: mode === 'groq' ? 'var(--green)' : mode === 'openai' ? 'var(--blue)' : 'var(--text-mute)',
              border: `1px solid ${mode === 'groq' ? 'rgba(0,212,170,0.3)' : mode === 'openai' ? 'rgba(77,166,255,0.3)' : 'rgba(120,120,120,0.2)'}`,
            }}>
              {mode === 'groq' ? 'GROQ · LLAMA 3.3' : mode === 'openai' ? 'OPENAI' : 'NO KEY'}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-mute)' }}>CTX: {ticker}</span>
        </div>
      </div>

      {/* Message list */}
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10 }}>

        {/* Empty state */}
        {isEmpty && (
          <div style={{ padding: '12px 4px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
              Ask me anything — how the terminal works, what a metric means, options strategies, macro trends, or what to look at for <strong style={{ color: 'var(--text)' }}>{ticker}</strong>.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    color: 'var(--text-dim)', borderRadius: 5, padding: '5px 10px',
                    fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, idx) => {
          const isUser = m.role === 'user'
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
                background: isUser ? 'rgba(77,166,255,0.10)' : 'rgba(0,212,170,0.10)',
                color: isUser ? 'var(--blue)' : 'var(--green)',
              }}>
                {isUser ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div style={{
                flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 10px',
              }}>
                {isUser
                  ? <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.content}</span>
                  : <MessageContent raw={m.content} onNavigate={onNavigate} />
                }
              </div>
            </div>
          )
        })}

        {/* Thinking indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', background: 'rgba(0,212,170,0.10)', color: 'var(--green)',
            }}>
              <Bot size={12} />
            </div>
            <div style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <ThinkingDots />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,80,80,0.35)', background: 'rgba(255,80,80,0.10)', color: 'var(--red)',
            }}>
              <AlertTriangle size={12} />
            </div>
            <div style={{
              flex: 1, border: '1px solid rgba(255,80,80,0.35)', background: 'rgba(255,80,80,0.06)',
              borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--text)',
            }}>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg3)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={`Ask about ${ticker}, options, market trends…`}
            style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border2)',
              borderRadius: 6, padding: '7px 10px', color: 'var(--text)',
              fontFamily: 'inherit', fontSize: 12, outline: 'none',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!canSend}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: canSend ? 'rgba(0,212,170,0.18)' : 'rgba(0,212,170,0.07)',
              border: '1px solid rgba(0,212,170,0.35)', color: 'var(--green)',
              borderRadius: 6, padding: '7px 12px', fontSize: 11, fontFamily: 'inherit',
              fontWeight: 700, letterSpacing: '0.06em',
              cursor: canSend ? 'pointer' : 'not-allowed', flexShrink: 0,
            }}
          >
            <Send size={13} /> SEND
          </button>
        </div>
      </div>
    </div>
  )
}

// Animated thinking dots
function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 16 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--green)', opacity: 0.7,
            animation: `agentPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes agentPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </span>
  )
}
