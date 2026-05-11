import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { outcome, notes } = body

  if (!outcome || !['interested', 'passed', 'no_answer', 'callback'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be: interested, passed, no_answer, or callback' }, { status: 400 })
  }

  // Map outcome to firm status updates
  const statusMap: Record<string, { status: string; outreach_status: string }> = {
    interested: { status: 'interested', outreach_status: 'interested' },
    passed: { status: 'passed', outreach_status: 'passed' },
    no_answer: { status: 'approached', outreach_status: 'contacted' },
    callback: { status: 'approached', outreach_status: 'contacted' },
  }

  const update = {
    phone_flagged: false,
    call_outcome: outcome,
    call_notes: notes || null,
    called_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    ...statusMap[outcome],
  }

  const { error } = await supabaseAdmin.from('firms').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log the call in outreach_log for the audit trail
  const { data: firm } = await supabaseAdmin.from('firms').select('company_number').eq('id', id).single()

  await supabaseAdmin.from('outreach_log').insert({
    firm_id: id,
    company_number: firm?.company_number || '',
    director_name: 'David Farkash',
    to_email: 'phone-call',
    subject: `Phone call outcome: ${outcome}`,
    body: notes || `Called. Outcome: ${outcome}`,
    email_source: 'phone_call',
    agent_reasoning: `Manual phone call logged by David. Outcome: ${outcome}.`,
    follow_up_number: 0,
  })

  return NextResponse.json({ success: true })
}