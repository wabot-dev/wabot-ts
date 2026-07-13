function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface IConnectStreamTwimlOptions {
  /** wss:// URL Twilio should open for the bidirectional media stream. */
  streamUrl: string
  /** `<Parameter>` values delivered in the media `start` event (e.g. from/to). */
  parameters?: Record<string, string>
}

/**
 * TwiML that bridges the call into a bidirectional Media Stream. `<Connect>`
 * blocks until the WebSocket closes, so the whole call is handled over the stream.
 */
export function connectStreamTwiml(options: IConnectStreamTwimlOptions): string {
  const params = Object.entries(options.parameters ?? {})
    .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}"/>`)
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Connect><Stream url="${escapeXml(options.streamUrl)}">${params}</Stream></Connect></Response>`
  )
}
