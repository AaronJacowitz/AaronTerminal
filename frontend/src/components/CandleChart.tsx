import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createChart, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { fetchCandles } from '../api/client'
import StockMetrics from './StockMetrics'

const INTERVALS = ['1D', '1W', '1M', '1Y', '5Y', 'MAX'] as const
type Interval = typeof INTERVALS[number]

// tickMarkType values from lightweight-charts:
// 0 = Year, 1 = Month, 2 = DayOfMonth, 3 = Time, 4 = TimeWithSeconds
function makeTickFormatter(iv: Interval) {
  return (time: number, tickMarkType: number) => {
    const d    = new Date(time * 1000)
    const now  = new Date()
    const sameYear = d.getFullYear() === now.getFullYear()
    const yr   = d.getFullYear()
    const yrS  = `'${String(yr).slice(2)}`           // e.g. '24
    const mo   = d.toLocaleString('en-US', { month: 'short' })
    const day  = d.getDate()
    const dow  = d.toLocaleString('en-US', { weekday: 'short' })
    const hh   = d.getHours().toString().padStart(2, '0')
    const mm   = d.getMinutes().toString().padStart(2, '0')
    const time_ = `${hh}:${mm}`

    switch (iv) {
      case '1D':
        // 2-min candles: only need time labels
        return time_

      case '1W':
        // 15-min candles: Time ticks = HH:MM, Day ticks = "Mon Apr 21"
        if (tickMarkType >= 3) return time_
        if (tickMarkType === 2) return sameYear ? `${dow} ${mo} ${day}` : `${dow} ${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYear ? mo : `${mo} ${yrS}`
        return String(yr)

      case '1M':
        // 1h candles: Day ticks = "Apr 15" or "Apr 15 '24"
        if (tickMarkType >= 3) return time_
        if (tickMarkType === 2) return sameYear ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYear ? mo : `${mo} ${yrS}`
        return String(yr)

      case '1Y':
        // Daily candles: "Apr 21" or "Dec 25 '24" for cross-year dates
        if (tickMarkType === 2) return sameYear ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYear ? mo : `${mo} ${yrS}`
        return String(yr)

      case '5Y':
      case 'MAX':
        // Weekly/monthly: "Apr '24" style, year tick = full year
        if (tickMarkType >= 2) return sameYear ? `${mo} ${day}` : `${mo} ${day} ${yrS}`
        if (tickMarkType === 1) return sameYear ? mo : `${mo} ${yrS}`
        return String(yr)
    }
  }
}

interface Props { ticker: string }

export default function CandleChart({ ticker }: Props) {
  const [interval, setInterval] = useState<Interval>('1Y')
  const intervalRef = useRef<Interval>('1Y')   // always current, safe inside callbacks
  const chartRef    = useRef<HTMLDivElement>(null)
  const chartInst   = useRef<ReturnType<typeof createChart> | null>(null)
  const candleSer   = useRef<any>(null)
  const volSer      = useRef<any>(null)

  // Keep ref in sync with state
  useEffect(() => { intervalRef.current = interval }, [interval])

  const { data, isLoading } = useQuery({
    queryKey: ['candles', ticker, interval],
    queryFn:  () => fetchCandles(ticker, interval),
    refetchInterval: interval === '1D' ? 60_000 : interval === '1W' ? 120_000 : 300_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      layout:      { background: { color: '#0f1117' }, textColor: '#8a9bb8' },
      grid:        { vertLines: { color: '#1e2533' }, horzLines: { color: '#1e2533' } },
      crosshair:   { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e2533' },
      timeScale: {
        borderColor: '#1e2533',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: makeTickFormatter(interval),
      },
      width:  chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
    })

    const cs = chart.addSeries(CandlestickSeries, {
      upColor:         '#00d4aa',
      downColor:       '#ff4d6d',
      borderUpColor:   '#00d4aa',
      borderDownColor: '#ff4d6d',
      wickUpColor:     '#00d4aa',
      wickDownColor:   '#ff4d6d',
    })

    const vs = chart.addSeries(HistogramSeries, {
      color:        '#2a3346',
      priceFormat:  { type: 'volume' as const },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartInst.current = chart
    candleSer.current = cs
    volSer.current    = vs

    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({
          width:  chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
          timeScale: { tickMarkFormatter: makeTickFormatter(intervalRef.current) },
        })
      }
    })
    ro.observe(chartRef.current)
    return () => { ro.disconnect(); chart.remove() }
  }, [])

  // Re-apply formatter when interval changes so labels stay in sync
  useEffect(() => {
    if (!chartInst.current) return
    chartInst.current.applyOptions({
      timeScale: { tickMarkFormatter: makeTickFormatter(interval) },
    })
  }, [interval])

  useEffect(() => {
    if (!data?.candles || !candleSer.current || !volSer.current) return
    const sorted = [...data.candles].sort((a: any, b: any) => a.time - b.time)
    candleSer.current.setData(sorted)
    volSer.current.setData(
      sorted.map((c: any) => ({
        time:  c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0,212,170,0.4)' : 'rgba(255,77,109,0.4)',
      }))
    )
    chartInst.current?.timeScale().fitContent()
  }, [data])

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
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', zIndex: 10, background: 'var(--bg2)' }}>
            Loading {ticker} {interval}…
          </div>
        )}
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <StockMetrics ticker={ticker} />
    </div>
  )
}
