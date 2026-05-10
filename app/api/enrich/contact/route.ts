import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY!

async function getWebsiteFromPlaces(companyName: string, postcode: string): Promise<{ website?: string; phone?: string } | null> {
  try {
    const query = `${companyName} ${postcode}`
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
      new URLSearchParams({
        input: query,
        inputtype: 'textquery',
        fields: 'place_id,name',
        key: GOOGLE_PLACES_KEY,
      })
    )
    const searchData = await searchRes.json()
    if (!searchData.candidates?.[0]?.place_id) return null

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      new URLSearchParams({
        place_id: searchData.candidates[0].place_id,
        fields: 'website,formatted_phone_number',
        key: GOOGLE_PLACES_KEY,
      })
    )
    const detailData = await detailRes.json()
    return {
      website: detailData.result?.website,
      phone: detailData.result?.formatted_phone_number,
    }
  } catch {
    return null
  }
}

async function extractEmailFromWebsite(website: string, companyName: string): Promise<string | null> {
  try {
    const pagesToTry = [
      website,
      `${website.replace(/\/$/, '')}/contact`,
      `${website.replace(/\/$/, '')}/contact-us`,
      `${website.replace(/\/$/, '')}/about`,
    ]

    for (const url of pagesToTry) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue
        const html = await res.text()

        const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 100,
            messages: [
              {
                role: 'system',
                content: 'Extract the primary contact email address from this webpage HTML. Return ONLY the email address, nothing else. If no email found, return "none".',
              },
              {
                role: 'user',
                content: `Company: ${companyName}\n\nHTML (truncated):\n${html.slice(0, 8000)}`,
              },
            ],
          }),
        })

        const gptData = await gptRes.json()
        const email = gptData.choices?.[0]?.message?.content?.trim()
        if (email && email !== 'none' && email.includes('@')) {
          return email
        }
      } catch {
        continue
      }
    }
    return null
  } catch {
    return null
  }
}

function inferEmail(companyName: string, directorName: string): string | null {
  try {
    const domain = companyName.toLowerCase()
      .replace(/\b(limited|ltd|llp|plc|and|the|&)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()
    if (!domain || !directorName) return null
    const parts = directorName.trim().split(' ')
    const firstName = parts[0]?.toLowerCase()
    const lastName = parts[parts.length - 1]?.toLowerCase()
    if (!firstName || !lastName) return null
    return `${firstName}.${lastName}@${domain}.co.uk`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { firmId, companyName, postcode, directorName, companyNumber } = body

  if (!firmId || !companyName) {
    return NextResponse.json({ error: 'firmId and companyName required' }, { status: 400 })
  }

  let email: string | null = null
  let phone: string | null = null
  let website: string | null = null
  let emailSource = 'not found'

  try {
    // Step 1: Google Places
    const placesResult = await getWebsiteFromPlaces(companyName, postcode || '')
    if (placesResult?.website) website = placesResult.website
    if (placesResult?.phone) phone = placesResult.phone

    // Step 2: Scrape website for email
    if (website) {
      email = await extractEmailFromWebsite(website, companyName)
      if (email) emailSource = 'website'
    }

    // Step 3: Infer email from name + domain
    if (!email && directorName) {
      email = inferEmail(companyName, directorName)
      if (email) emailSource = 'inferred'
    }

    const contactable = !!(email || phone)

    await supabaseAdmin.from('contacts').upsert({
      firm_id: firmId,
      company_number: companyNumber,
      director_name: directorName,
      email,
      email_source: emailSource,
      phone,
      website,
      contactable,
      raw_data: { placesResult },
    }, { onConflict: 'firm_id' })

    await supabaseAdmin.from('firms').update({
      contact_found: contactable,
      contact_email: email,
      contact_phone: phone,
      contact_website: website,
    }).eq('id', firmId)

    return NextResponse.json({ success: true, email, phone, website, emailSource, contactable })
  } catch (err: any) {
    console.error('Contact enrichment error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const firmId = searchParams.get('firmId')
  if (!firmId) return NextResponse.json({ error: 'firmId required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('firm_id', firmId)
    .single()

  return NextResponse.json({ contact: data })
}