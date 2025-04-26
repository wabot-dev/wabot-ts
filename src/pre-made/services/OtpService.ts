import { injectable } from '@/injection'
import { randomInt } from 'crypto'

export interface IOtpService {
  generate(): Promise<string>
}

@injectable()
export class OtpService implements IOtpService {
  async generate(): Promise<string> {
    return randomInt(100000, 999999).toString()
  }
}
