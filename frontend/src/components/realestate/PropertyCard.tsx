import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRentEstimate } from '../../api/client'
import { Bed, Bath, Square, Calendar, TrendingUp, DollarSign, Home } from 'lucide-react'

interface Property {
  id: string
  address: string
  city: string
  state: string
  zipCode: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  squareFootage: number | null
  yearBuilt: number | null
  propertyType: string
  daysOnMarket: number | null
  pricePerSqFt: number | null
  monthlyMortgage: number | null
}

interface Props {
  property: Property
  prefetchedRent?: any
}

function mortgagePayment(price: number, downPct: number, rateAnnual: number, years = 30) {
  const loan = price * (1 - downPct / 100)
  const r = rateAnnual / 100 / 12
  const n = years * 12
  if (r === 0) return loan / n
  return loan * r * (1 + r) ** n / ((1 + r) ** n - 1)
}

export default function PropertyCard({ property: p, prefetchedRent = null }: Props) {
  const [expanded, setExpanded]   = useState(false)
  const [downPct, setDownPct]     = useState('20')
  const [rate, setRate]           = useState('7')

  const { data: fetchedRent } = useQuery({
    queryKey: ['rent-estimate', p.address, p.bedrooms, p.bathrooms, p.squareFootage],
    queryFn: () => fetchRentEstimate({
      address: p.address,
      propertyType: p.propertyType || 'Single Family',
      ...(p.bedrooms      ? { bedrooms: p.bedrooms }           : {}),
      ...(p.bathrooms     ? { bathrooms: p.bathrooms }         : {}),
      ...(p.squareFootage ? { squareFootage: p.squareFootage } : {}),
    }),
    enabled: expanded && !prefetchedRent,
    staleTime: 300_000,
  })

  const rentData = prefetchedRent ?? fetchedRent

  const downNum  = parseFloat(downPct) || 20
  const rateNum  = parseFloat(rate)    || 7
  const monthly  = p.price ? Math.round(mortgagePayment(p.price, downNum, rateNum)) : null
  const rent     = rentData?.rentEstimate ?? null

  const propTax    = p.price ? p.price * 0.011 / 12 : 0
  const insurance  = p.price ? p.price * 0.005 / 12 : 0
  const maintenance = p.price ? p.price * 0.01 / 12 : 0
  const capex      = p.price ? p.price * 0.005 / 12 : 0
  const mgmt       = rent ? rent * 0.08 : 0
  const vacancy    = rent ? rent * 0.05 : 0
  const totalCosts = (monthly ?? 0) + propTax + insurance + maintenance + capex + mgmt + vacancy

  const grossYield = rent && p.price ? (rent * 12) / p.price * 100 : null
  const cashFlow   = rent && p.price ? rent - totalCosts : null

  const typeColor = p.propertyType?.toLowerCase().includes('condo') ? 'var(--blue)'
    : p.propertyType?.toLowerCase().includes('multi') ? '#ffb347'
    : 'var(--green)'

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 3,
    color: 'var(--text)', fontFamily: 'inherit', fontSize: 10, outline: 'none',
    width: 44, padding: '2px 4px', textAlign: 'right',
  }

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 14px', cursor: 'pointer',
        transition: 'border-color 0.15s',
        borderColor: expanded ? 'var(--green)' : 'var(--border)',
      }}
      onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
      onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      {/* Address + type badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{p.address}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{p.city}, {p.state} {p.zipCode}</div>
        </div>
        {p.propertyType && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
            background: 'rgba(0,212,170,0.1)', color: typeColor,
            border: `1px solid ${typeColor}44`,
          }}>
            {p.propertyType.replace('Single Family', 'SFH').replace('Multi Family', 'MULTI')}
          </span>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
        {p.price ? `$${p.price.toLocaleString()}` : '—'}
      </div>

      {/* Key stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { icon: <Bed size={10} />,      val: p.bedrooms      ?? '—', label: 'bd' },
          { icon: <Bath size={10} />,     val: p.bathrooms     ?? '—', label: 'ba' },
          { icon: <Square size={10} />,   val: p.squareFootage ? p.squareFootage.toLocaleString() : '—', label: 'sqft' },
          { icon: <Calendar size={10} />, val: p.yearBuilt     ?? '—', label: 'built' },
        ].map(({ icon, val, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-dim)' }}>
            {icon}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{val}</span>
            <span>{label}</span>
          </div>
        ))}
        {p.pricePerSqFt && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>${p.pricePerSqFt.toLocaleString()}</span>/sqft
          </div>
        )}
      </div>

      {/* Days on market */}
      {p.daysOnMarket != null && (
        <div style={{ fontSize: 9, color: p.daysOnMarket > 60 ? 'var(--red)' : 'var(--text-mute)', marginBottom: expanded ? 10 : 0 }}>
          {p.daysOnMarket === 0 ? 'Listed today' : `${p.daysOnMarket} days on market`}
        </div>
      )}

      {/* Expanded investment metrics */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}
        >
          {/* Editable mortgage inputs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.06em' }}>MORTGAGE ASSUMPTIONS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <span style={{ color: 'var(--text-dim)' }}>Down</span>
              <input
                type="number" min="0" max="100" step="1"
                value={downPct}
                onChange={e => setDownPct(e.target.value)}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-dim)' }}>%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <span style={{ color: 'var(--text-dim)' }}>Rate</span>
              <input
                type="number" min="0" max="30" step="0.1"
                value={rate}
                onChange={e => setRate(e.target.value)}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-dim)' }}>%</span>
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-mute)' }}>30yr fixed</span>
          </div>

          {rentData === undefined ? (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
              Loading rental estimate…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Rent */}
              <div style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <Home size={11} /> EST. MONTHLY RENT
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
                  {rent ? `$${rent.toLocaleString()}` : '—'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
                  {rentData?.rentRangeLow && rentData?.rentRangeHigh
                    ? `$${rentData.rentRangeLow.toLocaleString()} – $${rentData.rentRangeHigh.toLocaleString()}`
                    : 'Rentcast estimate'}
                </div>
              </div>

              {/* Monthly Costs breakdown */}
              <div style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <DollarSign size={11} /> EST. MONTHLY COSTS
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {p.price ? `$${Math.round(totalCosts).toLocaleString()}` : '—'}
                </div>
                {p.price && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { label: `Mortgage (${downPct}% dn · ${rate}%)`, val: monthly },
                      { label: 'Property Tax (1.1%/yr)', val: propTax },
                      { label: 'Insurance (0.5%/yr)', val: insurance },
                      { label: 'Maintenance (1%/yr)', val: maintenance },
                      { label: 'CapEx Reserve (0.5%/yr)', val: capex },
                      { label: 'Prop. Mgmt (8% rent)', val: mgmt },
                      { label: 'Vacancy (5% rent)', val: vacancy },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-mute)' }}>
                        <span>{label}</span>
                        <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                          {val ? `$${Math.round(val).toLocaleString()}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gross Yield */}
              <div style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <TrendingUp size={11} /> GROSS YIELD
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: grossYield && grossYield >= 6 ? 'var(--green)' : grossYield && grossYield >= 4 ? '#ffb347' : 'var(--red)' }}>
                  {grossYield ? `${grossYield.toFixed(2)}%` : '—'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>annual rent / price</div>
              </div>

              {/* Cash Flow */}
              <div style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                  <DollarSign size={11} /> MONTHLY CASH FLOW
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: cashFlow != null ? (cashFlow >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)' }}>
                  {cashFlow != null ? `${cashFlow >= 0 ? '+' : ''}$${Math.round(cashFlow).toLocaleString()}` : '—'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>rent – all costs</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
