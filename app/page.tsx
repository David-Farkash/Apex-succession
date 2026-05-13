'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, RefreshCw, MapPin, Globe,
  Phone, ExternalLink, X, ChevronLeft, ChevronRight,
  Target, Zap, BarChart2, Clock, Users, CheckCircle2, Building2, Mail,
  Activity, MessageSquare, Flag, Send, PhoneCall, SlidersHorizontal
} from 'lucide-react'

interface Director {
  name: string
  dob_month: number
  dob_year: number
  age_estimate: number
  appointed_on: string
}

interface ScoreBreakdown {
  age: number
  succession: number
  size: number
  longevity: number
  digital: number
}

interface Firm {
  id: string
  created_at: string
  company_number: string
  company_name: string
  company_status: string
  postcode: string
  region: string
  sector: string
  play: string
  directors: Director[]
  oldest_director_age: number
  director_count: number
  has_succession_risk: boolean
  successor_age?: number
  successor_name?: string
  date_of_creation: string
  registered_address: Record<string, string>
  apex_score: number
  score_breakdown: ScoreBreakdown
  status: string
  priority: string
  notes: string
  places_enriched: boolean
  phone: string
  website: string
  has_website: boolean
  google_rating: number
  google_review_count: number
  estimated_turnover: number
  contacted_at: string
  last_activity: string
  financials_extracted: boolean
  turnover: number
  net_assets: number
  cash: number
  profit_loss: number
  employee_count: number
  financial_year: string
  financial_health: string
  financials_raw: any
  contact_found: boolean
  contact_email: string
  contact_phone: string
  contact_website: string
  outreach_status: string
  last_contacted_at: string
  follow_up_count: number
  last_reply_at: string
  linkedin_flagged: boolean
  phone_flagged: boolean
  call_outcome?: string
  call_notes?: string
  called_at?: string
  outreach_log?: any[]
  reply_log?: any[]
}

const STATUS_OPTIONS = ['new', 'reviewing', 'approached', 'interested', 'in_diligence', 'passed', 'acquired']
const STATUS_COLORS: Record<string, string> = {
  new: '#94a3b8',
  reviewing: '#3b82f6',
  approached: '#8b5cf6',
  interested: '#f59e0b',
  in_diligence: '#f97316',
  passed: '#cbd5e1',
  acquired: '#22c55e',
}

const OUTREACH_STATUS_COLORS: Record<string, string> = {
  not_contacted: '#94a3b8',
  contacted: '#3b82f6',
  replied: '#f59e0b',
  interested: '#22c55e',
  passed: '#cbd5e1',
  bounced: '#ef4444',
}

const REGIONS = [
  'London', 'South East', 'South West', 'East of England', 'East Midlands',
  'West Midlands', 'Yorkshire', 'North West', 'North East', 'Wales',
  'Scotland', 'Northern Ireland', 'Other'
]

const POSTCODE_PREFIXES = [
  'E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC',
  'IG', 'RM', 'EN', 'HA', 'UB', 'TW', 'KT', 'CR', 'BR', 'DA',
  'AL', 'CM', 'CO', 'HP', 'LU', 'MK', 'OX', 'RG', 'SG', 'SL', 'SS',
  'B', 'CV', 'WS', 'WV', 'DY',
  'BD', 'DN', 'HD', 'HX', 'LS', 'WF', 'YO', 'HU',
  'BL', 'CH', 'L', 'M', 'OL', 'PR', 'SK', 'WA', 'WN',
  'BS', 'BA', 'BH', 'EX', 'GL', 'PL', 'TR',
  'BN', 'CT', 'GU', 'ME', 'PO', 'RH', 'SO', 'TN',
  'CF', 'SA', 'NP',
  'EH', 'G', 'AB', 'DD', 'KY', 'PA',
  'DE', 'LE', 'LN', 'NG', 'NN', 'PE',
  'NE', 'SR', 'TS', 'DH',
]

const BOROUGH_TO_POSTCODES: Record<string, string[]> = {
  'Barking & Dagenham': ['RM8', 'RM9', 'RM10'],
  'Barnet': ['EN4', 'EN5', 'N2', 'N3', 'N11', 'N12', 'N20', 'NW4', 'NW7', 'NW9'],
  'Bexley': ['DA5', 'DA6', 'DA7', 'DA14', 'DA15', 'DA16', 'DA17'],
  'Brent': ['HA0', 'HA9', 'NW2', 'NW10'],
  'Bromley': ['BR1', 'BR2', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7'],
  'Camden': ['NW1', 'NW3', 'NW5', 'WC1', 'WC2'],
  'City of London': ['EC1', 'EC2', 'EC3', 'EC4'],
  'Croydon': ['CR0', 'CR2', 'CR7', 'CR8'],
  'Ealing': ['UB1', 'UB2', 'UB5', 'UB6', 'W3', 'W5', 'W7', 'W13'],
  'Enfield': ['EN1', 'EN2', 'EN3'],
  'Greenwich': ['SE3', 'SE7', 'SE10', 'SE18'],
  'Hackney': ['E5', 'E8', 'E9', 'N16'],
  'Hammersmith & Fulham': ['SW6', 'W6', 'W12', 'W14'],
  'Haringey': ['N4', 'N8', 'N15', 'N17', 'N22'],
  'Harrow': ['HA1', 'HA2', 'HA3', 'HA5', 'HA7'],
  'Havering': ['RM1', 'RM2', 'RM3', 'RM4', 'RM5', 'RM6', 'RM7', 'RM11', 'RM12', 'RM13', 'RM14'],
  'Hillingdon': ['UB3', 'UB4', 'UB7', 'UB8', 'UB9', 'UB10', 'UB11'],
  'Hounslow': ['TW3', 'TW4', 'TW5', 'TW7', 'TW8'],
  'Islington': ['EC1', 'N1', 'N5', 'N7', 'N19'],
  'Kensington & Chelsea': ['SW3', 'SW5', 'SW7', 'SW10', 'W8', 'W10', 'W11'],
  'Kingston upon Thames': ['KT1', 'KT2', 'KT3', 'KT4', 'KT5', 'KT6'],
  'Lambeth': ['SE11', 'SE24', 'SE27', 'SW2', 'SW4', 'SW8', 'SW9'],
  'Lewisham': ['SE4', 'SE6', 'SE8', 'SE12', 'SE13', 'SE14', 'SE23', 'SE26'],
  'Merton': ['CR4', 'SW17', 'SW19', 'SW20'],
  'Newham': ['E6', 'E7', 'E13', 'E15', 'E16'],
  'Redbridge': ['IG1', 'IG2', 'IG3', 'IG4', 'IG5', 'IG6'],
  'Richmond upon Thames': ['TW1', 'TW2', 'TW9', 'TW10', 'TW11', 'TW12', 'SW13', 'SW14'],
  'Southwark': ['SE1', 'SE5', 'SE15', 'SE16', 'SE17', 'SE21', 'SE22'],
  'Sutton': ['SM1', 'SM2', 'SM3', 'CR5'],
  'Tower Hamlets': ['E1', 'E2', 'E3', 'E14'],
  'Waltham Forest': ['E4', 'E10', 'E11', 'E17', 'E18'],
  'Wandsworth': ['SW11', 'SW12', 'SW15', 'SW16', 'SW18'],
  'Westminster': ['SW1', 'W1', 'W2', 'W9', 'NW8'],
  'Loughton / Epping': ['IG10', 'CM16'],
  'Chigwell': ['IG7', 'IG9'],
  'Buckhurst Hill': ['IG9'],
  'Woodford': ['IG8', 'E18'],
}

const BOROUGHS = Object.keys(BOROUGH_TO_POSTCODES).sort()

interface SectorDefinition {
  name: string
  sicCodes: string[]
  play: 'services' | 'trade'
  valuation: string
}

const SECTORS: SectorDefinition[] = [
  { name: 'Accountancies', sicCodes: ['69201', '69202'], play: 'services', valuation: '0.8x-1.2x recurring fees' },
  { name: 'Tax Consultants', sicCodes: ['69203'], play: 'services', valuation: '0.8x-1.2x recurring fees' },
  { name: 'IFAs & Insurance Brokers', sicCodes: ['66220', '66290', '66300'], play: 'services', valuation: '2x-3x recurring income' },
  { name: 'Letting & Estate Agents', sicCodes: ['68310', '68320'], play: 'services', valuation: '1x-1.5x recurring fees' },
  { name: 'Dental Practices', sicCodes: ['86230'], play: 'services', valuation: '1x-1.2x turnover' },
  { name: 'Nurseries & Childcare', sicCodes: ['88910', '85100'], play: 'services', valuation: '5x-8x EBITDA' },
  { name: 'Funeral Directors', sicCodes: ['96030'], play: 'services', valuation: '4x-6x EBITDA' },
  { name: 'Plumbing, Heating & HVAC', sicCodes: ['43220'], play: 'services', valuation: '3x-5x EBITDA' },
  { name: 'Electrical Contractors', sicCodes: ['43210'], play: 'services', valuation: '3x-5x EBITDA' },
  { name: 'Security Companies', sicCodes: ['80100', '80200'], play: 'services', valuation: '3x-4x EBITDA' },
  { name: 'Pest Control', sicCodes: ['81291'], play: 'services', valuation: '3x-5x EBITDA' },
  { name: 'Commercial Cleaning & Laundry', sicCodes: ['81210', '81222', '96010'], play: 'services', valuation: '3x-5x EBITDA' },
  { name: 'Vending Machine Operators', sicCodes: ['47990'], play: 'services', valuation: '3x-5x EBITDA' },
  { name: 'Builders Merchants', sicCodes: ['46730'], play: 'trade', valuation: '0.4x-0.8x turnover' },
  { name: 'Electrical & HVAC Wholesale', sicCodes: ['46690', '46439'], play: 'trade', valuation: '0.4x-0.8x turnover' },
  { name: 'Plumbing & Heating Merchants', sicCodes: ['46740'], play: 'trade', valuation: '0.4x-0.8x turnover' },
  { name: 'Workwear, PPE & Safety', sicCodes: ['46420', '46499'], play: 'trade', valuation: '0.4x-0.6x turnover' },
  { name: 'Roofing & Specialist Construction', sicCodes: ['43910', '43999'], play: 'services', valuation: '3x-5x EBITDA' },
]

const SECTOR_NAMES = SECTORS.map(s => s.name)

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatCurrency(val: number | null): string {
  if (!val && val !== 0) return '—'
  if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}m`
  if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(0)}k`
  return `£${val.toFixed(0)}`
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const c = score >= 70 ? '#16a34a' : score >= 55 ? '#d97706' : score >= 40 ? '#2563eb' : '#94a3b8'
  const r = size === 48 ? 18 : 14
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const fontSize = size === 48 ? 13 : 11
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize, color: c }}>{score}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || '#94a3b8'
  return (
    <span style={{ background: c + '18', color: c, border: `1px solid ${c}40`, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4 }}>
      {status.replace('_', ' ')}
    </span>
  )
}

function OutreachBadge({ status }: { status: string }) {
  const c = OUTREACH_STATUS_COLORS[status] || '#94a3b8'
  return (
    <span style={{ background: c + '18', color: c, border: `1px solid ${c}40`, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4 }}>
      {status?.replace('_', ' ') || 'not contacted'}
    </span>
  )
}

function PlayBadge({ play }: { play: string }) {
  const isServices = play === 'services'
  return (
    <span style={{
      background: isServices ? '#eff6ff' : '#fef9c3',
      color: isServices ? '#1d4ed8' : '#854d0e',
      border: `1px solid ${isServices ? '#bfdbfe' : '#fde68a'}`,
      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3
    }}>
      {isServices ? 'Services' : 'Trade'}
    </span>
  )
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string
  options: string[]
  selected: string[]
  onChange: (vals: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: selected.length > 0 ? '#eff6ff' : '#fff',
        border: `1px solid ${selected.length > 0 ? '#3b82f6' : '#e2e8f0'}`,
        color: selected.length > 0 ? '#1d4ed8' : '#64748b',
        padding: '7px 12px', borderRadius: 8, fontSize: 12,
        cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
        minHeight: 36,
      }}>
        {selected.length > 0 ? `${label}: ${selected.length}` : label}
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto', minWidth: 200 }}>
          {selected.length > 0 && (
            <div onClick={() => { onChange([]); setOpen(false) }} style={{ padding: '8px 12px', fontSize: 11, color: '#ef4444', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
              Clear all
            </div>
          )}
          {options.map(opt => (
            <div key={opt} onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', background: selected.includes(opt) ? '#eff6ff' : 'transparent', color: selected.includes(opt) ? '#1d4ed8' : '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${selected.includes(opt) ? '#3b82f6' : '#cbd5e1'}`, background: selected.includes(opt) ? '#3b82f6' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selected.includes(opt) && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FindContactButton({ firm, onDone }: { firm: Firm; onDone: (f: Firm) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const find = async () => {
    setLoading(true)
    setError(null)
    try {
      const director = firm.directors?.[0]
      const res = await fetch('/api/enrich/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmId: firm.id,
          companyName: firm.company_name,
          companyNumber: firm.company_number,
          postcode: firm.postcode,
          directorName: director?.name || '',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      const firmRes = await fetch(`/api/firms/${firm.id}`)
      const firmData = await firmRes.json()
      if (firmData.firm) onDone(firmData.firm)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button onClick={find} disabled={loading} style={{
        background: loading ? '#f1f5f9' : '#2563eb', border: 'none',
        color: loading ? '#94a3b8' : '#fff', padding: '8px 14px', borderRadius: 6,
        fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', minHeight: 36
      }}>
        {loading ? 'Searching...' : 'Find Contact'}
      </button>
      {error && <div style={{ fontSize: 10, color: '#ef4444' }}>{error}</div>}
    </div>
  )
}

function GetPhoneButton({ firm, onDone }: { firm: Firm; onDone: (f: Firm) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getPhone = async () => {
    if (!confirm('This will use Apollo phone credits (more expensive than email). Continue?')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/apollo-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: firm.id }),
      })
      const data = await res.json()
      if (!data.phone) throw new Error('No phone found in Apollo')
      const firmRes = await fetch(`/api/firms/${firm.id}`)
      const firmData = await firmRes.json()
      if (firmData.firm) onDone(firmData.firm)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button onClick={getPhone} disabled={loading} style={{
        background: loading ? '#f1f5f9' : '#d97706', border: 'none',
        color: loading ? '#94a3b8' : '#fff', padding: '8px 14px', borderRadius: 6,
        fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', minHeight: 36
      }}>
        {loading ? 'Searching...' : 'Get Phone'}
      </button>
      {error && <div style={{ fontSize: 10, color: '#ef4444' }}>{error}</div>}
    </div>
  )
}

function ExtractButton({ firmId, companyNumber, companyName, onDone }: {
  firmId: string
  companyNumber: string
  companyName: string
  onDone: (f: Firm) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extract = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/enrich/financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId, companyNumber, companyName }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Extraction failed')
      const firmRes = await fetch(`/api/firms/${firmId}`)
      const firmData = await firmRes.json()
      if (firmData.firm) onDone(firmData.firm)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button onClick={extract} disabled={loading} style={{
        background: loading ? '#f1f5f9' : '#0f172a', border: 'none',
        color: loading ? '#94a3b8' : '#fff', padding: '8px 14px', borderRadius: 6,
        fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', minHeight: 36
      }}>
        {loading ? 'Extracting...' : 'Extract Financials'}
      </button>
      {error && <div style={{ fontSize: 10, color: '#ef4444' }}>{error}</div>}
    </div>
  )
}

function CallOutcomeModal({ firm, onClose, onDone }: { firm: Firm; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!outcome) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/firms/${firm.id}/call-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, notes }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to save')
      onDone()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const options = [
    { key: 'interested', label: '✓ Interested', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { key: 'callback', label: '↺ Callback needed', color: '#d97706', bg: '#fefce8', border: '#fde68a' },
    { key: 'no_answer', label: '✕ No answer', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
    { key: 'passed', label: '✕ Passed', color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Log call outcome</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>{firm.company_name}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => setOutcome(opt.key)}
              style={{
                background: outcome === opt.key ? opt.bg : '#fff',
                border: `1.5px solid ${outcome === opt.key ? opt.color : '#e2e8f0'}`,
                color: outcome === opt.key ? opt.color : '#475569',
                padding: '14px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6, fontWeight: 500 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What did they say? Any follow-ups needed?"
          style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', marginBottom: 16, boxSizing: 'border-box' }} />

        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!outcome || saving}
            style={{ flex: 2, background: outcome && !saving ? '#0f172a' : '#e2e8f0', border: 'none', color: outcome && !saving ? '#fff' : '#94a3b8', padding: '12px', borderRadius: 8, fontSize: 13, cursor: outcome && !saving ? 'pointer' : 'default', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Save outcome'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FirmDrawer({ firm, onClose, onUpdate, isMobile }: { firm: Firm; onClose: () => void; onUpdate: (f: Firm) => void; isMobile: boolean }) {
  const [notes, setNotes] = useState(firm.notes || '')
  const [status, setStatus] = useState(firm.status)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/firms/${firm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, status }),
    })
    const data = await res.json()
    if (data.firm) onUpdate(data.firm)
    setSaving(false)
  }

  const addr = firm.registered_address || {}
  const addressStr = [addr.address_line_1, addr.locality, addr.postal_code].filter(Boolean).join(', ')
  const sc = firm.apex_score >= 70 ? '#16a34a' : firm.apex_score >= 55 ? '#d97706' : '#2563eb'
  const sectorDef = SECTORS.find(s => s.name === firm.sector)

  const healthConfig: Record<string, { bg: string; border: string; color: string; label: string }> = {
    healthy: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', label: '✓ Healthy' },
    stable: { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', label: '~ Stable' },
    watch: { bg: '#fefce8', border: '#fde68a', color: '#d97706', label: '⚠ Watch' },
    distressed: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', label: '✕ Distressed' },
    unknown: { bg: '#f8fafc', border: '#e2e8f0', color: '#94a3b8', label: '? Unknown' },
  }
  const health = healthConfig[firm.financial_health] || healthConfig.unknown

  const drawerStyle: React.CSSProperties = isMobile
    ? { width: '100%', height: '100%', background: '#fff', overflowY: 'auto', display: 'flex', flexDirection: 'column' }
    : { width: 520, background: '#fff', borderLeft: '1px solid #e2e8f0', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      {!isMobile && <div style={{ flex: 1, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose} />}
      <div style={drawerStyle}>

        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{firm.company_number}</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0f172a', lineHeight: 1.3 }}>{firm.company_name}</h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={status} />
                {firm.outreach_status && firm.outreach_status !== 'not_contacted' && <OutreachBadge status={firm.outreach_status} />}
                {firm.sector && <PlayBadge play={firm.play || 'services'} />}
                {firm.sector && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{firm.sector}</span>}
                {firm.region && <span style={{ fontSize: 11, color: '#94a3b8' }}><MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />{firm.region}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ScoreRing score={firm.apex_score || 0} />
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {sectorDef && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={13} color="#64748b" />
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Typical valuation: <span style={{ fontWeight: 700, color: '#0f172a' }}>{sectorDef.valuation}</span>
            </div>
          </div>
        )}

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {firm.has_succession_risk && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
              <CheckCircle2 size={11} /> No succession plan
            </span>
          )}
          {!firm.has_website && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
              <CheckCircle2 size={11} /> No website
            </span>
          )}
          {firm.phone_flagged && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
              <Phone size={11} /> Phone outreach
            </span>
          )}
          {firm.call_outcome && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 500 }}>
              <PhoneCall size={11} /> Called: {firm.call_outcome.replace('_', ' ')}
            </span>
          )}
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>Score Breakdown</div>
          {firm.score_breakdown && Object.entries({
            'Director Age': { val: firm.score_breakdown.age, max: 35 },
            'Succession Risk': { val: firm.score_breakdown.succession, max: 25 },
            'Firm Size': { val: firm.score_breakdown.size, max: 20 },
            'Longevity': { val: firm.score_breakdown.longevity, max: 10 },
            'Digital Presence': { val: firm.score_breakdown.digital, max: 10 },
          }).map(([label, { val, max }]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#475569' }}>{label}</span>
                <span style={{ fontSize: 12, color: sc, fontWeight: 600 }}>{val}/{max}</span>
              </div>
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2 }}>
                <div style={{ height: 4, width: `${(val / max) * 100}%`, background: sc, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>
            Directors ({firm.director_count})
          </div>
          {(firm.directors || []).map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < (firm.directors.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Appointed {new Date(d.appointed_on).getFullYear()}</div>
              </div>
              <div style={{
                background: d.age_estimate >= 65 ? '#f0fdf4' : d.age_estimate >= 58 ? '#fefce8' : '#f8fafc',
                color: d.age_estimate >= 65 ? '#16a34a' : d.age_estimate >= 58 ? '#d97706' : '#64748b',
                border: `1px solid ${d.age_estimate >= 65 ? '#bbf7d0' : d.age_estimate >= 58 ? '#fde68a' : '#e2e8f0'}`,
                padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600
              }}>{d.age_estimate} yrs</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Contact Details</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!firm.contact_found && <FindContactButton firm={firm} onDone={onUpdate} />}
              {!firm.contact_phone && <GetPhoneButton firm={firm} onDone={onUpdate} />}
            </div>
          </div>
          {firm.contact_found || firm.contact_phone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {firm.contact_email && (
                <a href={`mailto:${firm.contact_email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', textDecoration: 'none' }}>
                  <Mail size={13} color="#16a34a" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Email</div>
                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{firm.contact_email}</div>
                  </div>
                </a>
              )}
              {firm.contact_phone && (
                <a href={`tel:${firm.contact_phone.replace(/\s/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a', textDecoration: 'none' }}>
                  <Phone size={14} color="#d97706" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Tap to call</div>
                    <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>{firm.contact_phone}</div>
                  </div>
                </a>
              )}
              {firm.contact_website && (
                <a href={firm.contact_website} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textDecoration: 'none' }}>
                  <Globe size={13} color="#64748b" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Website</div>
                    <div style={{ fontSize: 13, color: '#2563eb' }}>{firm.contact_website}</div>
                  </div>
                </a>
              )}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>No contact details yet</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Click Find Contact to search Google Places</div>
            </div>
          )}
        </div>

        {firm.call_notes && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fefce8' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Call notes ({firm.called_at && timeAgo(firm.called_at)})</div>
            <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{firm.call_notes}</div>
          </div>
        )}

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Financial Health
              {firm.financial_year && (
                <span style={{ marginLeft: 8, color: '#cbd5e1', fontWeight: 400, textTransform: 'none', fontSize: 10 }}>
                  year ending {new Date(firm.financial_year).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {!firm.financials_extracted && (
              <ExtractButton firmId={firm.id} companyNumber={firm.company_number} companyName={firm.company_name} onDone={onUpdate} />
            )}
          </div>
          {firm.financials_extracted ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Turnover', value: formatCurrency(firm.turnover) },
                  { label: 'Net Assets', value: formatCurrency(firm.net_assets) },
                  { label: 'Cash', value: formatCurrency(firm.cash) },
                  { label: 'Profit / Loss', value: formatCurrency(firm.profit_loss) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</div>
                  </div>
                ))}
              </div>
              {firm.employee_count && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                  <Users size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {firm.employee_count} employees on record
                </div>
              )}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: health.bg, color: health.color, border: `1px solid ${health.border}` }}>
                {health.label}
              </div>
            </>
          ) : (
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>No financial data yet</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Click Extract Financials to read from Companies House filing</div>
            </div>
          )}
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>Firm Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Incorporated', value: firm.date_of_creation ? new Date(firm.date_of_creation).getFullYear() : '—' },
              { label: 'Oldest Director', value: firm.oldest_director_age ? `${firm.oldest_director_age} yrs` : '—' },
              { label: 'Region', value: firm.region || '—' },
              { label: 'Postcode', value: firm.postcode || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#0f172a' }}>{value}</div>
              </div>
            ))}
          </div>
          {addressStr && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 600 }}>Address</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{addressStr}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '18px 20px', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>Pipeline</div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontSize: 14, outline: 'none', minHeight: 42 }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add notes about this firm..."
              style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button onClick={save} disabled={saving} style={{ width: '100%', background: '#0f172a', border: 'none', color: '#fff', padding: '13px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, minHeight: 46 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <a href={`https://find-and-update.company-information.service.gov.uk/company/${firm.company_number}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, padding: '11px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13, textDecoration: 'none', minHeight: 42 }}>
            <ExternalLink size={12} /> View on Companies House
          </a>
        </div>
      </div>
    </div>
  )
}

function ToCallTab({ data, onSelectFirm, onCallOutcome, isMobile }: { data: any; onSelectFirm: (f: any) => void; onCallOutcome: (f: any) => void; isMobile: boolean }) {
  const flagged = data?.flagged || []

  if (flagged.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <PhoneCall size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No calls in your queue</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>When the agent flags firms for phone outreach, they'll appear here.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {flagged.map((f: any) => (
        <div key={f.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, padding: isMobile ? 14 : 16, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onSelectFirm(f)}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{f.company_name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {f.sector || '—'} {f.region && `· ${f.region}`}
              </div>
              {f.directors?.[0] && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Director: {f.directors[0].name}
                </div>
              )}
            </div>
            <ScoreRing score={f.apex_score || 0} size={40} />
          </div>

          {f.contact_phone ? (
            <a href={`tel:${f.contact_phone.replace(/\s/g, '')}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#0f172a', borderRadius: 10, textDecoration: 'none', marginBottom: 8 }}>
              <Phone size={16} color="#fff" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Tap to call</div>
                <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>{f.contact_phone}</div>
              </div>
            </a>
          ) : (
            <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: 10, marginBottom: 8, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>No phone number</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Open the firm to fetch from Apollo</div>
            </div>
          )}

          <button onClick={() => onCallOutcome(f)} style={{
            width: '100%', background: '#fff', border: '1.5px solid #0f172a',
            color: '#0f172a', padding: '11px', borderRadius: 8, fontSize: 13,
            fontWeight: 600, cursor: 'pointer', minHeight: 42,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <CheckCircle2 size={14} /> Log call outcome
          </button>
        </div>
      ))}
    </div>
  )
}

function PipelineTab({ data, loading, page, setPage, filterStatus, setFilterStatus, search, setSearch, onSelectFirm, isMobile }: any) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '1 1 220px', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search firm name..."
            style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '9px 10px 9px 30px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', minHeight: 38 }} />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: filterStatus ? '#0f172a' : '#94a3b8', padding: '9px 10px', borderRadius: 8, fontSize: 13, outline: 'none', minHeight: 38, flex: isMobile ? '1' : 'initial' }}>
          <option value="">All Statuses</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="interested">Interested</option>
          <option value="bounced">Bounced</option>
          <option value="passed">Passed</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading...</div>
      ) : !data?.firms?.length ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No firms approached yet</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Run the agent to start outreach.</div>
        </div>
      ) : (
        <>
          {data.firms.map((firm: any) => (
            <div key={firm.id} onClick={() => onSelectFirm(firm)}
              style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{firm.company_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{firm.sector || '—'} · {firm.region || '—'}</div>
                </div>
                <OutreachBadge status={firm.outreach_status} />
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#64748b', marginTop: 8 }}>
                <span>Last contact: <strong style={{ color: '#0f172a' }}>{timeAgo(firm.last_contacted_at)}</strong></span>
                <span>Follow-ups: <strong style={{ color: '#0f172a' }}>{firm.follow_up_count || 0}</strong></span>
                {firm.last_reply_at && <span style={{ color: '#f59e0b', fontWeight: 600 }}>Replied {timeAgo(firm.last_reply_at)}</span>}
                {firm.outreach_status === 'bounced' && <span style={{ color: '#dc2626', fontWeight: 600 }}>Email bounced</span>}
              </div>
            </div>
          ))}

          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: page === 1 ? '#94a3b8' : '#0f172a', padding: '8px 14px', borderRadius: 8, cursor: page === 1 ? 'default' : 'pointer', minHeight: 38 }}>
                <ChevronLeft size={14} style={{ display: 'block' }} />
              </button>
              <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {data.totalPages}</span>
              <button onClick={() => setPage((p: number) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: page === data.totalPages ? '#94a3b8' : '#0f172a', padding: '8px 14px', borderRadius: 8, cursor: page === data.totalPages ? 'default' : 'pointer', minHeight: 38 }}>
                <ChevronRight size={14} style={{ display: 'block' }} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RepliesTab({ data, onSelectFirm, isMobile }: { data: any; onSelectFirm: (f: any) => void; isMobile: boolean }) {
  const replies = data?.recentReplies || []
  if (replies.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <MessageSquare size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No replies yet</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>When prospects reply, they'll appear here. Warm replies also notify you on WhatsApp.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {replies.map((r: any) => (
        <div key={r.id} onClick={() => r.firms && onSelectFirm(r.firms)}
          style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, padding: 14, cursor: r.firms ? 'pointer' : 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{r.firms?.company_name || r.from_email}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.from_email} · {timeAgo(r.created_at)}</div>
            </div>
            {r.classification && <OutreachBadge status={r.classification === 'warm' ? 'interested' : r.classification === 'cold' ? 'passed' : 'replied'} />}
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, padding: '10px 12px', background: '#fefce8', borderRadius: 8, marginTop: 8, maxHeight: 100, overflow: 'hidden', position: 'relative' }}>
            {r.body?.slice(0, 280)}{r.body?.length > 280 && '...'}
          </div>
        </div>
      ))}
    </div>
  )
}

function OutreachTab({ isMobile }: { isMobile: boolean }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'call' | 'pipeline' | 'replies'>('call')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedFirm, setSelectedFirm] = useState<any>(null)
  const [callOutcomeFirm, setCallOutcomeFirm] = useState<any>(null)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentResult, setAgentResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '50' })
    if (filterStatus) params.set('status', filterStatus)
    if (search) params.set('search', search)
    const res = await fetch(`/api/outreach?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [page, filterStatus, search])

  useEffect(() => { fetchData() }, [fetchData])

  const runAgent = async () => {
  setAgentRunning(true)
  setAgentResult(null)
  try {
    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'x-force-run': 'true' },
    })
      const json = await res.json()
      if (json.skipped) {
        setAgentResult(`Skipped: ${json.reason}`)
      } else {
        setAgentResult(`Done: ${json.stats?.emailsSent || 0} emails sent, ${json.stats?.repliesProcessed || 0} replies handled`)
      }
      fetchData()
    } catch {
      setAgentResult('Agent run failed')
    }
    setAgentRunning(false)
  }

  const flaggedCount = data?.flagged?.length || 0
  const repliesCount = data?.recentReplies?.length || 0
  const lastRun = data?.recentRuns?.[0]

  const subTabs = [
    { key: 'call', label: 'To Call', icon: <PhoneCall size={13} />, count: flaggedCount, badge: '#d97706' },
    { key: 'pipeline', label: 'Pipeline', icon: <Activity size={13} />, count: data?.total || 0, badge: '#2563eb' },
    { key: 'replies', label: 'Replies', icon: <MessageSquare size={13} />, count: repliesCount, badge: '#f59e0b' },
  ]

  return (
    <div style={{ padding: isMobile ? '0 14px' : '0 28px', paddingBottom: 24 }}>

      {/* Top action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', flexWrap: 'wrap' }}>
        <button onClick={runAgent} disabled={agentRunning} style={{
          background: agentRunning ? '#f1f5f9' : '#0f172a', border: 'none',
          color: agentRunning ? '#94a3b8' : '#fff', padding: '11px 18px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: agentRunning ? 'wait' : 'pointer',
          whiteSpace: 'nowrap', minHeight: 42
        }}>
          {agentRunning ? 'Agent running...' : '▶ Run Agent Now'}
        </button>
        {agentResult && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>{agentResult}</div>}
        {lastRun && !agentResult && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Last run {timeAgo(lastRun.created_at)} · {lastRun.emails_sent || 0} sent
          </div>
        )}
        <button onClick={fetchData} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginLeft: 'auto', minHeight: 42 }}>
          <RefreshCw size={14} style={{ display: 'block' }} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 16, overflowX: 'auto' }}>
        {subTabs.map(({ key, label, icon, count, badge }) => (
          <button key={key} onClick={() => setSubTab(key as any)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px', borderRadius: 0, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            background: 'transparent',
            color: subTab === key ? '#0f172a' : '#64748b',
            borderBottom: `2px solid ${subTab === key ? '#0f172a' : 'transparent'}`,
            marginBottom: -1,
          }}>
            {icon} {label}
            {count > 0 && (
              <span style={{
                background: subTab === key ? badge : '#f1f5f9',
                color: subTab === key ? '#fff' : '#64748b',
                fontSize: 10, fontWeight: 700,
                padding: '2px 7px', borderRadius: 10, minWidth: 18, textAlign: 'center',
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {subTab === 'call' && (
        <ToCallTab data={data} onSelectFirm={setSelectedFirm} onCallOutcome={setCallOutcomeFirm} isMobile={isMobile} />
      )}
      {subTab === 'pipeline' && (
        <PipelineTab data={data} loading={loading} page={page} setPage={setPage} filterStatus={filterStatus} setFilterStatus={setFilterStatus} search={search} setSearch={setSearch} onSelectFirm={setSelectedFirm} isMobile={isMobile} />
      )}
      {subTab === 'replies' && (
        <RepliesTab data={data} onSelectFirm={setSelectedFirm} isMobile={isMobile} />
      )}

      {selectedFirm && (
        <FirmDrawer firm={selectedFirm} onClose={() => setSelectedFirm(null)} onUpdate={(updated) => {
          setSelectedFirm(updated)
          fetchData()
        }} isMobile={isMobile} />
      )}

      {callOutcomeFirm && (
        <CallOutcomeModal firm={callOutcomeFirm} onClose={() => setCallOutcomeFirm(null)} onDone={() => {
          setCallOutcomeFirm(null)
          fetchData()
        }} />
      )}
    </div>
  )
}

export default function ApexDashboard() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<'firms' | 'outreach'>('firms')
  const [firms, setFirms] = useState<Firm[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [importSectors, setImportSectors] = useState<string[]>([])
  const [importPostcode, setImportPostcode] = useState('')
  const [importAll, setImportAll] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSectors, setFilterSectors] = useState<string[]>([])
  const [filterPlay, setFilterPlay] = useState('')
  const [filterRegions, setFilterRegions] = useState<string[]>([])
  const [filterPostcodes, setFilterPostcodes] = useState<string[]>([])
  const [filterBoroughs, setFilterBoroughs] = useState<string[]>([])
  const [filterMinAge, setFilterMinAge] = useState('')
  const [filterMaxAge, setFilterMaxAge] = useState('')
  const [filterMinPeople, setFilterMinPeople] = useState('')
  const [filterMaxPeople, setFilterMaxPeople] = useState('')
  const [filterSuccession, setFilterSuccession] = useState(false)
  const [filterNoWebsite, setFilterNoWebsite] = useState(false)
  const [sortBy, setSortBy] = useState('apex_score')

  const boroughPostcodes = filterBoroughs.flatMap(b => BOROUGH_TO_POSTCODES[b] || [])
  const allPostcodes = [...new Set([...filterPostcodes, ...boroughPostcodes])]

  const fetchFirms = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '50', sortBy, sortDir: 'desc' })
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    if (filterSectors.length > 0) params.set('sectors', filterSectors.join(','))
    if (filterPlay) params.set('play', filterPlay)
    if (filterRegions.length > 0) params.set('regions', filterRegions.join(','))
    if (allPostcodes.length > 0) params.set('postcodes', allPostcodes.join(','))
    if (filterMinAge) params.set('minAge', filterMinAge)
    if (filterMaxAge) params.set('maxAge', filterMaxAge)
    if (filterMinPeople) params.set('minPeople', filterMinPeople)
    if (filterMaxPeople) params.set('maxPeople', filterMaxPeople)
    if (filterSuccession) params.set('successionOnly', 'true')
    if (filterNoWebsite) params.set('noWebsite', 'true')

    const res = await fetch(`/api/firms?${params}`)
    const data = await res.json()
    setFirms(data.firms || [])
    setTotal(data.total || 0)
    setTotalPages(data.totalPages || 1)
    setLoading(false)
  }, [page, search, filterStatus, filterSectors, filterPlay, filterRegions, allPostcodes.join(','), filterMinAge, filterMaxAge, filterMinPeople, filterMaxPeople, filterSuccession, filterNoWebsite, sortBy])

  useEffect(() => { fetchFirms() }, [fetchFirms])

  const runSync = async () => {
    const sectorsToImport = importAll ? SECTORS : SECTORS.filter(s => importSectors.includes(s.name))
    if (sectorsToImport.length === 0) return

    setSyncing(true)
    setSyncResult(null)
    setShowImportModal(false)

    let totalAdded = 0
    for (const sector of sectorsToImport) {
      for (const sicCode of sector.sicCodes) {
        try {
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sicCode,
              postcodePrefix: importPostcode,
              maxPages: 10,
              sector: sector.name,
              play: sector.play,
            }),
          })
          const data = await res.json()
          totalAdded += data.firmsAdded || 0
        } catch {}
      }
    }

    setSyncResult(`Done: ${totalAdded} firms imported`)
    fetchFirms()
    setSyncing(false)
  }

  const updateFirm = (updated: Firm) => {
    setFirms(prev => prev.map(f => f.id === updated.id ? updated : f))
    setSelectedFirm(updated)
  }

  const clearAll = () => {
    setFilterRegions([]); setFilterPostcodes([]); setFilterBoroughs([])
    setFilterSectors([]); setFilterPlay('')
    setFilterMinAge(''); setFilterMaxAge(''); setFilterMinPeople('')
    setFilterMaxPeople(''); setFilterSuccession(false); setFilterNoWebsite(false)
    setFilterStatus(''); setSearch(''); setPage(1)
  }

  const primeCount = firms.filter(f => f.apex_score >= 70).length
  const successionCount = firms.filter(f => f.has_succession_risk).length
  const activeFilters = [
    filterRegions.length > 0, filterPostcodes.length > 0, filterBoroughs.length > 0,
    filterSectors.length > 0, filterPlay,
    filterMinAge, filterMaxAge, filterMinPeople, filterMaxPeople,
    filterSuccession, filterNoWebsite, filterStatus
  ].filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; font-family: Inter, sans-serif; } input::placeholder { color: #94a3b8; } body { margin: 0; -webkit-text-size-adjust: 100%; }`}</style>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '0 14px' : '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#0f172a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={15} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.03em' }}>Apex</span>
          {!isMobile && <span style={{ fontSize: 12, color: '#94a3b8' }}>Acquisition Intelligence</span>}
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { key: 'firms', label: 'Firms', icon: <BarChart2 size={13} /> },
            { key: 'outreach', label: 'Outreach', icon: <Send size={13} /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: activeTab === key ? '#0f172a' : 'transparent',
              color: activeTab === key ? '#fff' : '#64748b',
              minHeight: 36
            }}>
              {icon} {!isMobile && label}
              {isMobile && label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowImportModal(true)} disabled={syncing}
          style={{ background: '#0f172a', border: 'none', color: '#fff', padding: isMobile ? '8px 10px' : '8px 14px', borderRadius: 8, fontSize: 12, cursor: syncing ? 'wait' : 'pointer', fontWeight: 600, minHeight: 36 }}>
          {syncing ? '...' : isMobile ? '+' : '+ Import'}
        </button>
      </div>

      {syncResult && <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 28px', fontSize: 12, color: '#16a34a', fontWeight: 500 }}>{syncResult}</div>}

      {activeTab === 'firms' && (
        <>
          {/* Stats bar - simplified on mobile */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '10px 14px' : '14px 28px', display: 'flex', gap: isMobile ? 14 : 32, overflowX: 'auto' }}>
            {[
              { icon: <BarChart2 size={13} color="#64748b" />, label: 'Total', value: total.toLocaleString(), color: '#0f172a' },
              { icon: <Zap size={13} color="#16a34a" />, label: 'Prime', value: primeCount.toLocaleString(), color: '#16a34a' },
              { icon: <CheckCircle2 size={13} color="#2563eb" />, label: 'Succession', value: successionCount.toLocaleString(), color: '#2563eb' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {icon}
                <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Filters bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '10px 14px' : '12px 28px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 0 220px', minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search firm name..."
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '9px 10px 9px 30px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', minHeight: 38 }} />
            </div>

            {isMobile ? (
              <button onClick={() => setShowMobileFilters(true)} style={{
                background: activeFilters > 0 ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${activeFilters > 0 ? '#3b82f6' : '#e2e8f0'}`,
                color: activeFilters > 0 ? '#1d4ed8' : '#64748b',
                padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', minHeight: 38
              }}>
                <SlidersHorizontal size={14} /> Filters {activeFilters > 0 && `(${activeFilters})`}
              </button>
            ) : (
              <>
                <MultiSelect label="Sector" options={SECTOR_NAMES} selected={filterSectors} onChange={v => { setFilterSectors(v); setPage(1) }} />
                <select value={filterPlay} onChange={e => { setFilterPlay(e.target.value); setPage(1) }}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: filterPlay ? '#0f172a' : '#94a3b8', padding: '8px 10px', borderRadius: 8, fontSize: 12, outline: 'none', minHeight: 36 }}>
                  <option value="">All Plays</option>
                  <option value="services">Services</option>
                  <option value="trade">Trade</option>
                </select>
                <MultiSelect label="Region" options={REGIONS} selected={filterRegions} onChange={v => { setFilterRegions(v); setPage(1) }} />
                <MultiSelect label="Borough" options={BOROUGHS} selected={filterBoroughs} onChange={v => { setFilterBoroughs(v); setPage(1) }} />
                <MultiSelect label="Postcode" options={POSTCODE_PREFIXES} selected={filterPostcodes} onChange={v => { setFilterPostcodes(v); setPage(1) }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', minHeight: 36 }}>
                  <Clock size={12} color="#94a3b8" />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Age</span>
                  <input value={filterMinAge} onChange={e => { setFilterMinAge(e.target.value); setPage(1) }} placeholder="Min" type="number"
                    style={{ width: 44, background: 'transparent', border: 'none', fontSize: 12, color: '#0f172a', outline: 'none', textAlign: 'center' }} />
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>–</span>
                  <input value={filterMaxAge} onChange={e => { setFilterMaxAge(e.target.value); setPage(1) }} placeholder="Max" type="number"
                    style={{ width: 44, background: 'transparent', border: 'none', fontSize: 12, color: '#0f172a', outline: 'none', textAlign: 'center' }} />
                </div>

                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: filterStatus ? '#0f172a' : '#94a3b8', padding: '8px 10px', borderRadius: 8, fontSize: 12, outline: 'none', minHeight: 36 }}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>

                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '8px 10px', borderRadius: 8, fontSize: 12, outline: 'none', minHeight: 36 }}>
                  <option value="apex_score">Sort: Score</option>
                  <option value="oldest_director_age">Sort: Age</option>
                  <option value="director_count">Sort: Size</option>
                  <option value="turnover">Sort: Turnover</option>
                  <option value="created_at">Sort: Newest</option>
                </select>

                <button onClick={() => { setFilterSuccession(!filterSuccession); setPage(1) }} style={{ background: filterSuccession ? '#f0fdf4' : '#f8fafc', border: `1px solid ${filterSuccession ? '#86efac' : '#e2e8f0'}`, color: filterSuccession ? '#16a34a' : '#64748b', padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: filterSuccession ? 600 : 400, minHeight: 36 }}>
                  <CheckCircle2 size={12} /> No Succession
                </button>

                <button onClick={() => { setFilterNoWebsite(!filterNoWebsite); setPage(1) }} style={{ background: filterNoWebsite ? '#f0fdf4' : '#f8fafc', border: `1px solid ${filterNoWebsite ? '#86efac' : '#e2e8f0'}`, color: filterNoWebsite ? '#16a34a' : '#64748b', padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: filterNoWebsite ? 600 : 400, minHeight: 36 }}>
                  <Globe size={12} /> No Website
                </button>

                {activeFilters > 0 && (
                  <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: '7px 8px' }}>
                    Clear ({activeFilters})
                  </button>
                )}

                <button onClick={fetchFirms} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginLeft: 'auto', minHeight: 36 }}>
                  <RefreshCw size={13} style={{ display: 'block' }} />
                </button>
              </>
            )}
          </div>

          {/* Firms list */}
          <div style={{ padding: isMobile ? '0 14px' : '0 28px' }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading firms...</div>
            ) : firms.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>No firms found</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Try adjusting your filters or import more firms.</div>
              </div>
            ) : isMobile ? (
              // Mobile: card view
              <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {firms.map(firm => (
                  <div key={firm.id} onClick={() => setSelectedFirm(firm)}
                    style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{firm.company_name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{firm.sector || '—'} · {firm.region || '—'}</div>
                      </div>
                      <ScoreRing score={firm.apex_score || 0} size={40} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
                      {firm.oldest_director_age > 0 && <span>Age: <strong style={{ color: '#0f172a' }}>{firm.oldest_director_age}</strong></span>}
                      {firm.director_count > 0 && <span>{firm.director_count} ppl</span>}
                      {firm.turnover > 0 && <span>{formatCurrency(firm.turnover)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {firm.has_succession_risk && <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No heir</span>}
                      {!firm.has_website && <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No web</span>}
                      {firm.contact_found && <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Contact</span>}
                      {firm.phone_flagged && <span style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>📞</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop: table view
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 110px 70px 100px 100px 130px 80px 110px', gap: 12, padding: '10px 12px', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', marginTop: 4, fontWeight: 600 }}>
                  <div>Score</div><div>Firm</div><div>Sector</div><div>Region</div><div>Age</div><div>People</div><div>Turnover</div><div>Status</div><div>Added</div><div>Signals</div>
                </div>
                {firms.map(firm => (
                  <div key={firm.id} onClick={() => setSelectedFirm(firm)}
                    style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 110px 70px 100px 100px 130px 80px 110px', gap: 12, padding: '13px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#fff', marginTop: 2, borderRadius: 8, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <ScoreRing score={firm.apex_score || 0} />
                    <div style={{ alignSelf: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{firm.company_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{firm.company_number} · {firm.postcode || '—'}</div>
                    </div>
                    <div style={{ alignSelf: 'center' }}>
                      {firm.sector ? (
                        <div>
                          <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 500, marginBottom: 2 }}>{firm.sector}</div>
                          <PlayBadge play={firm.play || 'services'} />
                        </div>
                      ) : <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', alignSelf: 'center' }}>{firm.region || '—'}</div>
                    <div style={{ alignSelf: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: firm.oldest_director_age >= 68 ? '#16a34a' : firm.oldest_director_age >= 62 ? '#d97706' : '#64748b' }}>
                        {firm.oldest_director_age || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', alignSelf: 'center' }}>{firm.director_count || '—'} people</div>
                    <div style={{ fontSize: 12, color: '#475569', alignSelf: 'center', fontWeight: firm.turnover ? 600 : 400 }}>
                      {firm.turnover ? formatCurrency(firm.turnover) : '—'}
                    </div>
                    <div style={{ alignSelf: 'center' }}><StatusBadge status={firm.status || 'new'} /></div>
                    <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>{timeAgo(firm.created_at)}</div>
                    <div style={{ display: 'flex', gap: 4, alignSelf: 'center', flexWrap: 'wrap' }}>
                      {firm.has_succession_risk && <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No heir</span>}
                      {!firm.has_website && <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>No web</span>}
                      {firm.contact_found && <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Contact</span>}
                      {firm.phone_flagged && <span style={{ background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>📞</span>}
                      {firm.financials_extracted && (
                        <span style={{ background: firm.financial_health === 'healthy' ? '#f0fdf4' : firm.financial_health === 'distressed' ? '#fef2f2' : '#f8fafc', border: `1px solid ${firm.financial_health === 'healthy' ? '#bbf7d0' : firm.financial_health === 'distressed' ? '#fecaca' : '#e2e8f0'}`, color: firm.financial_health === 'healthy' ? '#16a34a' : firm.financial_health === 'distressed' ? '#dc2626' : '#64748b', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          {firm.financial_health}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '24px 0' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: page === 1 ? '#94a3b8' : '#0f172a', padding: '8px 14px', borderRadius: 8, cursor: page === 1 ? 'default' : 'pointer', minHeight: 38 }}>
                <ChevronLeft size={14} style={{ display: 'block' }} />
              </button>
              <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ background: '#fff', border: '1px solid #e2e8f0', color: page === totalPages ? '#94a3b8' : '#0f172a', padding: '8px 14px', borderRadius: 8, cursor: page === totalPages ? 'default' : 'pointer', minHeight: 38 }}>
                <ChevronRight size={14} style={{ display: 'block' }} />
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'outreach' && <OutreachTab isMobile={isMobile} />}

      {/* Mobile filters drawer */}
      {showMobileFilters && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)' }} onClick={() => setShowMobileFilters(false)} />
          <div style={{ position: 'relative', background: '#fff', width: '100%', maxHeight: '85vh', borderRadius: '16px 16px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Filters</h3>
              <button onClick={() => setShowMobileFilters(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Sector</label>
                <MultiSelect label="Select sectors" options={SECTOR_NAMES} selected={filterSectors} onChange={v => { setFilterSectors(v); setPage(1) }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Play</label>
                <select value={filterPlay} onChange={e => { setFilterPlay(e.target.value); setPage(1) }}
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: filterPlay ? '#0f172a' : '#94a3b8', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', minHeight: 42 }}>
                  <option value="">All Plays</option>
                  <option value="services">Services</option>
                  <option value="trade">Trade</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Region</label>
                <MultiSelect label="Select regions" options={REGIONS} selected={filterRegions} onChange={v => { setFilterRegions(v); setPage(1) }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Borough</label>
                <MultiSelect label="Select boroughs" options={BOROUGHS} selected={filterBoroughs} onChange={v => { setFilterBoroughs(v); setPage(1) }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Director Age</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={filterMinAge} onChange={e => { setFilterMinAge(e.target.value); setPage(1) }} placeholder="Min age" type="number"
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', outline: 'none', padding: '10px 12px', borderRadius: 8, minHeight: 42 }} />
                  <input value={filterMaxAge} onChange={e => { setFilterMaxAge(e.target.value); setPage(1) }} placeholder="Max age" type="number"
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', outline: 'none', padding: '10px 12px', borderRadius: 8, minHeight: 42 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', minHeight: 42 }}>
                  <option value="apex_score">Apex Score</option>
                  <option value="oldest_director_age">Director Age</option>
                  <option value="director_count">Firm Size</option>
                  <option value="turnover">Turnover</option>
                  <option value="created_at">Newest</option>
                </select>
              </div>

              <button onClick={() => { setFilterSuccession(!filterSuccession); setPage(1) }} style={{ background: filterSuccession ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${filterSuccession ? '#86efac' : '#e2e8f0'}`, color: filterSuccession ? '#16a34a' : '#475569', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, minHeight: 46, justifyContent: 'center' }}>
                <CheckCircle2 size={14} /> No Succession Plan
              </button>

              <button onClick={() => { setFilterNoWebsite(!filterNoWebsite); setPage(1) }} style={{ background: filterNoWebsite ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${filterNoWebsite ? '#86efac' : '#e2e8f0'}`, color: filterNoWebsite ? '#16a34a' : '#475569', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, minHeight: 46, justifyContent: 'center' }}>
                <Globe size={14} /> No Website
              </button>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {activeFilters > 0 && (
                  <button onClick={() => { clearAll(); setShowMobileFilters(false) }} style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, minHeight: 46 }}>
                    Clear all
                  </button>
                )}
                <button onClick={() => setShowMobileFilters(false)} style={{ flex: 2, background: '#0f172a', border: 'none', color: '#fff', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, minHeight: 46 }}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setShowImportModal(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: isMobile ? 20 : 32, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Import Firms</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Choose sectors and location to pull from Companies House.</p>

            <div style={{ marginBottom: 20, padding: '12px 16px', background: importAll ? '#f0fdf4' : '#f8fafc', border: `1px solid ${importAll ? '#86efac' : '#e2e8f0'}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setImportAll(!importAll)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Import All 18 Sectors</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Pull from every sector simultaneously</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${importAll ? '#16a34a' : '#cbd5e1'}`, background: importAll ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {importAll && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
            </div>

            {!importAll && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 10, fontWeight: 500 }}>Select Sectors</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '6px 0 4px' }}>Services Roll-up</div>
                  {SECTORS.filter(s => s.play === 'services').map(sector => (
                    <div key={sector.name}
                      onClick={() => setImportSectors(prev => prev.includes(sector.name) ? prev.filter(s => s !== sector.name) : [...prev, sector.name])}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: importSectors.includes(sector.name) ? '#eff6ff' : 'transparent' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${importSectors.includes(sector.name) ? '#3b82f6' : '#cbd5e1'}`, background: importSectors.includes(sector.name) ? '#3b82f6' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {importSectors.includes(sector.name) && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </span>
                      <span style={{ fontSize: 12, color: importSectors.includes(sector.name) ? '#1d4ed8' : '#1e293b', flex: 1 }}>{sector.name}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '10px 0 4px' }}>Trade Merchant Roll-up</div>
                  {SECTORS.filter(s => s.play === 'trade').map(sector => (
                    <div key={sector.name}
                      onClick={() => setImportSectors(prev => prev.includes(sector.name) ? prev.filter(s => s !== sector.name) : [...prev, sector.name])}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: importSectors.includes(sector.name) ? '#fef9c3' : 'transparent' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${importSectors.includes(sector.name) ? '#d97706' : '#cbd5e1'}`, background: importSectors.includes(sector.name) ? '#d97706' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {importSectors.includes(sector.name) && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </span>
                      <span style={{ fontSize: 12, color: importSectors.includes(sector.name) ? '#854d0e' : '#1e293b', flex: 1 }}>{sector.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Postcode Prefix <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
              </label>
              <select value={importPostcode} onChange={e => setImportPostcode(e.target.value)}
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', minHeight: 42 }}>
                <option value="">Nationwide (all postcodes)</option>
                {POSTCODE_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowImportModal(false)}
                style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, minHeight: 46 }}>
                Cancel
              </button>
              <button onClick={runSync} disabled={!importAll && importSectors.length === 0}
                style={{ flex: 2, background: (!importAll && importSectors.length === 0) ? '#e2e8f0' : '#0f172a', border: 'none', color: (!importAll && importSectors.length === 0) ? '#94a3b8' : '#fff', padding: '12px', borderRadius: 8, fontSize: 13, cursor: (!importAll && importSectors.length === 0) ? 'default' : 'pointer', fontWeight: 600, minHeight: 46 }}>
                {importAll ? 'Import All' : importSectors.length > 0 ? `Import ${importSectors.length}` : 'Select Sectors'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFirm && <FirmDrawer firm={selectedFirm} onClose={() => setSelectedFirm(null)} onUpdate={updateFirm} isMobile={isMobile} />}
    </div>
  )
}