import { IWasenderMessageKey } from './IWasenderEvent'

export function extractNumberFromWasenderMessageKey(key: IWasenderMessageKey): string {
  return key.cleanedSenderPn ?? key.senderPn?.split('@')?.at(0) ?? key.remoteJid.split('@').at(0)!
}
