import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupDirectorPhone } from '@/lib/apollo'

export async function POST(req: NextRequest) {
  const { firmId } = await req.json()
  if (!firmId) return NextResponse.json({ error: 'firmId required' }, { status: 400 })

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single()

  if (!firm) return NextResponse.json({ error: 'firm not found' }, { status: 404 })

  const director = firm.directors?.[0]
  if (!director?.name) return NextResponse.json({ error: 'no director name' }, { status: 400 })

  let domain: string | undefined
  if (firm.contact_website) {
    try {
      domain = new URL(firm.contact_website).hostname.replace('www.', '')
    } catch {}
  }

  const result = await lookupDirectorPhone(director.name, firm.company_name, domain)

  if (result.phone) {
    await supabaseAdmin.from('firms').update({
      contact_phone: result.phone,
    }).eq('id', firmId)
  }

  return NextResponse.json(result)
}