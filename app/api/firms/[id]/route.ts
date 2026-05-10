import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const regions = searchParams.get('regions')
  const postcodes = searchParams.get('postcodes')
  const minAge = searchParams.get('minAge')
  const maxAge = searchParams.get('maxAge')
  const minPeople = searchParams.get('minPeople')
  const maxPeople = searchParams.get('maxPeople')
  const successionOnly = searchParams.get('successionOnly') === 'true'
  const noWebsite = searchParams.get('noWebsite') === 'true'
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const sortBy = searchParams.get('sortBy') || 'apex_score'
  const sortDir = searchParams.get('sortDir') || 'desc'

  let query = supabaseAdmin
    .from('firms')
    .select('*', { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (minAge) query = query.gte('oldest_director_age', parseInt(minAge))
  if (maxAge) query = query.lte('oldest_director_age', parseInt(maxAge))
  if (minPeople) query = query.gte('director_count', parseInt(minPeople))
  if (maxPeople) query = query.lte('director_count', parseInt(maxPeople))
  if (successionOnly) query = query.eq('has_succession_risk', true)
  if (noWebsite) query = query.eq('has_website', false)
  if (search) query = query.ilike('company_name', `%${search}%`)

  if (regions) {
    const regionList = regions.split(',')
    query = query.in('region', regionList)
  }

  if (postcodes) {
    const postcodeList = postcodes.split(',')
    const postcodeFilters = postcodeList.map(p => `postcode.ilike.${p}%`).join(',')
    query = query.or(postcodeFilters)
  }

  query = query
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    firms: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}