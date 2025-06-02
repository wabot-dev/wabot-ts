import { Logger } from '@/logger'
import { WhatsAppReceiver } from './WhatsAppReceiver'
import { singleton } from 'tsyringe'
import { ExpressProvider } from '../express'
import { type Express, type Request, type Response } from 'express'
import { WhatsAppRepository } from './WhatsAppRepository'
import { WabotDevConnection } from '../wabot'
import { container } from '@/injection'

@singleton()
export class WhatsAppReceiverByWebHook extends WhatsAppReceiver {
  private expressApp: Express

  private webhookPath: string = '/whatsapp/web-hook/:slug'

  constructor(
    private expressProvider: ExpressProvider,
    private whatsAppRepository: WhatsAppRepository,
  ) {
    super(new Logger('wabot:whatsapp-receiver-by-webhook'))
    this.expressApp = this.expressProvider.getExpress()
  }

  async connect(): Promise<void> {
    this.expressApp.get(this.webhookPath, async (req: Request, res: Response) => {
      try {
        let mode = req.query['hub.mode']
        let token = req.query['hub.verify_token']
        let challenge = req.query['hub.challenge']

        if (!mode || !token || !challenge) {
          res.sendStatus(400)
          return
        }

        const whatsApp = await this.whatsAppRepository.findBySlug(req.params.slug)

        if (!whatsApp || mode !== 'subscribe' || token !== whatsApp.getVerifyToken()) {
          res.sendStatus(403)
          return
        }

        res.status(200).send(challenge)
      } catch (e) {
        this.logger.error(e)
        res.sendStatus(500)
        return
      }
    })

    this.expressApp.post(this.webhookPath, (req: Request, res: Response) => {
      const payload = req.body
      this.handlePayload(payload)
      res.sendStatus(200)
    })

    this.expressProvider.listen()
  }
}

if (!WabotDevConnection.isTokenAvailable()) {
  container.register(WhatsAppReceiver as any, {
    useClass: WhatsAppReceiverByWebHook,
  })
}
