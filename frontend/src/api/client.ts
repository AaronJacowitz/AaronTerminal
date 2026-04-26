import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

export type AuthUser = { id: number; username: string; email: string }

export const register = (payload: { username: string; email: string; password: string }) =>
  api.post('/auth/register', payload).then(r => r.data as { token: string; user: AuthUser })

export const login = (payload: { email: string; password: string }) =>
  api.post('/auth/login', payload).then(r => r.data as { token: string; user: AuthUser })

export const fetchMe = () =>
  api.get('/auth/me').then(r => r.data as AuthUser)

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

export const fetchListings = (params: Record<string, string | number | undefined>) =>
  api.get('/realestate/listings', { params }).then(r => r.data)

export const fetchRentEstimate = (params: Record<string, string | number | undefined>) =>
  api.get('/realestate/rent-estimate', { params }).then(r => r.data)

export type AgentChatMessage = { role: 'user' | 'assistant'; content: string }

export const chatAgent = (payload: { messages: AgentChatMessage[]; ticker?: string | null }) =>
  api.post('/agent/chat', payload).then(r => r.data)

export type WatchlistItem = {
  id: string
  ticker: string
  type: 'stock' | 'option'
  label: string
  quantity: number
  strike?: number
  optType?: 'call' | 'put'
  expiration?: string
  iv?: number
}

export const fetchWatchlist = () =>
  api.get('/watchlist').then(r => r.data as WatchlistItem[])

export const addWatchlistItem = (item: Omit<WatchlistItem, 'id'>) =>
  api.post('/watchlist', item).then(r => r.data as WatchlistItem)

export const patchWatchlistItem = (id: string, patch: Partial<Pick<WatchlistItem, 'quantity' | 'label' | 'iv'>>) =>
  api.patch(`/watchlist/${id}`, patch).then(r => r.data as WatchlistItem)

export const deleteWatchlistItem = (id: string) =>
  api.delete(`/watchlist/${id}`).then(r => r.data)
