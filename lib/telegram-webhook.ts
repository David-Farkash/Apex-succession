import { supabaseAdmin } from './supabase'
import { sendTelegramMessage } from './telegram'
import { sendEmail } from './gmail'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!

// Verify request is from your chat only (security)
export function isAuthorized(chatId: number | string): boolean {
  return String(chatId) === String(TELEGRAM_CHAT_ID)
}

export async function answerCallback(callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    })
  } catch (err) {
    console.error('Telegram callback answer error:', err)
  }
}

export async function handleCallback(callbackData: string, callbackId: string): Promise<void> {
  const [action, firmId] = callbackData.split(':')

  if (!firmId) {
    await answerCallback(callbackId, 'Invalid action')
    return
  }

  const { data: firm } = await supabaseAdmin
    .from('firms')
    .select('company_name')
    .eq('id', firmId)
    .single()

  if (!firm) {
    await answerCallback(callbackId, 'Firm not found')
    return
  }

  if (action === 'interested') {
    await supabaseAdmin.from('firms').update({
      status: 'interested',
      outreach_status: 'interested',
      last_activity: new Date().toISOString(),
    }).eq('id', firmId)
    await answerCallback(callbackId, '✓ Marked as interested')
    await sendTelegramMessage(`✓ <b>${firm.company_name}</b> marked as interested.`)
    return
  }

  if (action === 'skip') {
    await supabaseAdmin.from('firms').update({
      status: 'passed',
      outreach_status: 'passed',
      phone_flagged: false,
      last_activity: new Date().toISOString(),
    }).eq('id', firmId)
    await answerCallback(callbackId, '✕ Passed')
    await sendTelegramMessage(`✕ <b>${firm.company_name}</b> marked as passed.`)
    return
  }

  await answerCallback(callbackId, 'Unknown action')
}

export async function handleCommand(text: string): Promise<void> {
  const [command, ...args] = text.trim().split(/\s+/)
  const arg = args.join(' ').trim()

  switch (command.toLowerCase()) {
    case '/help':
    case '/start':
      await sendTelegramMessage([
        `<b>Apex bot commands</b>`,
        ``,
        `<b>Status</b>`,
        `/status — today's activity summary`,
        `/queue — call queue`,
        `/replies — recent replies awaiting attention`,
        ``,
        `<b>Search</b>`,
        `/find [name] — search firms by name`,
        ``,
        `<b>Firm actions</b>`,
        `/skip [firm name] — mark a firm as passed`,
        `/interested [firm name] — mark as interested`,
        `/followup [firm name] — trigger a follow-up email`,
        `/note [firm name] :: [your note] — add a note`,
        ``,
        `<b>Agent control</b>`,
        `/pause — stop the agent`,
        `/resume — restart the agent`,
        `/guidance [text] — give the agent guidance for future runs`,
        ``,
        `<b>Reply to a warm lead alert</b> with text and the bot will send that text as an email back to the prospect.`,
      ].join('\n'))
      return

    case '/status':
      await handleStatus()
      return

    case '/queue':
      await handleQueue()
      return

    case '/replies':
      await handleReplies()
      return

    case '/find':
      await handleFind(arg)
      return

    case '/skip':
      await handleFirmAction(arg, 'skip')
      return

    case '/interested':
      await handleFirmAction(arg, 'interested')
      return

    case '/followup':
      await handleFirmAction(arg, 'followup')
      return

    case '/note':
      await handleNote(arg)
      return

    case '/pause':
      await supabaseAdmin.from('agent_settings').upsert({ key: 'paused', value: true, updated_at: new Date().toISOString() })
      await sendTelegramMessage('⏸ <b>Agent paused.</b> No new outreach until /resume.')
      return

    case '/resume':
      await supabaseAdmin.from('agent_settings').upsert({ key: 'paused', value: false, updated_at: new Date().toISOString() })
      await sendTelegramMessage('▶️ <b>Agent resumed.</b>')
      return

    case '/guidance':
      if (!arg) {
        await sendTelegramMessage('Usage: /guidance [your direction]\n\nExample: /guidance Focus on funeral directors this week, skip accountancies.')
        return
      }
      await supabaseAdmin.from('agent_directives').insert({
        directive: arg,
        active: true,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      })
      await sendTelegramMessage(`📌 <b>Guidance saved.</b>\n\nThe agent will consider this on its next run:\n<i>"${arg}"</i>\n\nGuidance expires in 14 days. Use /clearguidance to remove all.`)
      return

    case '/clearguidance':
      await supabaseAdmin.from('agent_directives').update({ active: false }).eq('active', true)
      await sendTelegramMessage('🧹 All active guidance cleared.')
      return

    default:
      await sendTelegramMessage(`Unknown command. Send /help to see available commands.`)
  }
}

async function handleStatus() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [emailsToday, repliesToday, flagged, lastRun, paused] = await Promise.all([
    supabaseAdmin.from('outreach_log').select('sent_by', { count: 'exact' }).gte('created_at', today.toISOString()).neq('email_source', 'flag').neq('email_source', 'phone_call'),
    supabaseAdmin.from('reply_log').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabaseAdmin.from('firms').select('*', { count: 'exact', head: true }).eq('phone_flagged', true),
    supabaseAdmin.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(1).single(),
    supabaseAdmin.from('agent_settings').select('value').eq('key', 'paused').single(),
  ])

  const emailsCount = emailsToday.count || 0
  const davidCount = emailsToday.data?.filter(e => e.sent_by === 'david').length || 0
  const zackCount = emailsToday.data?.filter(e => e.sent_by === 'zack').length || 0
  const isPaused = paused.data?.value === true

  const lastRunTime = lastRun.data ? new Date(lastRun.data.created_at).toLocaleString('en-GB') : 'Never'

  await sendTelegramMessage([
    `📊 <b>Status</b>`,
    ``,
    `Today:`,
    `✉️ ${emailsCount} emails sent (David: ${davidCount}, Zack: ${zackCount})`,
    `💬 ${repliesToday.count || 0} replies received`,
    `📞 ${flagged.count || 0} firms in call queue`,
    ``,
    `Last agent run: ${lastRunTime}`,
    isPaused ? `⏸ <b>Agent is paused</b>` : `▶️ Agent is active`,
  ].join('\n'))
}

async function handleQueue() {
  const { data: firms } = await supabaseAdmin
    .from('firms')
    .select('id, company_name, contact_phone, directors, sector')
    .eq('phone_flagged', true)
    .limit(20)

  if (!firms || firms.length === 0) {
    await sendTelegramMessage('📞 <b>Call queue empty.</b>')
    return
  }

  const lines = firms.map((f: any) => {
    const director = f.directors?.[0]?.name || ''
    const phone = f.contact_phone ? ` · ${f.contact_phone}` : ''
    return `• <b>${f.company_name}</b>${director ? ` (${director})` : ''}${phone}`
  })

  await sendTelegramMessage(`📞 <b>Call queue (${firms.length})</b>\n\n${lines.join('\n')}`)
}

async function handleReplies() {
  const { data: replies } = await supabaseAdmin
    .from('reply_log')
    .select('*, firms(company_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!replies || replies.length === 0) {
    await sendTelegramMessage('💬 <b>No recent replies.</b>')
    return
  }

  const blocks = replies.map((r: any) => {
    const firmName = r.firms?.company_name || r.from_email
    const preview = (r.body || '').slice(0, 150).replace(/\n/g, ' ')
    return `<b>${firmName}</b> (${r.classification || 'pending'})\n<i>${preview}...</i>`
  })

  await sendTelegramMessage(`💬 <b>Recent replies</b>\n\n${blocks.join('\n\n')}`)
}

async function handleFind(query: string) {
  if (!query) {
    await sendTelegramMessage('Usage: /find [name]')
    return
  }

  const { data: firms } = await supabaseAdmin
    .from('firms')
    .select('id, company_name, sector, region, contact_phone, outreach_status')
    .ilike('company_name', `%${query}%`)
    .limit(10)

  if (!firms || firms.length === 0) {
    await sendTelegramMessage(`🔍 No firms found matching "${query}"`)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://apex-succession.vercel.app'
  const lines = firms.map(f => `• <a href="${appUrl}?firm=${f.id}">${f.company_name}</a> · ${f.sector || '—'} · ${f.outreach_status || 'not contacted'}`)

  await sendTelegramMessage(`🔍 <b>Found ${firms.length} firms</b>\n\n${lines.join('\n')}`)
}

async function findFirmByName(query: string) {
  const { data } = await supabaseAdmin
    .from('firms')
    .select('*')
    .ilike('company_name', `%${query}%`)
    .limit(2)
  return data || []
}

async function handleFirmAction(query: string, action: 'skip' | 'interested' | 'followup') {
  if (!query) {
    await sendTelegramMessage(`Usage: /${action} [firm name]`)
    return
  }

  const matches = await findFirmByName(query)

  if (matches.length === 0) {
    await sendTelegramMessage(`🔍 No firm found matching "${query}"`)
    return
  }

  if (matches.length > 1) {
    const names = matches.map(f => `• ${f.company_name}`).join('\n')
    await sendTelegramMessage(`⚠️ Multiple matches for "${query}":\n${names}\n\nBe more specific.`)
    return
  }

  const firm = matches[0]

  if (action === 'skip') {
    await supabaseAdmin.from('firms').update({
      status: 'passed', outreach_status: 'passed', phone_flagged: false,
    }).eq('id', firm.id)
    await sendTelegramMessage(`✕ <b>${firm.company_name}</b> passed.`)
  } else if (action === 'interested') {
    await supabaseAdmin.from('firms').update({
      status: 'interested', outreach_status: 'interested',
    }).eq('id', firm.id)
    await sendTelegramMessage(`✓ <b>${firm.company_name}</b> marked interested.`)
  } else if (action === 'followup') {
    // Queue a follow-up by clearing the last_contacted_at safety check
    await supabaseAdmin.from('firms').update({
      last_contacted_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', firm.id)
    await sendTelegramMessage(`📤 <b>${firm.company_name}</b> queued for follow-up on next agent run.`)
  }
}

async function handleNote(input: string) {
  const [firmQuery, ...noteParts] = input.split('::')
  const note = noteParts.join('::').trim()

  if (!firmQuery || !note) {
    await sendTelegramMessage('Usage: /note [firm name] :: [your note]\n\nExample: /note North Accountancy :: Spoke to Peter, wants to chat in two weeks.')
    return
  }

  const matches = await findFirmByName(firmQuery.trim())

  if (matches.length === 0) {
    await sendTelegramMessage(`🔍 No firm found matching "${firmQuery.trim()}"`)
    return
  }

  if (matches.length > 1) {
    await sendTelegramMessage(`⚠️ Multiple matches for "${firmQuery.trim()}". Be more specific.`)
    return
  }

  const firm = matches[0]
  const existingNotes = firm.notes || ''
  const timestamp = new Date().toLocaleString('en-GB')
  const newNote = `[${timestamp}] ${note}`
  const combinedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote

  await supabaseAdmin.from('firms').update({ notes: combinedNotes }).eq('id', firm.id)
  await sendTelegramMessage(`📝 Note added to <b>${firm.company_name}</b>.`)
}

export async function handleReplyToAlert(replyToMessageId: number, replyText: string): Promise<void> {
  // Find the alert this is replying to
  const { data: alert } = await supabaseAdmin
    .from('telegram_alerts')
    .select('*')
    .eq('telegram_message_id', replyToMessageId)
    .single()

  if (!alert) {
    await sendTelegramMessage('⚠️ Could not find the alert you replied to. The mapping may have been deleted.')
    return
  }

  // Daily digest reply → save as guidance
  if (alert.alert_type === 'digest') {
    await supabaseAdmin.from('agent_directives').insert({
      directive: replyText,
      active: true,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    await sendTelegramMessage(`📌 <b>Guidance noted</b> for the next agent run:\n<i>"${replyText}"</i>`)
    return
  }

  // Warm lead reply → send the text as an email back to the prospect
  if (alert.alert_type === 'warm_lead' && alert.firm_id) {
    const { data: firm } = await supabaseAdmin
      .from('firms')
      .select('*')
      .eq('id', alert.firm_id)
      .single()

    if (!firm || !firm.contact_email) {
      await sendTelegramMessage(`⚠️ No email on file for ${firm?.company_name || 'this firm'}.`)
      return
    }

    // Determine sender based on who originally emailed this firm
    const sender = firm.last_sender === 'zack' ? 'zack' : 'david'
    const fromName = sender === 'zack' ? 'Zack' : 'David Farkash'
    const fromEmail = sender === 'zack' ? (process.env.GMAIL_USER_ZACK || process.env.GMAIL_USER!) : process.env.GMAIL_USER!

    // Get the original subject from the most recent outreach to thread the reply
    const { data: lastOutreach } = await supabaseAdmin
      .from('outreach_log')
      .select('subject')
      .eq('firm_id', firm.id)
      .neq('email_source', 'flag')
      .neq('email_source', 'phone_call')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const subject = lastOutreach?.subject ? `Re: ${lastOutreach.subject.replace(/^Re:\s*/i, '')}` : 'Following up'

    const directorName = (alert.context as any)?.directorName || firm.directors?.[0]?.name?.split(' ')[0] || 'there'

    const emailBody = `Hi ${directorName},\n\n${replyText}`

    const result = await sendEmail({
      to: firm.contact_email,
      subject,
      body: emailBody,
      fromName,
      fromEmail,
    })

    if (result.success) {
      await supabaseAdmin.from('outreach_log').insert({
        firm_id: firm.id,
        company_number: firm.company_number,
        director_name: directorName,
        to_email: firm.contact_email,
        subject,
        body: emailBody,
        email_source: 'manual_reply',
        gmail_message_id: result.messageId,
        agent_reasoning: `Manual reply from ${fromName} via Telegram in response to warm lead.`,
        follow_up_number: (firm.follow_up_count || 0) + 1,
        sent_by: sender,
      })
      await sendTelegramMessage(`✉️ <b>Reply sent</b> to ${directorName} at ${firm.company_name} from ${fromName}.`)
    } else {
      await sendTelegramMessage(`❌ Failed to send: ${result.error}`)
    }
    return
  }

  await sendTelegramMessage('⚠️ Did not understand what to do with this reply.')
}