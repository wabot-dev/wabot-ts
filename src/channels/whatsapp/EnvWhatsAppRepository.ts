import { singleton } from '@/injection'
import { IWhatsAppRepository } from './IWhatsAppRepository'
import { WhatsApp } from './WhatsApp'
import { WabotEnv } from '@/env'

@singleton()
export class EnvWhatsAppRepository implements IWhatsAppRepository {
  constructor(private env: WabotEnv) {}

  async findBySlug(slug: string): Promise<WhatsApp | null> {
    const whatsApp = this.getFromEnvVars()
    if (whatsApp.getSlug() !== slug) {
      throw new Error(
        `Not found WhatsApp configuration in env variables for the required slug '${slug}'`,
      )
    }
    return whatsApp
  }

  async findByBusinessNumber(number: string): Promise<WhatsApp | null> {
    const whatsApp = this.getFromEnvVars()
    if (!whatsApp.getBussinessNumber(number)) {
      throw new Error(
        `Not found WhatsApp configuration in env variables for the required number '${number}'`,
      )
    }
    return whatsApp
  }

  private getFromEnvVars(): WhatsApp {
    const whatsApp = new WhatsApp({
      verifyToken: this.env.requireString('WHATSAPP_HOOK_TOKEN'),
      slug: this.env.requireString('WHATSAPP_HOOK_SLUG'),
      appSecret: this.env.requireString('WHATSAPP_APP_SECRET'),
      businessAccount: {
        id: this.env.requireString('WHATSAPP_ACCOUNT_ID'),
      },
      accessToken: this.env.requireString('WHATSAPP_ACCESS_TOKEN'),
      businessNumbers: [
        {
          id: this.env.requireString('WHATSAPP_BUSINESS_NUMBER_ID'),
          number: this.env.requireString('WHATSAPP_BUSINESS_NUMBER'),
        },
      ],
    })

    return whatsApp
  }
}
