import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

export const fetchQuote = (ticker: string) =>
  api.get(`/quotes/${ticker}`).then(r => r.data)

export const fetchCandles = (ticker: string, interval: string) =>
  api.get(`/candles/${ticker}`, { params: { interval } }).then(r => r.data)

export const fetchExpirations = (ticker: string) =>
  api.get(`/options/${ticker}/expirations`).then(r => r.data)

export const fetchChain = (ticker: string, expiration: string) =>
  api.get(`/options/${ticker}/chain`, { params: { expiration } }).then(r => r.data)

export const fetchGreekHistory = (
  ticker: string,
  expiration: string,
  strike: number,
  opt_type: string,
  period: string,
) =>
  api.get(`/options/${ticker}/greek-history`, {
    params: { expiration, strike, opt_type, period },
  }).then(r => r.data)

export const fetchStockInfo = (ticker: string) =>
  api.get(`/quotes/${ticker}/info`).then(r => r.data)

export const fetchNews = (ticker: string, q?: string) =>
  api.get(`/news/${ticker}`, { params: q ? { q } : {} }).then(r => r.data)

export const fetchPriceAt = (ticker: string, date: string, time?: string) =>
  api.get(`/quotes/${ticker}/price-at`, { params: { date, ...(time ? { time } : {}) } }).then(r => r.data)

export const calculatePnL = (payload: object) =>
  api.post('/pnl/calculate', payload).then(r => r.data)
