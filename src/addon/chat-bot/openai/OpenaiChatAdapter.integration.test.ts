import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { OpenaiChatAdapter } from './OpenaiChatAdapter'

describe('OpenaiChatAdapter', () => {
  const adapter = container.resolve(OpenaiChatAdapter)

  testChatAdapter({
    adapter,
    model: 'gpt-4o-mini',
  })
})
