import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CH_BASE = 'https://api.company-information.service.gov.uk'
const CH_KEY = process.env.COMPANIES_HOUSE_API_KEY!

function chHeaders() {
  const encoded = Buffer.from(`${CH_KEY}:`).toString('base64')
  return { Authorization: `Basic ${encoded}` }
}

async function getFilingHistory(companyNumber: string) {
  const res = await fetch(
    `${CH_BASE}/company/${companyNumber}/filing-history?category=accounts&items_per_page=10`,
    { headers: chHeaders() }
  )
  if (!res.ok) return null
  return res.json()
}

function extractTextFromPDF(buffer: Buffer): string {
  const text = buffer.toString('binary')
  const results: string[] = []

  // Method 1: Extract from parentheses-encoded strings in BT/ET blocks
  const btBlocks = text.match(/BT[\s\S]{1,2000}?ET/g) || []
  for (const block of btBlocks) {
    const strings = block.match(/\(([^)]{1,300})\)/g) || []
    for (const s of strings) {
      const clean = s.slice(1, -1)
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\'/g, "'")
        .replace(/\\/g, '')
        .trim()
      if (clean.length > 1 && /[a-zA-Z0-9£]/.test(clean)) {
        results.push(clean)
      }
    }
  }

  // Method 2: Look for financial keywords and surrounding content directly
  const financialPatterns = [
    /[Tt]urnover[\s\S]{0,200}/g,
    /[Rr]evenue[\s\S]{0,200}/g,
    /[Nn]et assets[\s\S]{0,200}/g,
    /[Cc]ash at bank[\s\S]{0,200}/g,
    /[Pp]rofit[\s\S]{0,200}/g,
    /[Ll]oss[\s\S]{0,200}/g,
    /[Ee]mployees[\s\S]{0,200}/g,
    /[Ss]hareholders[\s\S]{0,200}/g,
    /£[\s\d,]+/g,
  ]

  const rawText = buffer.toString('utf8', 0, Math.min(buffer.length, 500000))
  for (const pattern of financialPatterns) {
    const matches = rawText.match(pattern) || []
    for (const m of matches) {
      const clean = m.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
      if (clean.length > 3) results.push(clean)
    }
  }

  const combined = results.join(' ').replace(/\s+/g, ' ').trim()
  return combined
}

async function extractFinancialsWithOpenAI(pdfText: string, companyName: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'You are a financial data extractor specialising in UK company accounts. Extract key figures and return only valid JSON with no markdown or explanation.',
        },
        {
          role: 'user',
          content: `Extract financial figures from these UK company accounts for "${companyName}".

Return ONLY this JSON structure (null for any field not found):
{
  "turnover": number or null,
  "net_assets": number or null,
  "cash": number or null,
  "profit_loss": number or null,
  "employee_count": number or null,
  "financial_year_end": "YYYY-MM-DD" or null
}

Rules:
- Raw numbers only, no £ signs or commas
- £1,234,567 → 1234567
- Losses are negative numbers
- Look for: turnover, revenue, net assets, total net assets, cash at bank, profit/loss for year, number of employees
- Return ONLY the JSON object

Accounts text:
${pdfText.slice(0, 14000)}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${response.status} — ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('No response from OpenAI')

  try {
    return JSON.parse(content.trim())
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse OpenAI response as JSON')
  }
}

function determineFinancialHealth(financials: any): string {
  if (!financials.turnover && !financials.net_assets) return 'unknown'
  const hasPositiveAssets = financials.net_assets > 0
  const hasPositiveProfit = financials.profit_loss > 0
  const hasCash = financials.cash > 0
  const positiveSignals = [hasPositiveAssets, hasPositiveProfit, hasCash].filter(Boolean).length
  if (positiveSignals === 3) return 'healthy'
  if (positiveSignals === 2) return 'stable'
  if (positiveSignals === 1) return 'watch'
  return 'distressed'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { firmId, companyNumber, companyName } = body

  if (!firmId || !companyNumber) {
    return NextResponse.json({ error: 'firmId and companyNumber required' }, { status: 400 })
  }

  try {
    // Step 1: Get filing history
    const filings = await getFilingHistory(companyNumber)
    if (!filings?.items?.length) {
      return NextResponse.json({ error: 'No filings found' }, { status: 404 })
    }

    // Step 2: Find most recent accounts filing with a document
    const accountsFiling = filings.items.find((f: any) =>
      f.links?.document_metadata && f.category === 'accounts'
    )

    if (!accountsFiling) {
      return NextResponse.json({ error: 'No accounts document found' }, { status: 404 })
    }

    // Step 3: Download the PDF
    const docId = accountsFiling.links.document_metadata.split('/').pop()
    const pdfRes = await fetch(
      `https://document-api.company-information.service.gov.uk/document/${docId}/content`,
      { headers: { ...chHeaders(), Accept: 'application/pdf' } }
    )

    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Could not download PDF: ${pdfRes.status}` }, { status: 500 })
    }

    // Step 4: Extract text from PDF
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    const pdfText = extractTextFromPDF(pdfBuffer)

    if (!pdfText || pdfText.length < 50) {
      return NextResponse.json({
        error: 'Could not extract text — this appears to be a scanned document.',
      }, { status: 422 })
    }

    // Step 5: Extract financials with OpenAI
    const financials = await extractFinancialsWithOpenAI(pdfText, companyName)

    // Step 6: Determine financial health
    const financialHealth = determineFinancialHealth(financials)

    // Step 7: Save to Supabase
    const { error } = await supabaseAdmin
      .from('firms')
      .update({
        financials_extracted: true,
        turnover: financials.turnover,
        net_assets: financials.net_assets,
        cash: financials.cash,
        profit_loss: financials.profit_loss,
        employee_count: financials.employee_count,
        financial_year: financials.financial_year_end,
        financial_health: financialHealth,
        financials_raw: financials,
      })
      .eq('id', firmId)

    if (error) throw error

    return NextResponse.json({ success: true, financials, financialHealth })
  } catch (err: any) {
    console.error('Financial extraction error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}