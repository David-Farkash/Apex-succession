import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getFirms, getFirmHistory, apolloLookup, sendOutreachEmail,
  readInbox, logReply, saveLearning, getLearnings,
  updateFirmStatus, flagForDavid, notifyDavid, findContact,
  processBounces, isPaused, getActiveDirectives
} from '@/lib/agent-tools'

const client = new Anthropic()

const AGENT_SYSTEM_PROMPT = `You are an autonomous acquisition agent working on behalf of David Farkash and Zack at The Succession Group.

Your goal is to identify owners of established UK businesses who may be open to a conversation about selling or transitioning their business, and get them to a call with David or Zack.

The approach:
"I work with founders of established businesses who may be starting to think about stepping back, succession planning, or what the next chapter could look like for both them and the business. The aim is to help founders explore a sensible exit or transition strategy, while making sure the business finds the right long-term home and continues to be looked after properly."

SENDER ASSIGNMENT (50/50 split):
For every new firm you contact, randomly assign the sender as either "david" or "zack" (roughly 50/50 over the run). Pass this to send_outreach_email via the sender parameter.

For follow-ups, ALWAYS use the same sender who sent the original email (check the firm's last_sender or the most recent outreach_log entry's sent_by field).

Email style:
- Opens with a specific, personal line about the business or director, reference something real like how long they have been trading, their location, or something notable
- Each paragraph should be short, 1 to 2 sentences maximum
- Never write long blocks of text, break ideas into separate short paragraphs
- Warm, professional, never salesy
- 3 to 4 short paragraphs total
- Always end with a soft ask for a 15 to 30 minute call
- Never use em dashes anywhere in the email, use commas or rewrite the sentence instead
- DO NOT write a sign-off or your name at the end. The system automatically appends "Kind regards," and the correct signature block based on the sender.
- Include this unsubscribe line as the very last line of the body: "If you would prefer not to hear from me, just reply and I will remove you from my list."

CONTACT FINDING PRIORITY (NO EXCEPTIONS):
1. ALWAYS try apollo_lookup first
2. If Apollo returns a verified email: use it and send the outreach
3. If Apollo returns nothing: use find_contact to check the website and Google Places for a generic email
4. If find_contact returns ANY email (info@, hello@, enquiries@, contact@, admin@, office@): use that email
5. If steps 1-4 all return nothing: STOP. Call flag_for_david with type "phone" with full notes. Move on.

INFERRED EMAILS ARE STRICTLY FORBIDDEN. NEVER construct an email address from a director's name and a guessed domain. If you cannot find a real verified email, flag for phone outreach instead.

BOUNCE HANDLING:
1. After read_inbox, ALWAYS call process_bounces with the EXACT messages array
2. For each bounced firm:
   a. find_contact for a generic email
   b. If found: send a new outreach to that email (same sender as original)
   c. If not: apollo_lookup once more
   d. If still nothing: flag_for_david with type "phone"
3. Never re-send to a bounced address.

EMAIL RULES:
- Never mention you are an AI or automated system
- Never mention buying or acquisition in the subject line
- Never approach staff, only directors
- If you only have a generic email, address the message to the business owner by name to encourage forwarding
- Short paragraphs only, never more than 2 sentences
- Include the unsubscribe line at the end

OUTREACH LIMITS (deliverability):
- Week 1: max 5 new outreaches per day
- Week 2: max 10 per day
- Week 3+: max 20 per day
- Follow-ups roughly 7 days apart, max 3 follow-ups
- Never two emails to the same domain on the same day

WARM LEAD: Any genuine reply, escalate immediately via notify_david. The system will automatically Telegram you with inline buttons.

LINKEDIN: If LinkedIn looks appropriate, flag_for_david with the director full name, company, and a suggested message.

PHONE: If no email exists but a phone does, flag_for_david type "phone". DO NOT use Apollo phone credits, those are manually triggered by David from the dashboard.

You have access to the following tools. Think carefully before each action.`

const tools: Anthropic.Tool[] = [
  {
    name: 'get_firms',
    description: 'Get firms from the database filtered by score, sector, outreach status etc',
    input_schema: {
      type: 'object' as const,
      properties: {
        minScore: { type: 'number', description: 'Minimum Apex score' },
        maxScore: { type: 'number', description: 'Maximum Apex score' },
        sector: { type: 'string', description: 'Filter by sector name' },
        outreachStatus: { type: 'string', description: 'not_contacted, contacted, replied, interested, passed, bounced' },
        limit: { type: 'number', description: 'Max firms to return' },
        followUpDue: { type: 'boolean', description: 'If true, returns firms due a follow-up (7+ days since last contact, <3 follow-ups sent)' },
      },
    },
  },
  {
    name: 'get_firm_history',
    description: 'Get the full interaction history for a specific firm including all emails sent and replies received',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string', description: 'The firm UUID' },
      },
      required: ['firmId'],
    },
  },
  {
    name: 'apollo_lookup',
    description: 'Look up a director EMAIL via Apollo. Does not cost phone credits.',
    input_schema: {
      type: 'object' as const,
      properties: {
        directorName: { type: 'string' },
        companyName: { type: 'string' },
        website: { type: 'string', description: 'Company website if known' },
      },
      required: ['directorName', 'companyName'],
    },
  },
  {
    name: 'find_contact',
    description: 'Find real contact details for a firm using Google Places and website scraping. Use after Apollo fails, and after bounces.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        companyName: { type: 'string' },
        postcode: { type: 'string' },
        directorName: { type: 'string' },
        companyNumber: { type: 'string' },
      },
      required: ['firmId', 'companyName', 'companyNumber'],
    },
  },
  {
    name: 'process_bounces',
    description: 'Process bounce notifications from the inbox. ALWAYS call after read_inbox. Returns bounced firms to handle.',
    input_schema: {
      type: 'object' as const,
      properties: {
        messages: { type: 'array', description: 'The exact array of inbox messages returned by read_inbox' },
      },
      required: ['messages'],
    },
  },
  {
    name: 'send_outreach_email',
    description: 'Send an outreach email from a specified sender (david or zack) and log it. NEVER use with an inferred email.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        companyNumber: { type: 'string' },
        directorName: { type: 'string' },
        toEmail: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        emailSource: { type: 'string', description: 'director_direct, generic, or bounce_retry. NEVER inferred.' },
        reasoning: { type: 'string' },
        followUpNumber: { type: 'number', description: '0 for first contact, 1 for first follow-up, etc' },
        sender: { type: 'string', description: 'david or zack. For new firms, randomly assign. For follow-ups, use the same sender as the original.' },
      },
      required: ['firmId', 'companyNumber', 'directorName', 'toEmail', 'subject', 'body', 'emailSource', 'reasoning', 'followUpNumber', 'sender'],
    },
  },
  {
    name: 'read_inbox',
    description: 'Check the inbox for new replies. Always call process_bounces with the returned messages.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'log_reply',
    description: 'Log a reply and update firm status. Warm replies trigger an automatic Telegram alert.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        companyNumber: { type: 'string' },
        fromEmail: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        gmailMessageId: { type: 'string' },
        classification: { type: 'string', description: 'warm, cold, needs_response, unusual' },
        agentResponse: { type: 'string' },
        escalatedToDavid: { type: 'boolean' },
      },
      required: ['firmId', 'companyNumber', 'fromEmail', 'subject', 'body', 'gmailMessageId', 'classification', 'escalatedToDavid'],
    },
  },
  {
    name: 'save_learning',
    description: 'Save an insight that could help future outreach',
    input_schema: {
      type: 'object' as const,
      properties: {
        sector: { type: 'string' },
        observation: { type: 'string' },
        evidence: { type: 'object' },
        confidence: { type: 'number', description: '0-100' },
      },
      required: ['sector', 'observation', 'evidence', 'confidence'],
    },
  },
  {
    name: 'get_learnings',
    description: 'Retrieve learnings to inform your approach',
    input_schema: {
      type: 'object' as const,
      properties: {
        sector: { type: 'string', description: 'Filter by sector, or omit for all' },
      },
    },
  },
  {
    name: 'update_firm_status',
    description: 'Update a firm in the database',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        updates: { type: 'object' },
      },
      required: ['firmId', 'updates'],
    },
  },
  {
    name: 'flag_for_david',
    description: 'Flag a firm for David to handle manually by phone or LinkedIn',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        type: { type: 'string', description: 'phone or linkedin' },
        notes: { type: 'string', description: 'Full context: director, why flagged, phone if available' },
      },
      required: ['firmId', 'type', 'notes'],
    },
  },
  {
    name: 'notify_david',
    description: 'Send a Telegram message to David. Use for warm leads and unusual situations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
]

async function runTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case 'get_firms':
        return JSON.stringify(await getFirms(input))
      case 'get_firm_history':
        return JSON.stringify(await getFirmHistory(input.firmId))
      case 'apollo_lookup':
        return JSON.stringify(await apolloLookup(input.directorName, input.companyName, input.website))
      case 'find_contact':
        return JSON.stringify(await findContact(input.firmId, input.companyName, input.postcode || '', input.directorName || '', input.companyNumber))
      case 'process_bounces':
        return JSON.stringify(await processBounces(input.messages || []))
      case 'send_outreach_email':
        return JSON.stringify(await sendOutreachEmail(input))
      case 'read_inbox':
        return JSON.stringify(await readInbox())
      case 'log_reply':
        await logReply(input)
        return JSON.stringify({ success: true })
      case 'save_learning':
        await saveLearning(input.sector, input.observation, input.evidence, input.confidence)
        return JSON.stringify({ success: true })
      case 'get_learnings':
        return JSON.stringify(await getLearnings(input.sector))
      case 'update_firm_status':
        await updateFirmStatus(input.firmId, input.updates)
        return JSON.stringify({ success: true })
      case 'flag_for_david':
        await flagForDavid(input.firmId, input.type, input.notes)
        return JSON.stringify({ success: true })
      case 'notify_david':
        await notifyDavid(input.message)
        return JSON.stringify({ success: true })
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message })
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret')
  if (process.env.AGENT_SECRET && secret !== process.env.AGENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Check if agent is paused via Telegram
  if (await isPaused()) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: 'Agent is paused. Send /resume on Telegram to restart.',
    })
  }

  const now = new Date()

  // Safely extract UK time parts using Intl — never parse locale strings back into Date
  // (parsing toLocaleString back into Date causes MM/DD vs DD/MM confusion)
  const ukParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const ukWeekday = ukParts.find(p => p.type === 'weekday')?.value || ''
  const ukHour = parseInt(ukParts.find(p => p.type === 'hour')?.value || '0')

  const weekdayMap: Record<string, number> = {
    Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
    Friday: 5, Saturday: 6, Sunday: 0,
  }
  const ukDay = weekdayMap[ukWeekday] ?? 0
  const isWeekday = ukDay >= 1 && ukDay <= 5
  const isWorkingHours = ukHour >= 9 && ukHour < 19
  const forceRun = req.headers.get('x-force-run') === 'true'

  const ukTimeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  if (!forceRun && (!isWeekday || !isWorkingHours)) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: `Outside operating hours. UK time: ${ukTimeStr}. Agent runs Mon-Fri 9am-7pm.`,
    })
  }

  const startedAt = new Date().toISOString()
  const { data: runRecord } = await supabaseAdmin
    .from('agent_runs')
    .insert({ started_at: startedAt, status: 'running' })
    .select()
    .single()

  const runId = runRecord?.id
  const stats = { firmsReviewed: 0, emailsSent: 0, repliesProcessed: 0, escalations: 0 }

  try {
    const directives = await getActiveDirectives()
    const directivesBlock = directives.length > 0
      ? `\n\nIMPORTANT — Current guidance from David (most recent first). This overrides default behavior for this run:\n${directives.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n`
      : ''

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Today is ${new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now)}.${directivesBlock}

Run your full daily outreach loop in this exact order:

1. Call read_inbox to get all inbox messages
2. IMMEDIATELY call process_bounces with those exact messages
3. For each bounced firm: follow BOUNCE HANDLING
4. Check for genuine replies and handle them via log_reply (warm replies auto-Telegram David)
5. Check for follow-ups due today and send them (same sender as original)
6. Find new firms to approach today (respect daily volume limits)
7. For each new firm:
   - Randomly assign sender as "david" or "zack" (~50/50 over the run)
   - Use CONTACT FINDING PRIORITY
   - Write a short personalised email
   - DO NOT include a sign-off or your name. The system appends "Kind regards," and the correct signature automatically.
   - Send via send_outreach_email with the sender parameter
   - If no real email found: flag_for_david for phone

Be autonomous. Think before each action. Respect any guidance above.`,
      },
    ]

    let continueLoop = true
    let iterations = 0
    const maxIterations = 60

    while (continueLoop && iterations < maxIterations) {
      iterations++

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        continueLoop = false
        break
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`Agent calling: ${block.name}`, block.input)
            const result = await runTool(block.name, block.input)
            console.log(`Tool result: ${result.slice(0, 200)}`)

            if (block.name === 'send_outreach_email') stats.emailsSent++
            if (block.name === 'log_reply') stats.repliesProcessed++
            if (block.name === 'notify_david') stats.escalations++
            if (block.name === 'get_firms') {
              try {
                const firms = JSON.parse(result)
                if (Array.isArray(firms)) stats.firmsReviewed += firms.length
              } catch {}
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            })
          }
        }

        messages.push({ role: 'user', content: toolResults })
      }
    }

    const finalText = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => Array.isArray(m.content) ? m.content : [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')

    await supabaseAdmin.from('agent_runs').update({
      completed_at: new Date().toISOString(),
      firms_reviewed: stats.firmsReviewed,
      emails_sent: stats.emailsSent,
      replies_processed: stats.repliesProcessed,
      escalations: stats.escalations,
      summary: finalText.slice(0, 2000),
    }).eq('id', runId)

    return NextResponse.json({ success: true, stats, summary: finalText.slice(0, 500) })
  } catch (err: any) {
    console.error('Agent run error:', err)
    await supabaseAdmin.from('agent_runs').update({
      completed_at: new Date().toISOString(),
      errors: { message: err.message },
    }).eq('id', runId)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ runs: data })
}