import { supabaseAdmin } from './supabase'
import { sendEmail, getUnreadReplies, markAsRead } from './gmail'
import { lookupDirectorEmail } from './apollo'

export async function getFirms(options: {
  minScore?: number
  maxScore?: number
  sector?: string
  outreachStatus?: string
  limit?: number
  followUpDue?: boolean
}) {
  let query = supabaseAdmin
    .from('firms')
    .select('*')
    .eq('company_status', 'active')
    .order('apex_score', { ascending: false })
    .limit(options.limit || 20)

  if (options.minScore) query = query.gte('apex_score', options.minScore)
  if (options.maxScore) query = query.lte('apex_score', options.maxScore)
  if (options.sector) query = query.eq('sector', options.sector)
  if (options.outreachStatus) query = query.eq('outreach_status', options.outreachStatus)

  if (options.followUpDue) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query
      .eq('outreach_status', 'contacted')
      .lt('last_contacted_at', sevenDaysAgo)
      .lt('follow_up_count', 3)
  }

  const { data } = await query
  return data || []
}

export async function getFirmHistory(firmId: string) {
  const [outreach, replies, firm] = await Promise.all([
    supabaseAdmin.from('outreach_log').select('*').eq('firm_id', firmId).order('created_at'),
    supabaseAdmin.from('reply_log').select('*').eq('firm_id', firmId).order('created_at'),
    supabaseAdmin.from('firms').select('*').eq('id', firmId).single(),
  ])

  return {
    firm: firm.data,
    outreach: outreach.data || [],
    replies: replies.data || [],
  }
}

export async function apolloLookup(directorName: string, companyName: string, website?: string) {
  let domain: string | undefined
  if (website) {
    try {
      domain = new URL(website).hostname.replace('www.', '')
    } catch {}
  }
  return lookupDirectorEmail(directorName, companyName, domain)
}

export async function findContact(firmId: string, companyName: string, postcode: string, directorName: string, companyNumber: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const res = await fetch(`${baseUrl}/api/enrich/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firmId, companyName, postcode, directorName, companyNumber }),
  })
  return res.json()
}

export async function sendOutreachEmail(params: {
  firmId: string
  companyNumber: string
  directorName: string
  toEmail: string
  subject: string
  body: string
  emailSource: string
  reasoning: string
  followUpNumber: number
}) {
  const result = await sendEmail({
    to: params.toEmail,
    subject: params.subject,
    body: params.body,
    fromName: 'David Farkash',
  })

  if (result.success) {
    await supabaseAdmin.from('outreach_log').insert({
      firm_id: params.firmId,
      company_number: params.companyNumber,
      director_name: params.directorName,
      to_email: params.toEmail,
      subject: params.subject,
      body: params.body,
      email_source: params.emailSource,
      gmail_message_id: result.messageId,
      agent_reasoning: params.reasoning,
      follow_up_number: params.followUpNumber,
    })

    await supabaseAdmin.from('firms').update({
      outreach_status: 'contacted',
      last_contacted_at: new Date().toISOString(),
      follow_up_count: params.followUpNumber,
      status: 'approached',
    }).eq('id', params.firmId)
  }

  return result
}

export async function readInbox() {
  const messages = await getUnreadReplies()
  const processed = []

  for (const msg of messages) {
    const headers = msg.payload?.headers || []
    const from = headers.find((h: any) => h.name === 'From')?.value || ''
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
    const messageId = msg.id

    let body = ''
    if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8')
    } else if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain')
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
      }
    }

    const emailMatch = from.match(/<(.+)>/) || [null, from]
    const fromEmail = emailMatch[1]

    const { data: outreach } = await supabaseAdmin
      .from('outreach_log')
      .select('*, firms(*)')
      .eq('to_email', fromEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    processed.push({
      messageId,
      from,
      fromEmail,
      subject,
      body: body.slice(0, 3000),
      firm: outreach?.firms || null,
      firmId: outreach?.firm_id || null,
    })

    await markAsRead(messageId)
  }

  return processed
}

export async function logReply(params: {
  firmId: string
  companyNumber: string
  fromEmail: string
  subject: string
  body: string
  gmailMessageId: string
  classification: string
  agentResponse?: string
  escalatedToDavid: boolean
}) {
  await supabaseAdmin.from('reply_log').insert({
    firm_id: params.firmId,
    company_number: params.companyNumber,
    from_email: params.fromEmail,
    subject: params.subject,
    body: params.body,
    gmail_message_id: params.gmailMessageId,
    classification: params.classification,
    agent_response: params.agentResponse,
    escalated_to_david: params.escalatedToDavid,
  })

  await supabaseAdmin.from('firms').update({
    outreach_status: params.classification === 'warm' ? 'interested' : params.classification === 'cold' ? 'passed' : 'replied',
    last_reply_at: new Date().toISOString(),
    status: params.classification === 'warm' ? 'interested' : params.classification === 'cold' ? 'passed' : 'approached',
  }).eq('id', params.firmId)
}

export async function saveLearning(sector: string, observation: string, evidence: any, confidence: number) {
  await supabaseAdmin.from('agent_learnings').insert({ sector, observation, evidence, confidence })
}

export async function getLearnings(sector?: string) {
  let query = supabaseAdmin.from('agent_learnings').select('*').order('confidence', { ascending: false })
  if (sector) query = query.eq('sector', sector)
  const { data } = await query
  return data || []
}

export async function updateFirmStatus(firmId: string, updates: Record<string, any>) {
  await supabaseAdmin.from('firms').update(updates).eq('id', firmId)
}

export async function flagForDavid(firmId: string, type: 'phone' | 'linkedin', notes: string) {
  const update = type === 'phone'
    ? { phone_flagged: true }
    : { linkedin_flagged: true }

  await supabaseAdmin.from('firms').update(update).eq('id', firmId)
  await supabaseAdmin.from('outreach_log').insert({
    firm_id: firmId,
    agent_reasoning: `Flagged for David ${type} outreach: ${notes}`,
    follow_up_number: 0,
    to_email: 'flagged',
    subject: `${type} outreach required`,
    body: notes,
    email_source: 'flag',
  })
}

export async function notifyDavid(message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  const to = process.env.WHATSAPP_TO

  if (!accountSid || !authToken || !from || !to) {
    console.log('Twilio not configured — would have sent:', message)
    return
  }

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${to}`,
      Body: message,
    }),
  })
}