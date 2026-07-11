/**
 * Minimal WebSocket abstraction so the OpenAI realtime engine can be unit-tested
 * with a fake socket (no network). Listener registration is additive.
 */
export interface IRealtimeSocket {
  send(data: string): void
  close(): void
  onOpen(listener: () => void): void
  onMessage(listener: (data: string) => void): void
  onClose(listener: () => void): void
  onError(listener: (error: unknown) => void): void
}
