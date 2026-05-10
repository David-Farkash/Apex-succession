const CH_BASE = 'https://api.company-information.service.gov.uk'
const CH_KEY = process.env.COMPANIES_HOUSE_API_KEY!

function chHeaders() {
  const encoded = Buffer.from(`${CH_KEY}:`).toString('base64')
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' }
}

export async function searchCompaniesBySIC(
  sicCode: string,
  startIndex: number = 0,
  itemsPerPage: number = 100,
  postcodePrefix: string = ''
) {
  const params = new URLSearchParams({
    sic_codes: sicCode,
    company_status: 'active',
    company_type: 'ltd',
    start_index: startIndex.toString(),
    size: itemsPerPage.toString(),
  })
  if (postcodePrefix) params.append('location', postcodePrefix)
  const res = await fetch(`${CH_BASE}/advanced-search/companies?${params}`, { headers: chHeaders() })
  if (!res.ok) throw new Error(`CH search failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function getOfficers(companyNumber: string) {
  const res = await fetch(`${CH_BASE}/company/${companyNumber}/officers?items_per_page=50`, { headers: chHeaders() })
  if (!res.ok) throw new Error(`CH officers failed: ${res.status}`)
  const data = await res.json()
  return (data.items || []).filter((o: any) => !o.resigned_on && o.officer_role === 'director')
}

export function estimateAge(dobMonth: number, dobYear: number): number {
  const now = new Date()
  let age = now.getFullYear() - dobYear
  if (now.getMonth() + 1 < dobMonth) age -= 1
  return age
}

export interface DirectorProfile {
  name: string
  dob_month: number
  dob_year: number
  age_estimate: number
  appointed_on: string
}

export interface SuccessionAnalysis {
  hasSuccessionRisk: boolean
  successorAge?: number
  successorName?: string
}

export function analyseSuccession(directors: DirectorProfile[]): SuccessionAnalysis {
  if (directors.length === 0) return { hasSuccessionRisk: true }
  const oldest = directors.reduce((a, b) => (a.age_estimate > b.age_estimate ? a : b))
  const oldestSurname = oldest.name.split(' ').pop()?.toLowerCase()
  const sameNameDirectors = directors.filter(d =>
    d.name !== oldest.name && d.name.toLowerCase().includes(oldestSurname || '')
  )
  if (sameNameDirectors.length === 0) return { hasSuccessionRisk: true }
  const youngestSuccessor = sameNameDirectors.reduce((a, b) => a.age_estimate < b.age_estimate ? a : b)
  return {
    hasSuccessionRisk: false,
    successorAge: youngestSuccessor.age_estimate,
    successorName: youngestSuccessor.name,
  }
}

export function getRegionFromPostcode(postcode: string): string {
  if (!postcode) return 'Unknown'
  const prefix = postcode.replace(/\s/g, '').toUpperCase().slice(0, 2).replace(/\d/g, '')
  const regionMap: Record<string, string> = {
    E: 'London', EC: 'London', N: 'London', NW: 'London', SE: 'London', SW: 'London', W: 'London', WC: 'London',
    IG: 'London', RM: 'London',
    AL: 'East of England', CB: 'East of England', CM: 'East of England', CO: 'East of England',
    EN: 'East of England', IP: 'East of England', LU: 'East of England', SG: 'East of England', SS: 'East of England',
    HP: 'South East', MK: 'South East', BN: 'South East', CT: 'South East', GU: 'South East',
    ME: 'South East', OX: 'South East', PO: 'South East', RG: 'South East', RH: 'South East',
    SL: 'South East', SO: 'South East', TN: 'South East',
    B: 'West Midlands', CV: 'West Midlands', DY: 'West Midlands', WS: 'West Midlands', WV: 'West Midlands',
    BD: 'Yorkshire', DN: 'Yorkshire', HD: 'Yorkshire', HG: 'Yorkshire', HU: 'Yorkshire',
    HX: 'Yorkshire', LS: 'Yorkshire', S: 'Yorkshire', WF: 'Yorkshire', YO: 'Yorkshire',
    BL: 'North West', CH: 'North West', CW: 'North West', FY: 'North West', L: 'North West',
    LA: 'North West', M: 'North West', OL: 'North West', PR: 'North West', SK: 'North West',
    WA: 'North West', WN: 'North West',
    BS: 'South West', BA: 'South West', BH: 'South West', DT: 'South West', EX: 'South West',
    GL: 'South West', PL: 'South West', SN: 'South West', SP: 'South West', TA: 'South West',
    TQ: 'South West', TR: 'South West',
    CF: 'Wales', LD: 'Wales', LL: 'Wales', NP: 'Wales', SA: 'Wales', SY: 'Wales',
    AB: 'Scotland', DD: 'Scotland', DG: 'Scotland', EH: 'Scotland', FK: 'Scotland', G: 'Scotland',
    IV: 'Scotland', KA: 'Scotland', KY: 'Scotland', ML: 'Scotland', PA: 'Scotland', PH: 'Scotland', TD: 'Scotland',
    BT: 'Northern Ireland',
    DE: 'East Midlands', LE: 'East Midlands', LN: 'East Midlands', NG: 'East Midlands', NN: 'East Midlands', PE: 'East Midlands',
    DH: 'North East', DL: 'North East', NE: 'North East', SR: 'North East', TS: 'North East',
  }
  return regionMap[prefix] || 'Other'
}