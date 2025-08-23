import { IWhatsAppRepository } from './IWhatsAppRepository'
import { WhatsApp } from './WhatsApp'

export class WhatsAppRepository implements IWhatsAppRepository {
  findBySlug(slug: string): Promise<WhatsApp | null> {
    throw new Error('Method not implemented.')
  }
  findByBusinessNumber(number: string): Promise<WhatsApp | null> {
    throw new Error('Method not implemented.')
  }
}
