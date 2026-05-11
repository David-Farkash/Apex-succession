import { supabaseAdmin } from './supabase'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!
const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(
  text: string,
  buttons?: { text: string; url?: string; callback_data?: string }[][],
  replyToMessageId?: number
): Promise<number | null> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured — would have sent:', text)
    return null
  }

  const body: any = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
  }

  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: buttons.map(row =>
        row.map(btn => {
          const b: any = { text: btn.text }
          if (btn.url) b.url = btn.url
          if (btn.callback_data) b.callback_data = btn.callback_data
          return b
        })
      ),
    }
  }

  if (replyToMessageId) {
    body.reply_to_message_id = replyToMessageId
  }

  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('Telegram send error:', data.description)
      return null
    }
    return data.result?.message_id || null
  } catch (err) {
    console.error('Telegram fetch error:', err)
    return null
  }
}

export async function sendWarmLeadAlert(params: {
  firmId: string
  firmName: string
  directorName: string
  sector: string
  replyBody: string
  phone?: string
  senderName: string
}): Promise<void> {
  const preview = params.replyBody.slice(0, 250).replace(/\n/g, ' ')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://apex-succession.vercel.app'

  const text = [
    `🔥 <b>Warm lead — ${params.directorName}</b>`,
    `<b>${params.firmName}</b> · ${params.sector}`,
    `Emailed by: ${params.senderName}`,
    ``,
    `<i>"${preview}${params.replyBody.length > 250 ? '...' : ''}"</i>`,
    ``,
    `💬 <b>Reply to this message</b> to send a response back to ${params.directorName}.`,
  ].join('\n')

  const buttons: { text: string; url?: string; callback_data?: string }[][] = []
  const row1: { text: string; url?: string; callback_data?: string }[] = []
  if (params.phone) {
    row1.push({ text: '📞 Call now', url: `tel:${params.phone.replace(/\s/g, '')}` })
  }
  row1.push({ text: '🏢 View in Apex', url: `${appUrl}?firm=${params.firmId}` })
  buttons.push(row1)
  buttons.push([
    { text: '✓ Mark interested', callback_data: `interested:${params.firmId}` },
    { text: '✕ Pass', callback_data: `skip:${params.firmId}` },
  ])

  const messageId = await sendTelegramMessage(text, buttons)

  // Save mapping so replies can be threaded back to this firm
  if (messageId) {
    await supabaseAdmin.from('telegram_alerts').insert({
      telegram_message_id: messageId,
      firm_id: params.firmId,
      alert_type: 'warm_lead',
      context: {
        firmName: params.firmName,
        directorName: params.directorName,
        sector: params.sector,
        replyBody: params.replyBody,
      },
    })
  }
}

export async function sendDailyDigest(params: {
  emailsSent: number
  bouncesDetected: number
  repliesReceived: number
  warmLeads: number
  firmsFlagged: number
  flaggedNames: string[]
  senderBreakdown: { david: number; zack: number }
}): Promise<void> {
  const lines = [
    `📊 <b>Apex Daily Digest</b>`,
    ``,
    `✉️ Emails sent: <b>${params.emailsSent}</b>`,
    params.senderBreakdown.david > 0 || params.senderBreakdown.zack > 0
      ? `   David: ${params.senderBreakdown.david} · Zack: ${params.senderBreakdown.zack}`
      : null,
    `🔄 Bounces: <b>${params.bouncesDetected}</b>`,
    `💬 Replies: <b>${params.repliesReceived}</b>`,
    `🔥 Warm leads: <b>${params.warmLeads}</b>`,
    `📞 Flagged for call: <b>${params.firmsFlagged}</b>`,
  ].filter(Boolean).join('\n')

  const flaggedSection = params.flaggedNames.length > 0
    ? `\n\n<b>Call queue:</b>\n${params.flaggedNames.slice(0, 10).map(n => `• ${n}`).join('\n')}`
    : ''

  const tail = `\n\n💡 <i>Reply to this message with guidance for tomorrow's run (e.g. "focus on funeral directors", "slow down on accountancies").</i>`

  const messageId = await sendTelegramMessage(lines + flaggedSection + tail)

  if (messageId) {
    await supabaseAdmin.from('telegram_alerts').insert({
      telegram_message_id: messageId,
      alert_type: 'digest',
      context: { summary: params },
    })
  }
}

// Helper to look up which firm an alert belongs to (used by webhook)
export async function getAlertContext(telegramMessageId: number) {
  const { data } = await supabaseAdmin
    .from('telegram_alerts')
    .select('*')
    .eq('telegram_message_id', telegramMessageId)
    .single()
  return data
}