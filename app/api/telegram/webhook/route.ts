import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, handleCommand, handleCallback, handleReplyToAlert } from '@/lib/telegram-webhook'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Callback (inline button taps)
    if (update.callback_query) {
      const cq = update.callback_query
      if (!isAuthorized(cq.from?.id)) {
        return NextResponse.json({ ok: true })
      }
      await handleCallback(cq.data, cq.id)
      return NextResponse.json({ ok: true })
    }

    // Regular messages
    if (update.message) {
      const msg = update.message
      if (!isAuthorized(msg.chat?.id)) {
        return NextResponse.json({ ok: true })
      }

      const text = msg.text || ''
      const replyTo = msg.reply_to_message?.message_id

      // If it's a reply to an alert, handle that
      if (replyTo) {
        await handleReplyToAlert(replyTo, text)
        return NextResponse.json({ ok: true })
      }

      // Otherwise treat as a command
      if (text.startsWith('/')) {
        await handleCommand(text)
        return NextResponse.json({ ok: true })
      }

      // Plain text without command → ignore
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 so Telegram doesn't retry
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook ready' })
}