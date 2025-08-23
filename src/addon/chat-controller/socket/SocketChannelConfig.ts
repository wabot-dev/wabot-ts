import { injectable } from '@/core/injection'
import type { ISocketChannelConfig } from './ISocketChannelConfig'

@injectable()
export class SocketChannelConfig implements ISocketChannelConfig {
  constructor(public channel: string) {}
}
