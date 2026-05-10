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
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e6df; font-family: Georgia, serif; color: #0a1f15;">
      <img src="${LOGO_URL}" alt="The Succession Group" width="160" style="display: block; margin-bottom: 12px;" />
      <div style="font-size: 14px; color: #0a1f15; margin-bottom: 2px;">David Farkash</div>
      <div style="font-size: 12px; color: #6b6b67; margin-bottom: 8px; font-style: italic;">The Succession Group</div>
      <div style="font-size: 12px; color: #6b6b67;">
        <a href="mailto:david@thesuccessiongroup.co.uk" style="color: #2d4a3a; text-decoration: none;">david@thesuccessiongroup.co.uk</a><br/>
        <a href="https://thesuccessiongroup.co.uk" style="color: #2d4a3a; text-decoration: none;">thesuccessiongroup.co.uk</a>
      </div>
    </div>
  `
}

function plainToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(p => `<p style="margin: 0 0 16px; line-height: 1.6; color: #0a1f15; font-family: Georgia, serif; font-size: 15px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function makeEmailBody(to: string, subject: string, body: string, fromName: string): string {
  const from = `${fromName} <${process.env.GMAIL_USER}>`

  // Strip any existing signature from the body since we add our own
  const cleanBody = body
    .replace(/Best regards,[\s\S]*$/i, '')
    .replace(/Best,[\s\S]*$/i, '')
    .replace(/Kind regards,[\s\S]*$/i, '')
    .replace(/David Farkash[\s\S]*$/i, '')
    .trim()

  const htmlBody = plainToHtml(cleanBody) + buildSignatureHtml()

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