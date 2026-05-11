const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!
const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(
  text: string,
  buttons?: { text: string; url: string }[][]
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured — would have sent:', text)
    return
  }

  const body: any = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
  }

  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: buttons.map(row =>
        row.map(btn => ({ text: btn.text, url: btn.url }))
      ),
    }
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
    }
  } catch (err) {
    console.error('Telegram fetch error:', err)
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
  const preview = params.replyBody.slice(0, 200).replace(/\n/g, ' ')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://apex-succession.vercel.app'

  const text = [
    `🔥 <b>Warm lead — ${params.directorName}</b>`,
    `<b>${params.firmName}</b> · ${params.sector}`,
    `Emailed by: ${params.senderName}`,
    ``,
    `<i>"${preview}${params.replyBody.length > 200 ? '...' : ''}"</i>`,
  ].join('\n')

  const buttons: { text: string; url: string }[][] = []

  const row1: { text: string; url: string }[] = []
  if (params.phone) {
    row1.push({ text: '📞 Call now', url: `tel:${params.phone.replace(/\s/g, '')}` })
  }
  row1.push({ text: '🏢 View in Apex', url: `${appUrl}?firm=${params.firmId}` })
  buttons.push(row1)

  await sendTelegramMessage(text, buttons)
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
    ? `\n\n<b>Call queue:</b>\n${params.flaggedNames.map(n => `• ${n}`).join('\n')}`
    : ''

  await sendTelegramMessage(lines + flaggedSection)
}