import { google } from 'googleapis'

// David's Gmail client
const oauth2Client_david = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
)
oauth2Client_david.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
})

// Zack's Gmail client
const oauth2Client_zack = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
)
oauth2Client_zack.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN_ZACK,
})

const gmail_david = google.gmail({ version: 'v1', auth: oauth2Client_david })
const gmail_zack = google.gmail({ version: 'v1', auth: oauth2Client_zack })

const LOGO_URL = process.env.LOGO_URL || 'https://thesuccessiongroup.co.uk/tsg-logo.png'

function buildSignatureHtml(fromName: string): string {
  const isZack = fromName.toLowerCase().includes('zack')
  const phone = isZack ? '07879555955' : '07528821427'
  const displayName = isZack ? 'Zack' : 'David Farkash'

  return `
    <div style="margin-top: 24px; font-family: Arial, Helvetica, sans-serif; color: #0a1f15;">
      <div style="font-size: 14px; color: #0a1f15; margin-bottom: 2px;"><strong>${displayName}</strong></div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 8px;">The Succession Group</div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 16px;">
        <a href="tel:${phone}" style="color: #2d4a3a; text-decoration: none;">${phone}</a><br/>
        <a href="https://thesuccessiongroup.co.uk" style="color: #2d4a3a; text-decoration: none;">thesuccessiongroup.co.uk</a>
      </div>
      <img src="${LOGO_URL}" alt="The Succession Group" width="140" style="display: block; opacity: 0.85;" />
    </div>
  `
}

function plainToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter(p => p.length > 0)
    .map(p => `<p style="margin: 0 0 14px; line-height: 1.5; color: #0a1f15; font-family: Arial, Helvetica, sans-serif; font-size: 14px;">${p}</p>`)
    .join('')
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  const b64 = Buffer.from(value, 'utf-8').toString('base64')
  return `=?UTF-8?B?${b64}?=`
}

function makeEmailBody(
  to: string,
  subject: string,
  body: string,
  fromName: string,
  fromEmailOverride?: string
): string {
  const fromEmail = fromEmailOverride || process.env.GMAIL_USER
  const from = `${fromName} <${fromEmail}>`

  const cleanBody = body
    .replace(/\n*(kind regards|best regards|warm regards|best wishes|many thanks|regards|best|sincerely|yours sincerely)[,\s]*\n+[\s\S]*$/i, '')
    .replace(/\n*(david farkash|zack)[,\s]*[\s\S]*$/i, '')
    .trim()

  const bodyWithSignoff = `${cleanBody}\n\nKind regards,`

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0a1f15;">
      ${plainToHtml(bodyWithSignoff)}
      ${buildSignatureHtml(fromName)}
    </div>
  `

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlBody,
  ]
  const message = messageParts.join('\r\n')
  return Buffer.from(message, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendEmail({
  to,
  subject,
  body,
  fromName = 'David Farkash',
  fromEmail,
}: {
  to: string
  subject: string
  body: string
  fromName?: string
  fromEmail?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const isZack = fromName.toLowerCase().includes('zack')
    const gmailClient = isZack ? gmail_zack : gmail_david
    const senderEmail = isZack
      ? (process.env.GMAIL_USER_ZACK || process.env.GMAIL_USER!)
      : process.env.GMAIL_USER!

    const encoded = makeEmailBody(to, subject, body, fromName, fromEmail || senderEmail)
    const res = await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    })
    return { success: true, messageId: res.data.id || undefined }
  } catch (err: any) {
    console.error('Gmail send error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function getUnreadReplies(): Promise<any[]> {
  try {
    // Read from David's inbox (primary outreach account)
    const res = await gmail_david.users.messages.list({
      userId: 'me',
      q: 'is:unread to:me',
      maxResults: 50,
    })
    const messages = res.data.messages || []
    const davidMessages = await Promise.all(
      messages.map(m =>
        gmail_david.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
      )
    )

    // Also read from Zack's inbox if his token is configured
    let zackMessages: any[] = []
    if (process.env.GMAIL_REFRESH_TOKEN_ZACK) {
      try {
        const zackRes = await gmail_zack.users.messages.list({
          userId: 'me',
          q: 'is:unread to:me',
          maxResults: 50,
        })
        const zackMsgs = zackRes.data.messages || []
        zackMessages = await Promise.all(
          zackMsgs.map(m =>
            gmail_zack.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
          )
        )
      } catch (err) {
        console.error('Zack inbox read error:', err)
      }
    }

    return [...davidMessages, ...zackMessages].map(m => m.data)
  } catch (err: any) {
    console.error('Gmail read error:', err.message)
    return []
  }
}

export async function markAsRead(messageId: string, inbox: 'david' | 'zack' = 'david'): Promise<void> {
  try {
    const client = inbox === 'zack' ? gmail_zack : gmail_david
    await client.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  } catch (err) {
    console.error('Mark as read error:', err)
  }
}