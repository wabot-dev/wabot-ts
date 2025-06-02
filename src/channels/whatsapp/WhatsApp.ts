import { Persistent, type IPersistentData } from '@/core'

export interface IWhatsAppBusinessNumber {
  id: string
  number: string
}

export interface IWhatsAppBusinessAccount {
  id: string
}

export interface IWhatsAppData extends IPersistentData {
  slug: string
  verifyToken: string
  appSecret: string
  accessToken: string
  businessAccount: IWhatsAppBusinessAccount
  businessNumbers: IWhatsAppBusinessNumber[]
}

export class WhatsApp extends Persistent<IWhatsAppData> {
  getVerifyToken() {
    return this.data.verifyToken
  }

  getBusinessAccount(): IWhatsAppBusinessAccount {
    return this.data.businessAccount
  }

  getAppSecret() {
    return this.data.appSecret
  }

  getBusinessNumbers() {
    return this.data.businessNumbers
  }

  getAccessToken() {
    return this.data.accessToken
  }

  hasBusinessNumber(number: string) {
    return this.data.businessNumbers.some((x) => x.number === number)
  }

  getBussinessNumber(number: string): IWhatsAppBusinessNumber | null {
    return this.data.businessNumbers.find((x) => x.number === number) ?? null
  }
}
