import { useEffect, useMemo, useRef, useState } from 'react'
import { chatAgent, type AgentChatMessage } from '../api/client'
import { Send, Bot, User, AlertTriangle } from 'lucide-react'

export default function AgentChat({ ticker }: { ticker: string }) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Ask me anything about this terminal (features, metrics, how to analyze them) or the market lately. Example: “What does short ratio mean?” or “Best performing stocks this week?”',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, loading, error])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setLoading(true)

    const next: AgentChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)

    try {
      const res = await chatAgent({ messages: next, ticker })
      const answer = (res?.answer ?? '').toString().trim() || '—'
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        'Agent request failed. Is the backend running and OPENAI_API_KEY set?'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
      <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 700, letterSpacing: '0.08em', fontSize: 11 }}>
            <Bot size={14} /> AGENT
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-mute)', whiteSpace: 'nowrap' }}>
            CONTEXT: {ticker}
          </div>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user'
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)',
                  background: isUser ? 'rgba(77,166,255,0.10)' : 'rgba(0,212,170,0.10)',
                  color: isUser ? 'var(--blue)' : 'var(--green)',
                  flexShrink: 0,
                }}
              >
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  color: 'var(--text)',
                  fontSize: 12,
                  lineHeight: 1.35,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            </div>
          )
        })}

        {error && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,80,80,0.35)',
                background: 'rgba(255,80,80,0.10)',
                color: 'var(--red)',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={14} />
            </div>
            <div style={{ flex: 1, border: '1px solid rgba(255,80,80,0.35)', background: 'rgba(255,80,80,0.06)', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--text)' }}>
              {error}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask about metrics, features, or the market…"
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border2)',
              borderRadius: 6,
              padding: '8px 10px',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={!canSend}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: canSend ? 'rgba(0,212,170,0.18)' : 'rgba(0,212,170,0.08)',
              border: '1px solid rgba(0,212,170,0.35)',
              color: 'var(--green)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            title={canSend ? 'Send' : 'Type a question first'}
          >
            <Send size={14} /> SEND
          </button>
        </div>
        {loading && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-mute)' }}>Thinking…</div>}
      </div>
    </div>
  )
}

