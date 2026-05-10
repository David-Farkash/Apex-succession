import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabaseAdmin
    .from('firms')
    .select('*, outreach_log(*), reply_log(*)', { count: 'exact' })
    .not('outreach_status', 'eq', 'not_contacted')
    .order('last_contacted_at', { ascending: false })

  if (status) query = query.eq('outreach_status', status)
  if (search) query = query.ilike('company_name', `%${search}%`)

  query = query.range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stats = await supabaseAdmin.from('firms').select('outreach_status', { count: 'exact' })
  const { data: runData } = await supabaseAdmin.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(5)
  const { data: recentEmails } = await supabaseAdmin.from('outreach_log').select('*').order('created_at', { ascending: false }).limit(5)
  const { data: recentReplies } = await supabaseAdmin.from('reply_log').select('*').order('created_at', { ascending: false }).limit(10)
  const { data: flagged } = await supabaseAdmin.from('firms').select('*').or('phone_flagged.eq.true,linkedin_flagged.eq.true')

  return NextResponse.json({
    firms: data,
    total: count,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    recentRuns: runData || [],
    recentEmails: recentEmails || [],
    recentReplies: recentReplies || [],
    flagged: flagged || [],
  })
}