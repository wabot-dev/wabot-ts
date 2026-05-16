import * as crypto from 'node:crypto'
import * as path from 'node:path'

export function cmdChannelSocketPath(): string {
  if (process.platform === 'win32') {
    const cwdHash = crypto
      .createHash('sha1')
      .update(process.cwd())
      .digest('hex')
      .slice(0, 12)
    return `\\\\.\\pipe\\wabot-cmd-channel-${cwdHash}`
  }
  return path.resolve(process.cwd(), '.cmd-channel/socket')
}
