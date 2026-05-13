import { supabaseAdmin } from './supabase'
import { sendEmail, getUnreadReplies, markAsRead } from './gmail'
import { lookupDirectorEmail } from './apollo'
import { sendTelegramMessage, sendWarmLeadAlert, sendDailyDigest } from './telegram'

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
  sender?: 'david' | 'zack'
}) {
  // DEDUPE: Refuse to send the same firm twice in the same 10-minute window
  // (prevents the agent from accidentally emailing the same firm twice in one run)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: recentSends } = await supabaseAdmin
    .from('outreach_log')
    .select('id')
    .eq('firm_id', params.firmId)
    .gt('created_at', tenMinAgo)
    .not('email_source', 'in', '(flag,blocked,bounce)')
    .limit(1)

  if (recentSends && recentSends.length > 0) {
    console.warn(`DEDUPE BLOCK: Firm ${params.firmId} already emailed in last 10 min`)
    return {
      success: false,
      error: 'Duplicate send blocked — firm was already contacted in this run. Move on to a different firm.',
    }
  }

  // HARD BLOCK: Never send to inferred emails regardless of what the agent says
  if (params.emailSource === 'inferred') {
    console.warn(`BLOCKED inferred email to ${params.toEmail} for firm ${params.firmId}`)

    // Auto-flag for phone outreach instead
    await supabaseAdmin.from('firms').update({
      phone_flagged: true,
    }).eq('id', params.firmId)

    await supabaseAdmin.from('outreach_log').insert({
      firm_id: params.firmId,
      company_number: params.companyNumber,
      director_name: params.directorName,
      to_email: 'BLOCKED',
      subject: 'BLOCKED: inferred email prevented',
      body: `Agent attempted to send inferred email to ${params.toEmail}. Blocked by system. Auto-flagged for phone outreach.`,
      email_source: 'blocked',
      agent_reasoning: params.reasoning,
      follow_up_number: params.followUpNumber,
      sent_by: params.sender || 'david',
    })

    return { success: false, error: 'Inferred emails are blocked at system level. Firm auto-flagged for phone outreach.' }
  }

  const sender = params.sender || 'david'

  const senderConfig = {
    david: {
      name: 'David Farkash',
      email: process.env.GMAIL_USER!,
    },
    zack: {
      name: 'Zack',
      email: process.env.GMAIL_USER_ZACK || process.env.GMAIL_USER!,
    },
  }

  const { name: fromName, email: fromEmail } = senderConfig[sender]

  const result = await sendEmail({
    to: params.toEmail,
    subject: params.subject,
    body: params.body,
    fromName,
    fromEmail,
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
      sent_by: sender,
    })

    await supabaseAdmin.from('firms').update({
      outreach_status: 'contacted',
      last_contacted_at: new Date().toISOString(),
      follow_up_count: params.followUpNumber,
      status: 'approached',
      contact_email: params.toEmail,
      contact_found: true,
      last_sender: sender,
    }).eq('id', params.firmId)
  }

  return { ...result, sender, fromName }
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
      sentBy: outreach?.sent_by || 'david',
    })

    await markAsRead(messageId)
  }

  return processed
}

export async function processBounces(messages: any[]): Promise<any[]> {
  const bounces = []

  for (const msg of messages) {
    const headers = msg.payload?.headers || []
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
    const from = headers.find((h: any) => h.name === 'From')?.value || ''

    const isBounce =
      subject.toLowerCase().includes('delivery status') ||
      subject.toLowerCase().includes('undelivered') ||
      subject.toLowerCase().includes('delivery failure') ||
      subject.toLowerCase().includes('failed to deliver') ||
      subject.toLowerCase().includes('address not found') ||
      subject.toLowerCase().includes('mail delivery') ||
      from.toLowerCase().includes('mailer-daemon') ||
      from.toLowerCase().includes('postmaster') ||
      from.toLowerCase().includes('mail delivery')

    if (!isBounce) continue

    let body = ''
    if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8')
    } else if (msg.payload?.parts) {
      for (const part of msg.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8')
          break
        }
        if (part.parts) {
          for (const subpart of part.parts) {
            if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
              body = Buffer.from(subpart.body.data, 'base64').toString('utf-8')
              break
            }
          }
        }
      }
    }

    const emailMatches = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
    const bouncedEmail = emailMatches.find(e =>
      !e.includes('mailer-daemon') &&
      !e.includes('postmaster') &&
      !e.includes('google.com') &&
      !e.includes('thesuccessiongroup')
    )

    if (!bouncedEmail) continue

    const { data: outreach } = await supabaseAdmin
      .from('outreach_log')
      .select('*, firms(*)')
      .eq('to_email', bouncedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!outreach?.firm_id) continue

    const firm = outreach.firms as any

    await supabaseAdmin.from('outreach_log').insert({
      firm_id: outreach.firm_id,
      company_number: outreach.company_number,
      director_name: outreach.director_name,
      to_email: bouncedEmail,
      subject: 'BOUNCED: ' + outreach.subject,
      body: `Email bounced. Original email to ${bouncedEmail} was not delivered.`,
      agent_reasoning: 'Automatic bounce detection — will attempt alternative contact',
      follow_up_number: -1,
      email_source: 'bounce',
    })

    await supabaseAdmin.from('firms').update({
      outreach_status: 'bounced',
      contact_email: null,
      contact_found: false,
    }).eq('id', outreach.firm_id)

    bounces.push({
      firmId: outreach.firm_id,
      firmName: firm?.company_name,
      companyNumber: outreach.company_number,
      bouncedEmail,
      postcode: firm?.postcode,
      phone: firm?.contact_phone,
      website: firm?.contact_website,
      directorName: outreach.director_name,
      sector: firm?.sector,
    })
  }

  return bounces
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

  if (params.classification === 'warm') {
    const { data: firm } = await supabaseAdmin
      .from('firms')
      .select('company_name, sector, contact_phone, directors, last_sender')
      .eq('id', params.firmId)
      .single()

    if (firm) {
      const directorName = firm.directors?.[0]?.name || 'Director'
      const senderName = firm.last_sender === 'zack' ? 'Zack' : 'David'
      await sendWarmLeadAlert({
        firmId: params.firmId,
        firmName: firm.company_name,
        directorName,
        sector: firm.sector || '',
        replyBody: params.body,
        phone: firm.contact_phone || undefined,
        senderName,
      })
    }
  }
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
    agent_reasoning: `Flagged for ${type} outreach: ${notes}`,
    follow_up_number: 0,
    to_email: 'flagged',
    subject: `${type} outreach required`,
    body: notes,
    email_source: 'flag',
  })
}

export async function notifyDavid(message: string, warmLeadParams?: {
  firmId: string
  firmName: string
  directorName: string
  sector: string
  replyBody: string
  phone?: string
  senderName: string
}) {
  if (warmLeadParams) {
    await sendWarmLeadAlert(warmLeadParams)
  } else {
    await sendTelegramMessage(message)
  }
}

export async function sendDigest(params: {
  emailsSent: number
  bouncesDetected: number
  repliesReceived: number
  warmLeads: number
  firmsFlagged: number
  flaggedNames: string[]
  senderBreakdown: { david: number; zack: number }
}) {
  await sendDailyDigest(params)
}

export async function isPaused(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('agent_settings')
    .select('value')
    .eq('key', 'paused')
    .single()
  return data?.value === true
}

export async function getActiveDirectives(): Promise<string[]> {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('agent_directives')
    .select('directive, created_at')
    .eq('active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data || []).map(d => d.directive)
}