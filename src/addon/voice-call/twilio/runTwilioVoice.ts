import express from 'express'
import { WebSocketServer } from 'ws'
import { container, Container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { Logger } from '@/core/logger'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { IMindset, Mindset, MindsetOperator } from '@/feature/mindset'
import {
  IVoiceCallConnection,
  OutboundCallIntents,
  RealtimeVoiceEngine,
  RealtimeVoiceSession,
  VoiceBotRegistry,
} from '@/feature/voice-call'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'
import { TwilioVoiceMediaStream } from './TwilioVoiceMediaStream'
import { connectStreamTwiml } from './twiml'
import { twilioVoiceChannelName } from './twilioVoiceChannelName'

const logger = new Logger('wabot:twilio-voice')

export interface IRunTwilioVoiceOptions {
  /** Default Mindset (the voice bot's brain) for inbound calls. */
  mindset: IConstructor<IMindset>
  config: TwilioVoiceConfig
  /** Opening-line instruction spoken when a call connects. */
  greeting?: string
}

interface IResolvedBrain {
  instructions: string
  tools: ReturnType<MindsetOperator['tools']>
  callFunction: (name: string, args: string) => Promise<string>
}

async function resolveBrain(mindsetCtor: IConstructor<IMindset>): Promise<IResolvedBrain> {
  const child = container.createChildContainer()
  child.register(Container, { useValue: child })
  child.register(Mindset, { useClass: mindsetCtor })
  const operator = child.resolve(MindsetOperator)
  return {
    instructions: await operator.systemPrompt(),
    tools: operator.tools(),
    callFunction: (name, args) => operator.callFunction(name, args),
  }
}

/**
 * Serves inbound Twilio voice calls and enables outbound ones. Registers a
 * webhook that returns `<Connect><Stream>` TwiML and a WebSocket media endpoint
 * that bridges each call to the realtime engine via {@link RealtimeVoiceSession},
 * routing to the right {@link VoiceBotRegistry} bot. Reuses the framework's HTTP
 * server. Call `runRealtimeVoiceEngines([...])` first so the engine resolves.
 */
export function runTwilioVoice(options: IRunTwilioVoiceOptions) {
  const { config } = options
  container.register(TwilioVoiceConfig, { useValue: config })

  const bots = container.resolve(VoiceBotRegistry)
  const intents = container.resolve(OutboundCallIntents)
  bots.register(
    {
      name: options.mindset.name,
      mindset: options.mindset,
      greeting: options.greeting,
      voice: config.voice,
    },
    { default: true },
  )

  const app = container.resolve(ExpressProvider).getExpress()
  const httpServer = container.resolve(HttpServerProvider).getHttpServer()
  const engine = container.resolve(RealtimeVoiceEngine)
  const streamUrl = config.mediaStreamUrl()

  // 1. Voice webhook → TwiML that opens the media stream. Call metadata and the
  //    outbound intent token (if any) are forwarded as <Parameter>.
  app.post(config.webhookPath, express.urlencoded({ extended: false }), (req, res) => {
    const body = (req.body ?? {}) as Record<string, string>
    const query = req.query as Record<string, string | undefined>
    const parameters: Record<string, string> = {}
    if (body.From) parameters.from = body.From
    if (body.To) parameters.to = body.To
    if (body.CallSid) parameters.callSid = body.CallSid
    if (query.intent) parameters.intent = query.intent
    if (query.bot) parameters.bot = query.bot
    res.type('text/xml').send(connectStreamTwiml({ streamUrl, parameters }))
  })

  // 2. Bidirectional media stream (raw WebSocket) on the shared HTTP server.
  const wss = new WebSocketServer({ noServer: true })
  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '', 'http://localhost').pathname
    if (pathname !== config.mediaPath) return // let other handlers (e.g. socket.io) deal with it
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws) => {
    const media = new TwilioVoiceMediaStream({
      send: (data) => ws.send(data),
      close: () => ws.close(),
    })
    ws.on('message', (data) => media.handleMessage(data.toString()))
    ws.on('close', () => media.handleClose())
    ws.on('error', (err) => logger.warn('media socket error', { message: err.message }))

    media.onStart(async (start) => {
      try {
        const intent = start.customParameters.intent
          ? intents.take(start.customParameters.intent)
          : undefined
        const bot = bots.get(intent?.bot ?? start.customParameters.bot)
        if (!bot) {
          logger.warn('no voice bot resolved for call; hanging up', {
            bot: intent?.bot ?? start.customParameters.bot,
          })
          media.hangup()
          return
        }

        const brain = await resolveBrain(bot.mindset)
        const connection: IVoiceCallConnection = {
          callId: start.callSid ?? start.streamSid,
          from: start.customParameters.from ?? '',
          to: start.customParameters.to ?? '',
          direction: intent ? 'outbound' : 'inbound',
          channelName: twilioVoiceChannelName,
        }
        await RealtimeVoiceSession.start({
          media,
          engine,
          connection,
          instructions: brain.instructions,
          tools: brain.tools,
          callFunction: brain.callFunction,
          voice: intent?.voice ?? bot.voice ?? config.voice,
          greeting: intent?.greeting ?? bot.greeting,
        })
        logger.info('voice call connected', {
          callId: connection.callId,
          direction: connection.direction,
        })
      } catch (err) {
        logger.error(
          'failed to start voice session',
          err instanceof Error ? { message: err.message } : { err },
        )
        media.hangup()
      }
    })
  })

  container.resolve(ExpressProvider).listen()
  logger.info('twilio voice ready', { webhook: config.webhookPath, media: config.mediaPath })
}
