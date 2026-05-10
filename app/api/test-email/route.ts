import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/gmail'

export async function GET() {
  const result = await sendEmail({
    to: 'david@hubbcreative.com',
    subject: 'Apex Gmail test',
    body: 'If you received this, the Gmail API is connected and working.',
    fromName: 'David Farkash',
  })
  return NextResponse.json(result)
}