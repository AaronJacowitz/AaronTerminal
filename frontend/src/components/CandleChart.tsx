import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createChart, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { fetchCandles } from '../api/client'
import StockMetrics from './StockMetrics'

const INTERVALS = ['1D', '1W', '1M', '1Y', '5Y', 'MAX'] as const
type Interval = typeof INTERVALS[number]

export type PeriodChange = { change: number; pct: number; interval: Interval }

function makeTickFormatter(iv: Interval) {
  return (time: number, tickMarkType: number) => {
    const d       = new Date(time * 1000)
    const now     = new Date()
    const sameYr  = d.getFullYear() === now.getFullYear()
    const yr      = d.getFullYear()
    const yrS     = `'${String(yr).slice(2)}`
    const mo      = d.toLocaleString('en-US', { month: 'short' })
    const day     = d.getDate()
    const dow     = d.toLocaleString('en-US', { weekday: 'short' })
    const hh      = d.getHours().toString().padStart(2, '0')
    const mm      = d.getMinutes().toString().padStart(2, '0')
    const t       = `${hh}:${mm}`

    switch (iv) {
      case '1D': return t
      case '1W':
        if (tickMarkType >= 3) return t
        if (tickMarkType === 2) return sameYr ? `${dow} ${mo} ${day}` : `${dow} ${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYr ? mo : `${mo} ${yrS}`
        return String(yr)
      case '1M':
        if (tickMarkType >= 3) return t
        if (tickMarkType === 2) return sameYr ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYr ? mo : `${mo} ${yrS}`
        return String(yr)
      case '1Y':
        if (tickMarkType === 2) return sameYr ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYr ? mo : `${mo} ${yrS}`
        return String(yr)
      case '5Y':
      case 'MAX':
        if (tickMarkType >= 2) return sameYr ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYr ? mo : `${mo} ${yrS}`
        return String(yr)
    }
  }
}

interface Props {
  ticker: string
  onPeriodChange?: (pc: PeriodChange | null) => void
}

export default function CandleChart({ ticker, onPeriodChange }: Props) {
  const [interval, setInterval] = useState<Interval>('1D')

  // Stable refs — safe inside callbacks without stale closure issues
  const intervalRef       = useRef<Interval>('1D')
  const onPeriodChangeRef = useRef(onPeriodChange)
  const chartRef          = useRef<HTMLDivElement>(null)
  const chartInst         = useRef<ReturnType<typeof createChart> | null>(null)
  const candleSer         = useRef<any>(null)
  const volSer            = useRef<any>(null)
  // Holds the latest fetched data so the deferred chart-init can render it immediately
  const latestData        = useRef<any>(null)

  useEffect(() => { intervalRef.current = interval }, [interval])
  useEffect(() => { onPeriodChangeRef.current = onPeriodChange }, [onPeriodChange])

  const { data, isLoading } = useQuery({
    queryKey: ['candles', ticker, interval],
    queryFn:  () => fetchCandles(ticker, interval),
    refetchInterval: interval === '1D' ? 60_000 : interval === '1W' ? 120_000 : 300_000,
    staleTime: 30_000,
  })

  // ─── Chart creation ────────────────────────────────────────────────────────
  // Defer by one rAF so react-resizable-panels finishes distributing flex
  // widths before we snapshot dimensions. The ResizeObserver handles all
  // future resizes (drag, add/remove panel, window resize).
  useEffect(() => {
    if (!chartRef.current) return
    const el = chartRef.current
    let ro: ResizeObserver | null = null
    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>

    const rafId = requestAnimationFrame(() => {
      if (!el) return

      const rect = el.getBoundingClientRect()
      const w = Math.max(rect.width,  50)
      const h = Math.max(rect.height, 50)

      const chart = createChart(el, {
        width:  w,
        height: h,
        layout:      { background: { color: '#0f1117' }, textColor: '#8a9bb8' },
        grid:        { vertLines: { color: '#1e2533' }, horzLines: { color: '#1e2533' } },
        crosshair:   { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#1e2533' },
        timeScale: {
          borderColor: '#1e2533', timeVisible: true, secondsVisible: false,
          tickMarkFormatter: makeTickFormatter(intervalRef.current),
        },
      })

      const cs = chart.addSeries(CandlestickSeries, {
        upColor: '#00d4aa', downColor: '#ff4d6d',
        borderUpColor: '#00d4aa', borderDownColor: '#ff4d6d',
        wickUpColor: '#00d4aa', wickDownColor: '#ff4d6d',
      })
      const vs = chart.addSeries(HistogramSeries, {
        color: '#2a3346', priceFormat: { type: 'volume' as const }, priceScaleId: 'vol',
      })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

      chartInst.current = chart
      candleSer.current = cs
      volSer.current    = vs

      // Apply correct size (getBoundingClientRect is always accurate post-layout)
      const applySize = () => {
        if (!chartInst.current) return
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          chartInst.current.applyOptions({ width: r.width, height: r.height })
        }
      }

      ro = new ResizeObserver(applySize)
      ro.observe(el)

      // Belt-and-suspenders retries for async flex layout settling
      t1 = setTimeout(applySize, 100)
      t2 = setTimeout(applySize, 400)

      // If data was already fetched (React Query cache hit), render it now
      if (latestData.current?.candles) {
        renderCandles(latestData.current, cs, vs, chart)
      }
    })

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(t1)
      clearTimeout(t2)
      ro?.disconnect()
      chartInst.current?.remove()
      chartInst.current = null
      candleSer.current = null
      volSer.current    = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tick formatter update when interval changes ──────────────────────────
  useEffect(() => {
    chartInst.current?.applyOptions({
      timeScale: { tickMarkFormatter: makeTickFormatter(interval) },
    })
  }, [interval])

  // ─── Data rendering ───────────────────────────────────────────────────────
  function renderCandles(
    d: any,
    cs = candleSer.current,
    vs = volSer.current,
    chart = chartInst.current,
  ) {
    if (!cs || !vs || !chart || !d?.candles) return
    const sorted = [...d.candles].sort((a: any, b: any) => a.time - b.time)
    cs.setData(sorted)
    vs.setData(sorted.map((c: any) => ({
      time:  c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,77,109,0.4)',
    })))
    chart.timeScale().fitContent()

    if (sorted.length >= 2) {
      const change = sorted[sorted.length - 1].close - sorted[0].open
      const pct    = (change / sorted[0].open) * 100
      onPeriodChangeRef.current?.({ change, pct, interval: intervalRef.current })
    }
  }

  useEffect(() => {
    latestData.current = data ?? null
    if (!data?.candles) {
      onPeriodChangeRef.current?.(null)
      return
    }
    renderCandles(data)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <span>PRICE CHART</span>
        <span style={{ color: 'var(--blue)' }}>{ticker}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {INTERVALS.map(iv => (
            <button key={iv} className={`tab-btn ${interval === iv ? 'active' : ''}`} onClick={() => setInterval(iv)}>
              {iv}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-dim)', zIndex: 10, background: 'var(--bg2)',
          }}>
            Loading {ticker} {interval}…
          </div>
        )}
        <div ref={chartRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      <StockMetrics ticker={ticker} />
    </div>
  )
}
