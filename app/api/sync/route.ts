import { NextRequest, NextResponse } from 'next/server'
import { searchCompaniesBySIC, getOfficers, estimateAge, analyseSuccession, getRegionFromPostcode } from '@/lib/companies-house'
import { scoreFirm, getPriorityFromScore } from '@/lib/scoring'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { sicCode = '69201', maxPages = 10, postcodePrefix = '', sector = null, play = null } = body

  const { data: job } = await supabaseAdmin
    .from('sync_jobs')
    .insert({ status: 'running', metadata: { sicCode, maxPages, postcodePrefix, sector } })
    .select()
    .single()

  const jobId = job?.id
  let firmsDiscovered = 0
  let firmsAdded = 0

  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 100
      let result
      try {
        result = await searchCompaniesBySIC(sicCode, offset, 100, postcodePrefix)
      } catch (err) {
        console.error(`SIC ${sicCode} search error:`, err)
        break
      }

      if (!result?.items || result.items.length === 0) break

      firmsDiscovered += result.items.length

      for (const company of result.items) {
        try {
          const officers = await getOfficers(company.company_number)

          const directors = officers
            .filter((o: any) => o.date_of_birth)
            .map((o: any) => ({
              name: o.name,
              dob_month: o.date_of_birth.month,
              dob_year: o.date_of_birth.year,
              age_estimate: estimateAge(o.date_of_birth.month, o.date_of_birth.year),
              appointed_on: o.appointed_on,
            }))

          const oldestDirectorAge = directors.length > 0
            ? Math.max(...directors.map((d: any) => d.age_estimate))
            : 0

          const succession = analyseSuccession(directors)

          const yearsInBusiness = company.date_of_creation
            ? Math.floor((Date.now() - new Date(company.date_of_creation).getTime()) / (1000 * 60 * 60 * 24 * 365))
            : 0

          const postcode = company.registered_office_address?.postal_code || ''
          const region = getRegionFromPostcode(postcode)

          const { total, breakdown } = scoreFirm({
            oldestDirectorAge,
            directorCount: directors.length || officers.length,
            hasSuccessionRisk: succession.hasSuccessionRisk,
            successorAge: succession.successorAge,
            yearsInBusiness,
            hasWebsite: false,
          })

          await supabaseAdmin.from('firms').upsert({
            company_number: company.company_number,
            company_name: company.company_name,
            company_status: company.company_status,
            sic_codes: company.sic_codes || [sicCode],
            date_of_creation: company.date_of_creation || null,
            registered_address: company.registered_office_address,
            postcode,
            region,
            sector,
            play,
            directors,
            oldest_director_age: oldestDirectorAge,
            director_count: directors.length || officers.length,
            has_succession_risk: succession.hasSuccessionRisk,
            successor_age: succession.successorAge || null,
            successor_name: succession.successorName || null,
            last_accounts_date: company.accounts?.last_accounts?.made_up_to || null,
            accounts_type: company.accounts?.last_accounts?.type || null,
            apex_score: total,
            score_breakdown: breakdown,
            priority: getPriorityFromScore(total),
          }, { onConflict: 'company_number' })

          firmsAdded++
          await new Promise(r => setTimeout(r, 150))
        } catch (err) {
          console.error(`Error processing ${company.company_number}:`, err)
        }
      }

      if (firmsDiscovered >= result.total_results) break
    }

    await supabaseAdmin.from('sync_jobs').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      firms_discovered: firmsDiscovered,
      firms_added: firmsAdded,
    }).eq('id', jobId)

    return NextResponse.json({ success: true, firmsDiscovered, firmsAdded, jobId })
  } catch (err: any) {
    await supabaseAdmin.from('sync_jobs').update({ status: 'failed', error: err.message }).eq('id', jobId)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ jobs: data })
}