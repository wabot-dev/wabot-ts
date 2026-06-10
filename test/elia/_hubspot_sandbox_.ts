// Real-sandbox verification script for the HubSpot channel. Polls the
// Conversations API with the same access token the bot uses, then asserts
// the last OUTGOING/INCOMING messages in the thread match the expectations
// of the EliaChatController's @hubspot() handler. See test/elia/README.md.
//
// Usage:
//   HUBSPOT_ACCESS_TOKEN=pat-na1-... \
//   HUBSPOT_THREAD_ID=thread-abc \
//   node --import @yucacodes/ts --import ./env.mjs ./test/elia/_hubspot_sandbox_.ts \
//     [--thread=...] [--require-inbound-files=N] [--require-outbound-files=N] \
//     [--require-markdown] [--poll-seconds=30] [--limit=10] [--json]

import { Client } from '@hubspot/api-client'

interface CliArgs {
  threadId: string
  requireInboundFiles: number
  requireOutboundFiles: number
  requireMarkdown: boolean
  pollSeconds: number
  limit: number
  json: boolean
}

interface HubSpotMessage {
  id: string
  direction: 'INCOMING' | 'OUTGOING'
  text?: string
  richText?: string
  createdAt?: string
  attachments?: Array<{ id?: string; name?: string; mimeType?: string }>
}

interface IOutcome {
  name: string
  ok: boolean
  detail: string
}

function parseArgs(argv: string[]): CliArgs {
  const flag = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : undefined
  }
  const threadId = flag('thread') ?? process.env.HUBSPOT_THREAD_ID ?? ''
  if (!threadId) {
    throw new Error(
      'Missing --thread=<id> or HUBSPOT_THREAD_ID env var.\n' +
        'Find a threadId by sending a message in the HubSpot Inbox and looking at the URL.',
    )
  }
  return {
    threadId,
    requireInboundFiles: Number(flag('require-inbound-files') ?? '0'),
    requireOutboundFiles: Number(flag('require-outbound-files') ?? '0'),
    requireMarkdown: flag('require-markdown') != null,
    pollSeconds: Number(flag('poll-seconds') ?? '30'),
    limit: Number(flag('limit') ?? '10'),
    json: flag('json') != null,
  }
}

async function listMessages(
  client: Client,
  threadId: string,
  limit: number,
): Promise<HubSpotMessage[]> {
  const path =
    `/conversations/v3/conversations/threads/${encodeURIComponent(threadId)}/messages` +
    `?limit=${limit}`
  const res = await client.apiRequest({ method: 'GET', path })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET ${path} → ${res.status} ${body}`)
  }
  const data = (await res.json()) as { results?: HubSpotMessage[] }
  return data.results ?? []
}

async function waitForReply(
  client: Client,
  threadId: string,
  timeoutSeconds: number,
  limit: number,
): Promise<HubSpotMessage[]> {
  const deadline = Date.now() + timeoutSeconds * 1000
  let last: HubSpotMessage[] = []
  while (Date.now() < deadline) {
    last = await listMessages(client, threadId, limit)
    const lastOutgoing = last.find((m) => m.direction === 'OUTGOING')
    if (lastOutgoing && lastOutgoing.text) return last
    await new Promise((r) => setTimeout(r, 2000))
  }
  return last
}

function lastOfDirection(messages: HubSpotMessage[], dir: HubSpotMessage['direction']) {
  return [...messages].reverse().find((m) => m.direction === dir)
}

function check(
  args: CliArgs,
  messages: HubSpotMessage[],
): IOutcome[] {
  const out: IOutcome[] = []
  const lastIn = lastOfDirection(messages, 'INCOMING')
  const lastOut = lastOfDirection(messages, 'OUTGOING')

  if (lastOut && lastOut.text) {
    const ok = lastOut.text.startsWith('**Hola')
    out.push({
      name: 'roundtrip: last OUTGOING starts with **Hola',
      ok,
      detail: `text=${JSON.stringify(lastOut.text).slice(0, 80)}`,
    })
  } else {
    out.push({
      name: 'roundtrip: last OUTGOING starts with **Hola',
      ok: false,
      detail: 'no OUTGOING message with text yet',
    })
  }

  if (args.requireMarkdown && lastOut) {
    const rich = lastOut.richText ?? ''
    const ok = rich.includes('<b>') && rich.includes('</b>')
    out.push({
      name: 'markdown: last OUTGOING richText contains <b>...</b>',
      ok,
      detail: `richText=${JSON.stringify(rich).slice(0, 80)}`,
    })
  }

  if (args.requireInboundFiles > 0) {
    const count = lastIn?.attachments?.length ?? 0
    out.push({
      name: `inbound attachments: last INCOMING has >= ${args.requireInboundFiles}`,
      ok: count >= args.requireInboundFiles,
      detail: `attachments=${count}`,
    })
  }

  if (args.requireOutboundFiles > 0) {
    const count = lastOut?.attachments?.length ?? 0
    out.push({
      name: `outbound attachments: last OUTGOING has >= ${args.requireOutboundFiles}`,
      ok: count >= args.requireOutboundFiles,
      detail: `attachments=${count}`,
    })
  }

  return out
}

function printMessages(messages: HubSpotMessage[]): void {
  console.log(`\nLast ${messages.length} messages in thread:`)
  for (const m of messages) {
    const ts = m.createdAt ? m.createdAt.slice(11, 19) : '--:--:--'
    const attach = m.attachments?.length ? ` [${m.attachments.length} att]` : ''
    const text = (m.text ?? '').replace(/\n/g, ' ').slice(0, 70)
    const rich = m.richText ? ` rich=${m.richText.replace(/<[^>]+>/g, '').slice(0, 40)}` : ''
    console.log(`  ${ts}  ${m.direction.padEnd(8)}  ${text}${attach}${rich}`)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    throw new Error('HUBSPOT_ACCESS_TOKEN is required in env (or .env).')
  }

  const client = new Client({ accessToken: token })
  console.log(`Polling thread ${args.threadId} for up to ${args.pollSeconds}s...`)
  const messages = await waitForReply(client, args.threadId, args.pollSeconds, args.limit)

  if (messages.length === 0) {
    console.error('No messages returned. Check the threadId and token scopes.')
    process.exit(1)
  }

  if (args.json) {
    console.log(JSON.stringify(messages, null, 2))
  } else {
    printMessages(messages)
  }

  const outcomes = check(args, messages)
  console.log('\nAssertions:')
  let failed = 0
  for (const o of outcomes) {
    const mark = o.ok ? '✓' : '✗'
    console.log(`  ${mark} ${o.name}`)
    console.log(`     ${o.detail}`)
    if (!o.ok) failed++
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed.`)
    process.exit(1)
  }
  console.log(`\nAll ${outcomes.length} assertion(s) passed.`)
}

main().catch((err) => {
  console.error('verification failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
