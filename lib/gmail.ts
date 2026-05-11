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
      <img src="${LOGO_URL}" alt="The Succession Group" width="160" style="display: block; margin-bottom: 12px;" />
      <div style="font-size: 14px; color: #0a1f15; margin-bottom: 2px; font-family: Arial, Helvetica, sans-serif;"><strong>David Farkash</strong></div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 8px; font-family: Arial, Helvetica, sans-serif;">The Succession Group</div>
      <div style="font-size: 12px; color: #6b6b67; font-family: Arial, Helvetica, sans-serif;">
        <a href="tel:07528821427" style="color: #2d4a3a; text-decoration: none;">07528 821427</a><br/>
        <a href="https://thesuccessiongroup.co.uk" style="color: #2d4a3a; text-decoration: none;">thesuccessiongroup.co.uk</a>
      </div>
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
    .map(p => `<p style="margin: 0 0 16px; line-height: 1.6; color: #0a1f15; font-family: Arial, Helvetica, sans-serif; font-size: 15px;">${p}</p>`)
    .join('')
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
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; color: #0a1f15;">
      ${plainToHtml(bodyWithSignoff)}
      ${buildSignatureHtml()}
    </div>
  `

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ]
  const message = messageParts.join('\n')
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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