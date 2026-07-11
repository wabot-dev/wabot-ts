import test from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import WebSocket from 'ws'
import { container } from '@/core/injection'
import { HttpServerProvider } from '@/feature/http'
import {
  type IMindset,
  type IMindsetDescription,
  type IMindsetModels,
  mindset,
} from '@/feature/mindset'
import { runRealtimeVoiceEngines } from '@/feature/voice-call'
import { OpenaiRealtimeVoiceEngine } from '../openai/OpenaiRealtimeVoiceEngine'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'
import { runTwilioVoice } from './runTwilioVoice'

// A tiny mindset so we don't depend on the example app.
@mindset({})
class VoiceTestBot implements IMindset {
  async describe(): Promise<IMindsetDescription> {
    return {
      identity: { name: 'Tester', language: 'english' },
      context: 'You are a test bot on a phone call.',
      skills: '',
      limits: 'Reply with a single short word.',
      workflow: '',
    }
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'openai', model: 'gpt-4.1' }] }
  }
}

function waitListening(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (server.listening) resolve()
    else server.once('listening', () => resolve())
  })
}

const skipInbound = process.env.OPENAI_API_KEY ? false : 'OPENAI_API_KEY not set'

test.describe('Twilio voice bridge (real server + real OpenAI)', { skip: skipInbound }, () => {
  test(
    'webhook returns Stream TwiML and the media bridge streams the bot audio',
    { timeout: 45_000 },
    async () => {
      // Own port so we don't collide with a running dev server.
      process.env.PORT = process.env.VOICE_TEST_PORT ?? '4599'
      const port = process.env.PORT

      runRealtimeVoiceEngines([OpenaiRealtimeVoiceEngine])
      runTwilioVoice({
        mindset: VoiceTestBot,
        config: new TwilioVoiceConfig(`http://localhost:${port}`, 'ACtest', 'tok', '+15005550006'),
        greeting: 'Greet the caller with a single short word in English.',
      })

      const server = container.resolve(HttpServerProvider).getHttpServer()
      await waitListening(server)

      // 1. Voice webhook → <Connect><Stream> TwiML.
      const res = await fetch(`http://localhost:${port}/voice/twilio/incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: '+573001112233',
          To: '+576011234567',
          CallSid: 'CAtest',
        }),
      })
      const twiml = await res.text()
      assert.match(twiml, /<Connect><Stream url="ws:\/\/localhost:\d+\/voice\/twilio\/media">/)

      // 2. Media stream: act as Twilio, expect the bot's greeting audio back.
      const ws = new WebSocket(`ws://localhost:${port}/voice/twilio/media`)
      const mediaFrames: string[] = []
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('no bot audio within 30s')), 30_000)
          ws.on('open', () => {
            ws.send(
              JSON.stringify({
                event: 'start',
                start: {
                  streamSid: 'MZtest',
                  callSid: 'CAtest',
                  customParameters: { from: '+573001112233', to: '+576011234567' },
                },
              }),
            )
          })
          ws.on('message', (data) => {
            const msg = JSON.parse(data.toString())
            if (msg.event === 'media' && typeof msg.media?.payload === 'string') {
              mediaFrames.push(msg.media.payload)
              clearTimeout(timer)
              resolve()
            }
          })
          ws.on('error', (err) => {
            clearTimeout(timer)
            reject(err)
          })
        })

        assert.ok(mediaFrames.length > 0, 'received g711_ulaw audio frames from the bot')
      } finally {
        try {
          ws.send(JSON.stringify({ event: 'stop' }))
        } catch {
          /* ignore */
        }
        ws.close()
        await new Promise<void>((r) => server.close(() => r()))
      }
    },
  )
})

// Places a REAL outbound call that SPEAKS a ~10s Latin-American Spanish message
// via Twilio's text-to-speech. Opt in with TWILIO_* + VOICE_TEST_CALL_TO=<your
// phone>. It rings the number and costs a little.
const skipOutbound =
  process.env.TWILIO_ACCOUNT_SID && process.env.VOICE_TEST_CALL_TO
    ? false
    : 'set TWILIO_* and VOICE_TEST_CALL_TO to place a real outbound call'

const SPANISH_MESSAGE =
  'Hola, muy buenas. Le saluda Elia, del Estudio Elia. Le llamamos para recordarle ' +
  'amablemente que tiene una cita agendada para mañana. Por favor, confírmenos su ' +
  'asistencia. ¡Muchas gracias y que tenga un excelente día!'

/** Dials `to` and plays `message` with a LatAm Spanish Polly voice (~10s). */
async function dialSpokenMessage(config: TwilioVoiceConfig, to: string, message: string) {
  // Polly LatAm Spanish (neural). Drop "-Neural" if the account lacks neural voices.
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say voice="Polly.Mia-Neural" language="es-MX">${message}</Say></Response>`
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: config.fromNumber, Twiml: twiml }),
    },
  )
  if (!res.ok) throw new Error(`Twilio call failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { sid: string }).sid
}

test.describe('Twilio outbound dial (real Twilio REST)', { skip: skipOutbound }, () => {
  test('places a real call that speaks a ~10s Spanish message', { timeout: 30_000 }, async () => {
    const to = process.env.VOICE_TEST_CALL_TO as string
    const config = new TwilioVoiceConfig(process.env.PUBLIC_BASE_URL ?? 'https://example.com')
    const sid = await dialSpokenMessage(config, to, SPANISH_MESSAGE)
    assert.match(sid, /^CA[0-9a-f]{32}$/)
  })
})
