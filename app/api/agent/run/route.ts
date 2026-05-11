import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getFirms, getFirmHistory, apolloLookup, sendOutreachEmail,
  readInbox, logReply, saveLearning, getLearnings,
  updateFirmStatus, flagForDavid, notifyDavid, findContact,
  processBounces
} from '@/lib/agent-tools'

const client = new Anthropic()

const AGENT_SYSTEM_PROMPT = `You are an autonomous acquisition agent working on behalf of David Farkash and The Succession Group.

Your goal is to identify owners of established UK businesses who may be open to a conversation about selling or transitioning their business, and get them to a call with David.

David's approach:
"I work with founders of established businesses who may be starting to think about stepping back, succession planning, or what the next chapter could look like for both them and the business. The aim is to help founders explore a sensible exit or transition strategy, while making sure the business finds the right long-term home and continues to be looked after properly."

David's email style:
- Opens with a specific, personal line about the business or director — reference something real like how long they have been trading, their location, or something notable
- Each paragraph should be short — 2 to 3 sentences maximum
- Never write long blocks of text — break ideas into separate short paragraphs
- Warm, professional, never salesy
- 3 to 4 short paragraphs total
- Always end with a soft ask for a 15 to 30 minute call
- Never use em dashes anywhere in the email — use commas or rewrite the sentence instead
- Always sign off with "Kind regards," on one line, then a blank line, then "David Farkash" on the next line
- Include this unsubscribe line as the very last line: "If you would prefer not to hear from me, just reply and I will remove you from my list."

CONTACT FINDING PRIORITY (follow this order strictly):
1. For firms scoring 65+: ALWAYS try apollo_lookup first before anything else
2. If Apollo returns a verified email: use it
3. If Apollo returns nothing: use find_contact to get the website and generic email
4. If find_contact returns a generic email (info@, hello@, enquiries@): use it — do not infer
5. Only use inferred emails as absolute last resort when nothing else exists
6. If no email of any kind exists: flag_for_david with type "phone" — do not send to an inferred address

BOUNCE HANDLING (follow this process strictly):
1. After calling read_inbox, ALWAYS call process_bounces with the returned messages
2. For each bounced firm in the results:
   a. Call find_contact to search for a generic email from their website or Google Places
   b. If find_contact returns any email: send a new outreach immediately to that email
   c. If find_contact finds nothing: call apollo_lookup one more time for the firm
   d. If apollo finds an email: send outreach to that email
   e. If still nothing: call flag_for_david with type "phone" — include director name, company name, phone number if known, and note that the original email bounced
3. Never send another inferred email to a firm that has already bounced
4. Always log bounce handling actions

EMAIL RULES:
- Never mention you are an AI or automated system
- Never mention buying or acquisition in the subject line
- Never approach staff — only directors
- If you only have a generic email (info@, hello@), craft a message addressed to the business owner by name that makes them want to pass it on — do not reveal the acquisition purpose
- Never use em dashes anywhere
- Always sign off: "Kind regards," then blank line then "David Farkash"
- Short paragraphs only — never more than 3 sentences in a paragraph
- Include unsubscribe line at the end

OUTREACH LIMITS (critical for deliverability):
- Maximum 5 new outreaches per day in week 1
- Maximum 10 per day in week 2
- Maximum 20 per day from week 3 onwards
- Follow ups should be roughly 7 days apart
- Maximum 3 follow ups before moving on
- Never send two emails to the same domain on the same day

WARM LEAD: Any reply at all — escalate to David immediately via WhatsApp.

LINKEDIN: If LinkedIn outreach seems appropriate, flag it for David with the director full name, company, and a suggested message. Do not attempt to send LinkedIn messages yourself.

PHONE: If no email exists but a phone number does, flag it for David to call manually.

You have access to the following tools. Use them thoughtfully and autonomously. Think carefully before each action.`

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
        followUpDue: { type: 'boolean', description: 'If true, returns firms that are due a follow up (contacted 7+ days ago, less than 3 follow ups)' },
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
    description: 'Look up a director email address using Apollo. Only use for firms scoring 65+. Returns email and confidence level.',
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
    description: 'Find contact details for a firm using Google Places and website scraping. Also use this after a bounce to find a generic email.',
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
    description: 'Process bounce notification emails from the inbox. ALWAYS call this after read_inbox. Returns list of bounced firms to follow up on.',
    input_schema: {
      type: 'object' as const,
      properties: {
        messages: {
          type: 'array',
          description: 'The array of inbox messages returned by read_inbox',
        },
      },
      required: ['messages'],
    },
  },
  {
    name: 'send_outreach_email',
    description: 'Send an outreach email to a firm and log it. Always log your reasoning for why you chose this approach.',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        companyNumber: { type: 'string' },
        directorName: { type: 'string' },
        toEmail: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        emailSource: { type: 'string', description: 'director_direct, generic, inferred, bounce_retry' },
        reasoning: { type: 'string', description: 'Why you chose this approach, angle, and email for this firm' },
        followUpNumber: { type: 'number', description: '0 for first contact, 1 for first follow up, etc' },
      },
      required: ['firmId', 'companyNumber', 'directorName', 'toEmail', 'subject', 'body', 'emailSource', 'reasoning', 'followUpNumber'],
    },
  },
  {
    name: 'read_inbox',
    description: 'Check the inbox for any new replies to outreach emails',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'log_reply',
    description: 'Log a reply received from a firm and update their status',
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
        agentResponse: { type: 'string', description: 'The response you sent if any' },
        escalatedToDavid: { type: 'boolean' },
      },
      required: ['firmId', 'companyNumber', 'fromEmail', 'subject', 'body', 'gmailMessageId', 'classification', 'escalatedToDavid'],
    },
  },
  {
    name: 'save_learning',
    description: 'Save a pattern or insight you have noticed that could help future outreach',
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
    description: 'Retrieve learnings and patterns from previous outreach to inform your approach',
    input_schema: {
      type: 'object' as const,
      properties: {
        sector: { type: 'string', description: 'Filter by sector, or omit for all' },
      },
    },
  },
  {
    name: 'update_firm_status',
    description: 'Update a firm status or flags in the database',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        updates: { type: 'object', description: 'Key value pairs to update on the firm record' },
      },
      required: ['firmId', 'updates'],
    },
  },
  {
    name: 'flag_for_david',
    description: 'Flag a firm for David to handle manually — either by phone or LinkedIn',
    input_schema: {
      type: 'object' as const,
      properties: {
        firmId: { type: 'string' },
        type: { type: 'string', description: 'phone or linkedin' },
        notes: { type: 'string', description: 'Full context for David — director name, why you are flagging, suggested approach, phone number if available' },
      },
      required: ['firmId', 'type', 'notes'],
    },
  },
  {
    name: 'notify_david',
    description: 'Send David a WhatsApp message. Use for warm leads and daily digest.',
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

  const now = new Date()
  const ukTime = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }))
  const day = ukTime.getDay()
  const hour = ukTime.getHours()
  const isWeekday = day >= 1 && day <= 5
  const isWorkingHours = hour >= 9 && hour < 19

  if (!isWeekday || !isWorkingHours) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: `Outside operating hours. UK time: ${ukTime.toLocaleString('en-GB')}. Agent runs Mon-Fri 9am-7pm.`,
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
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Run your full daily outreach loop in this exact order:

1. Call read_inbox to get all inbox messages
2. IMMEDIATELY call process_bounces with those exact messages — do not skip this step
3. For each bounced firm returned by process_bounces, follow the BOUNCE HANDLING process in full
4. Check for genuine replies from directors and handle them
5. Check for follow-ups due today and send them
6. Find new firms to approach today — respect daily volume limits
7. For each new firm: use CONTACT FINDING PRIORITY, write a short personalised email with short paragraphs, send it
8. At the end send David a WhatsApp summary covering: emails sent, bounces detected and what you did about them, any replies, firms flagged for phone

Be autonomous. Think before each action. Keep emails short and human.`,
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
              const firms = JSON.parse(result)
              stats.firmsReviewed += firms.length
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