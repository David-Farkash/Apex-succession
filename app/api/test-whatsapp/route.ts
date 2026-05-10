import { NextResponse } from 'next/server'
import { notifyDavid } from '@/lib/agent-tools'

export async function GET() {
  await notifyDavid('🟢 Apex agent WhatsApp test — if you received this, Twilio is connected and working.')
  return NextResponse.json({ success: true })
}