import express from 'express'
import { WebSocketServer } from 'ws'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import {
  IIncomingVoiceCall,
  IVoiceCallConnection,
  IVoiceChannel,
  OutboundCallIntents,
} from '@/feature/voice-call'
import { TwilioAccountRegistry } from './TwilioAccountRegistry'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'
import { TwilioVoiceMediaStream } from './TwilioVoiceMediaStream'
import { isValidTwilioSignature } from './twilioSignature'
import { connectStreamTwiml } from './twiml'
import { twilioVoiceChannelName } from './twilioVoiceChannelName'

/**
 * Twilio Programmable Voice as an IVoiceChannel: a webhook returns
 * `<Connect><Stream>` TwiML and a raw WebSocket media endpoint bridges each
 * call. It only surfaces incoming calls — the voice controller picks the bot.
 */
@injectable()
export class TwilioVoiceChannel implements IVoiceChannel {
  private logger = new Logger('wabot:twilio-voice-channel')
  private wss?: WebSocketServer

  constructor(
    private config: TwilioVoiceConfig,
    private expressProvider: ExpressProvider,
    private httpServerProvider: HttpServerProvider,
    private intents: OutboundCallIntents,
    private accounts: TwilioAccountRegistry,
  ) {}

  listen(callback: (call: IIncomingVoiceCall) => Promise<void>): void {
    if (!this.config.publicBaseUrl) {
      this.logger.warn('twilio voice channel not configured (PUBLIC_BASE_URL missing); skipping')
      return
    }

    const app = this.expressProvider.getExpress()
    const httpServer = this.httpServerProvider.getHttpServer()
    const streamUrl = this.config.mediaStreamUrl()

    // 1. Voice webhook → TwiML that opens the media stream; forward call metadata
    //    and the outbound-intent token (if any) as <Parameter>s.
    app.post(this.config.webhookPath, express.urlencoded({ extended: false }), (req, res) => {
      const body = (req.body ?? {}) as Record<string, string>
      const query = req.query as Record<string, string | undefined>

      if (this.config.verifySignature && !this.isSignedByTwilio(req, body)) {
        this.logger.warn('rejected webhook with invalid Twilio signature', {
          path: this.config.webhookPath,
          to: body.To,
        })
        res.status(403).type('text/plain').send('Invalid Twilio signature')
        return
      }

      const parameters: Record<string, string> = {}
      if (body.From) parameters.from = body.From
      if (body.To) parameters.to = body.To
      if (body.CallSid) parameters.callSid = body.CallSid
      if (query.intent) parameters.intent = query.intent
      res.type('text/xml').send(connectStreamTwiml({ streamUrl, parameters }))
    })

    // 2. Bidirectional media stream (raw WebSocket) on the shared HTTP server.
    const wss = new WebSocketServer({ noServer: true })
    this.wss = wss
    httpServer.on('upgrade', (req, socket, head) => {
      const pathname = new URL(req.url ?? '', 'http://localhost').pathname
      if (pathname !== this.config.mediaPath) return // let other handlers deal with it
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    })

    wss.on('connection', (ws) => {
      const media = new TwilioVoiceMediaStream({
        send: (data) => ws.send(data),
        close: () => ws.close(),
      })
      ws.on('message', (data) => media.handleMessage(data.toString()))
      ws.on('close', () => media.handleClose())
      ws.on('error', (err) => this.logger.warn('media socket error', { message: err.message }))

      media.onStart((start) => {
        // Outbound calls dialed via TwilioCallService carry an intent token that
        // holds the per-call greeting (e.g. the reminder message).
        const intent = start.customParameters.intent
          ? this.intents.take(start.customParameters.intent)
          : undefined
        const connection: IVoiceCallConnection = {
          callId: start.callSid ?? start.streamSid,
          from: start.customParameters.from ?? '',
          to: start.customParameters.to ?? '',
          direction: intent ? 'outbound' : 'inbound',
          channelName: twilioVoiceChannelName,
        }
        void callback({ connection, media, greeting: intent?.greeting }).catch((err) =>
          this.logger.error(
            'voice call handler failed',
            err instanceof Error ? { message: err.message } : { err },
          ),
        )
      })
    })
  }

  /**
   * Validates `X-Twilio-Signature` against the exact URL Twilio requested and
   * the POST body. Tries the token of the account that owns the called number
   * (multi-account routes) and this channel's configured token.
   */
  private isSignedByTwilio(req: express.Request, body: Record<string, string>): boolean {
    const signature = req.header('X-Twilio-Signature')
    const url = this.config.publicBaseUrl.replace(/\/+$/, '') + req.originalUrl
    const tokens = [this.accounts.accountForNumber(body.To ?? '')?.authToken, this.config.authToken]
    return tokens.some((token) => !!token && isValidTwilioSignature(token, signature, url, body))
  }

  connect(): void {
    this.expressProvider.listen()
    this.logger.info('twilio voice ready', {
      webhook: this.config.webhookPath,
      media: this.config.mediaPath,
    })
  }

  disconnect(): void {
    this.wss?.close()
  }
}
