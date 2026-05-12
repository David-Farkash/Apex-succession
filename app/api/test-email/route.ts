import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/gmail'

const SAMPLE_BODY = `Dear Martin,

I came across P. Boast & Son and noticed you've been running this established funeral home in Alton for over 25 years now.

I work with founders of established businesses like yours who may be starting to think about what the next chapter could look like, whether that's stepping back, succession planning, or exploring options for the business to find the right long-term home.

If you're at a stage where a conversation about the future might be useful, I'd be happy to have a brief chat. No pressure, just an informal discussion about what might make sense for you and the business.

Would you be open to a 15 to 20 minute call sometime in the next week or two?`

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') || 'david@thesuccessiongroup.co.uk'
  const sender = req.nextUrl.searchParams.get('sender') || 'david'

  const isZack = sender === 'zack'
  const fromName = isZack ? 'Zack' : 'David Farkash'
  const fromEmail = isZack
    ? (process.env.GMAIL_USER_ZACK || process.env.GMAIL_USER!)
    : process.env.GMAIL_USER!

  const result = await sendEmail({
    to,
    subject: `Email formatting test (${sender})`,
    body: SAMPLE_BODY,
    fromName,
    fromEmail,
  })

  return NextResponse.json({ ...result, sender, fromName, fromEmail })
}