import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchListings, fetchRentEstimate } from '../../api/client'
import PropertyCard from './PropertyCard'
import { Search, Home, Activity, SlidersHorizontal, X, ArrowUp, ArrowDown } from 'lucide-react'
import { searchCities, normalizeQuery, type CityOption } from './cities'
import { useAuth } from '../../context/AuthContext'

const PROPERTY_TYPES = ['Any', 'Single Family', 'Condo', 'Townhouse', 'Multi Family']
const BEDS  = ['Any', '1', '2', '3', '4', '5+']
const BATHS = ['Any', '1', '1.5', '2', '3', '4+']

type SortKey = 'default' | 'price' | 'ppsf' | 'sqft' | 'dom' | 'cashflow' | 'yield'

const SORT_OPTIONS: { value: SortKey; label: string; needsRent: boolean }[] = [
  { value: 'default',  label: 'Sort',         needsRent: false },
  { value: 'price',    label: 'Price',        needsRent: false },
  { value: 'ppsf',     label: '$/sqft',       needsRent: false },
  { value: 'sqft',     label: 'Sq Ft',        needsRent: false },
  { value: 'dom',      label: 'Days Listed',  needsRent: false },
  { value: 'cashflow', label: 'Cash Flow',    needsRent: true  },
  { value: 'yield',    label: 'Gross Yield',  needsRent: true  },
]

function mortgagePayment(price: number, downPct = 20, rateAnnual = 7, years = 30) {
  const loan = price * (1 - downPct / 100)
  const r = rateAnnual / 100 / 12
  const n = years * 12
  if (r === 0) return loan / n
  return loan * r * (1 + r) ** n / ((1 + r) ** n - 1)
}

interface SearchParams {
  query: string
  propertyType: string
  bedrooms: string
  bathrooms: string
}

export default function RealEstateApp({ onSwitch }: { onSwitch: (mode: 'landing' | 'stocks' | 'realestate') => void }) {
  const { state: authState, signOut } = useAuth()
  const [params, setParams]       = useState<SearchParams>({ query: '', propertyType: 'Any', bedrooms: 'Any', bathrooms: 'Any' })
  const [submitted, setSubmitted] = useState<SearchParams | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy]       = useState<SortKey>('default')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [suggestions, setSuggestions] = useState<CityOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buildQueryParams = (p: SearchParams) => {
    const out: Record<string, string | number> = {}
    const q = p.query.trim()
    if (/^\d{5}$/.test(q)) {
      out.zipCode = q
    } else {
      const parts = q.split(',').map(s => s.trim())
      if (parts[0]) out.city = parts[0]
      if (parts[1]) out.state = parts[1]
    }
    if (p.propertyType !== 'Any') out.propertyType = p.propertyType
    if (p.bedrooms  !== 'Any')    out.bedrooms  = p.bedrooms  === '5+' ? 5 : parseInt(p.bedrooms)
    if (p.bathrooms !== 'Any')    out.bathrooms = p.bathrooms === '4+' ? 4 : parseFloat(p.bathrooms)
    return out
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['listings', submitted],
    queryFn:  () => fetchListings(buildQueryParams(submitted!)),
    enabled:  !!submitted,
    staleTime: 120_000,
  })

  const listings: any[] = data?.listings ?? []
  const needsRent = SORT_OPTIONS.find(o => o.value === sortBy)?.needsRent ?? false

  // Bulk-fetch rent estimates when a rent-based sort is selected
  const rentQueries = useQueries({
    queries: listings.map(p => ({
      queryKey: ['rent-estimate', p.address, p.bedrooms, p.bathrooms, p.squareFootage],
      queryFn:  () => fetchRentEstimate({
        address:      p.address,
        propertyType: p.propertyType || 'Single Family',
        ...(p.bedrooms      ? { bedrooms: p.bedrooms }           : {}),
        ...(p.bathrooms     ? { bathrooms: p.bathrooms }         : {}),
        ...(p.squareFootage ? { squareFootage: p.squareFootage } : {}),
      }),
      enabled:   needsRent && listings.length > 0,
      staleTime: 300_000,
    })),
  })

  // Build a map of address → rent data for passing to cards
  const rentMap: Record<string, any> = {}
  listings.forEach((p, i) => {
    if (rentQueries[i]?.data) rentMap[p.address] = rentQueries[i].data
  })

  const rentLoading = needsRent && rentQueries.some(q => q.isLoading)
  // const rentLoaded  = needsRent && rentQueries.every(q => !q.isLoading)

  // Sort listings
  const sorted = [...listings].sort((a, b) => {
    const d = sortDir === 'desc' ? -1 : 1
    switch (sortBy) {
      case 'price': return d * ((a.price ?? 0) - (b.price ?? 0))
      case 'ppsf':  return d * ((a.pricePerSqFt ?? Infinity) - (b.pricePerSqFt ?? Infinity))
      case 'sqft':  return d * ((a.squareFootage ?? 0) - (b.squareFootage ?? 0))
      case 'dom':   return d * ((a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999))
      case 'cashflow': {
        const cf = (l: any) => {
          const rent = rentMap[l.address]?.rentEstimate ?? null
          const mortgage = l.price ? mortgagePayment(l.price) : null
          return rent != null && mortgage != null ? rent - mortgage : -Infinity
        }
        return d * (cf(a) - cf(b))
      }
      case 'yield': {
        const y = (l: any) => {
          const rent = rentMap[l.address]?.rentEstimate ?? null
          return rent && l.price ? (rent * 12) / l.price * 100 : -Infinity
        }
        return d * (y(a) - y(b))
      }
      default: return 0
    }
  })

  const handleSearch = (rawQuery?: string) => {
    const q = normalizeQuery(rawQuery ?? params.query)
    if (!q.trim()) return
    setParams(p => ({ ...p, query: q }))
    setSubmitted({ ...params, query: q })
    setSortBy('default')
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleQueryChange = (val: string) => {
    setParams(p => ({ ...p, query: val }))
    const hits = searchCities(val)
    setSuggestions(hits)
    setShowSuggestions(hits.length > 0)
  }

  const handleSuggestionClick = (city: CityOption) => {
    handleSearch(city.label)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{
        background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <button
          onClick={() => onSwitch('landing')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--green)', fontWeight: 700, fontSize: 12,
            letterSpacing: '0.1em', fontFamily: 'inherit', padding: 0, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Activity size={13} /> AARON TERMINAL
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 4, padding: 2, gap: 2, border: '1px solid var(--border)' }}>
          <button
            onClick={() => onSwitch('stocks')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none',
              border: '1px solid transparent', color: 'var(--text-dim)', borderRadius: 3,
              padding: '3px 10px', fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
              letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.borderColor = 'rgba(0,212,170,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            <Activity size={9} /> STOCKS
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(77,166,255,0.15)', border: '1px solid rgba(77,166,255,0.35)',
            color: 'var(--blue)', borderRadius: 3, padding: '3px 10px', fontSize: 10,
            fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.06em', cursor: 'default',
          }}>
            <Home size={9} /> REAL ESTATE
          </button>
        </div>

        {/* Search bar + autocomplete */}
        <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg)', border: '1px solid var(--border2)',
            borderRadius: 3, padding: '3px 8px',
          }}>
            <Search size={10} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              value={params.query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch()
                if (e.key === 'Escape') setShowSuggestions(false)
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="City, ST  or  zip code  or  address"
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 11, fontFamily: 'inherit', width: '100%' }}
            />
            {params.query && (
              <button onClick={() => { setParams(p => ({ ...p, query: '' })); setSuggestions([]); setShowSuggestions(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={10} />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 4, overflow: 'hidden',
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            }}>
              {suggestions.map(s => (
                <button
                  key={s.label}
                  onMouseDown={() => handleSuggestionClick(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 10px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <Search size={9} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{s.city}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>{s.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => handleSearch()} style={{
          background: 'rgba(77,166,255,0.12)', border: '1px solid rgba(77,166,255,0.3)',
          color: 'var(--blue)', borderRadius: 3, padding: '3px 12px',
          fontSize: 10, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em',
        }}>SEARCH</button>

        <button onClick={() => setShowFilters(f => !f)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: showFilters ? 'rgba(77,166,255,0.15)' : 'none',
          border: `1px solid ${showFilters ? 'rgba(77,166,255,0.4)' : 'var(--border2)'}`,
          color: showFilters ? 'var(--blue)' : 'var(--text-dim)',
          borderRadius: 3, padding: '3px 8px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <SlidersHorizontal size={10} /> FILTERS
        </button>

        {/* Sort dropdown + direction */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border2)',
              borderRight: 'none', borderRadius: '3px 0 0 3px',
              color: sortBy !== 'default' ? 'var(--text)' : 'var(--text-dim)',
              fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
              padding: '3px 6px', cursor: 'pointer', outline: 'none',
            }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            disabled={sortBy === 'default'}
            style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--bg)', border: '1px solid var(--border2)',
              borderRadius: '0 3px 3px 0', padding: '3px 7px',
              color: sortBy !== 'default' ? 'var(--text)' : 'var(--text-mute)',
              cursor: sortBy !== 'default' ? 'pointer' : 'default',
            }}
            title={sortDir === 'desc' ? 'High → Low' : 'Low → High'}
          >
            {sortDir === 'desc' ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
          </button>
        </div>

        {submitted && data && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 9, color: 'var(--text-mute)' }}>
            {authState.status === 'signed_in' && (
              <>
                <span style={{ color: 'var(--text-dim)' }}>SIGNED IN AS</span>
                <span style={{ color: 'var(--text)', fontWeight: 700, letterSpacing: '0.06em' }}>
                  {authState.user.username.toUpperCase()}
                </span>
                <button
                  onClick={() => signOut()}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border2)',
                    color: 'var(--text-dim)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 9,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  SIGN OUT
                </button>
                <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
              </>
            )}
            <span>
              {data.count} RESULT{data.count !== 1 ? 'S' : ''} · RENTCAST
            </span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div style={{
          background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
          padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {[
            { label: 'TYPE',  key: 'propertyType', options: PROPERTY_TYPES },
            { label: 'BEDS',  key: 'bedrooms',     options: BEDS },
            { label: 'BATHS', key: 'bathrooms',    options: BATHS },
          ].map(({ label, key, options }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {options.map(o => (
                  <button key={o} onClick={() => setParams(p => ({ ...p, [key]: o }))}
                    className={`tab-btn ${(params as any)[key] === o ? 'active' : ''}`}
                    style={{ padding: '2px 8px', fontSize: 9 }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
        {!submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-dim)' }}>
            <Home size={40} style={{ opacity: 0.15 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Search for properties</div>
            <div style={{ fontSize: 11, color: 'var(--text-mute)', textAlign: 'center', maxWidth: 300 }}>
              Enter a city and state (e.g. <span style={{ color: 'var(--text)' }}>Austin, TX</span>),
              a zip code, or a full address above
            </div>
          </div>
        ) : isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
            Searching listings…
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--red)', fontSize: 11 }}>
            Error loading listings. Check your Rentcast API key.
          </div>
        ) : listings.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-dim)' }}>
            <Home size={28} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 12 }}>No active listings found</div>
            <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>Try a different city, state, or zip code</div>
          </div>
        ) : (
          <>
            {rentLoading && (
              <div style={{ fontSize: 9, color: 'var(--text-mute)', marginBottom: 10 }}>
                Loading rent estimates for sorting…
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {sorted.map((p: any) => (
                <PropertyCard
                  key={p.id || p.address}
                  property={p}
                  prefetchedRent={rentMap[p.address] ?? null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
