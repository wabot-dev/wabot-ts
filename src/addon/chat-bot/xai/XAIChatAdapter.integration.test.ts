import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { XAIChatAdapter } from './XAIChatAdapter'

describe('XAIChatAdapter', () => {
  const adapter = container.resolve(XAIChatAdapter)

  testChatAdapter({
    adapter,
    model: 'grok-4-fast-non-reasoning',
  })
})
