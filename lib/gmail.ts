import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
)

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
})

const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

const LOGO_URL = process.env.LOGO_URL || 'https://thesuccessiongroup.co.uk/tsg-logo.png'

function buildSignatureHtml(): string {
  return `
    <div style="margin-top: 24px; font-family: Arial, Helvetica, sans-serif; color: #0a1f15;">
      <div style="font-size: 14px; color: #0a1f15; margin-bottom: 2px;"><strong>David Farkash</strong></div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 8px;">The Succession Group</div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 16px;">
        <a href="tel:07528821427" style="color: #2d4a3a; text-decoration: none;">07528 821427</a><br/>
        <a href="https://thesuccessiongroup.co.uk" style="color: #2d4a3a; text-decoration: none;">thesuccessiongroup.co.uk</a>
      </div>
      <img src="${LOGO_URL}" alt="The Succession Group" width="140" style="display: block; opacity: 0.85;" />
    </div>
  `
}

// Convert plain text to HTML paragraphs.
// Single newlines inside a paragraph become spaces (so soft wraps don't break sentences).
// Double newlines separate paragraphs.
function plainToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter(p => p.length > 0)
    .map(p => `<p style="margin: 0 0 14px; line-height: 1.5; color: #0a1f15; font-family: Arial, Helvetica, sans-serif; font-size: 14px;">${p}</p>`)
    .join('')
}

// RFC 2047 encode for non-ASCII characters in headers (like em dashes in subject lines)
function encodeHeader(value: string): string {
  // If it's pure ASCII, no encoding needed
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  const b64 = Buffer.from(value, 'utf-8').toString('base64')
  return `=?UTF-8?B?${b64}?=`
}

function makeEmailBody(to: string, subject: string, body: string, fromName: string): string {
  const from = `${fromName} <${process.env.GMAIL_USER}>`

  // Strip any sign-off the agent wrote (we add our own consistently)
  // and strip any "David Farkash" the agent wrote at the end (signature has it)
  const cleanBody = body
    .replace(/\n*(kind regards|best regards|warm regards|best wishes|many thanks|regards|best|sincerely|yours sincerely)[,\s]*\n+[\s\S]*$/i, '')
    .replace(/\n*david farkash[\s\S]*$/i, '')
    .trim()

  // Always append a consistent sign-off so emails never end abruptly
  const bodyWithSignoff = `${cleanBody}\n\nKind regards,`

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0a1f15;">
      ${plainToHtml(bodyWithSignoff)}
      ${buildSignatureHtml()}
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
}: {
  to: string
  subject: string
  body: string
  fromName?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const encoded = makeEmailBody(to, subject, body, fromName)
    const res = await gmail.users.messages.send({
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
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread to:me',
      maxResults: 50,
    })
    const messages = res.data.messages || []
    const full = await Promise.all(
      messages.map(m =>
        gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' })
      )
    )
    return full.map(m => m.data)
  } catch (err: any) {
    console.error('Gmail read error:', err.message)
    return []
  }
}

export async function markAsRead(messageId: string): Promise<void> {
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  } catch (err) {
    console.error('Mark as read error:', err)
  }
}