import { WhatsApp } from './WhatsApp'

export interface IWhatsAppRepository {
  findBySlug(slug: string): Promise<WhatsApp | null>
  findByBusinessNumber(number: string): Promise<WhatsApp | null>
}
