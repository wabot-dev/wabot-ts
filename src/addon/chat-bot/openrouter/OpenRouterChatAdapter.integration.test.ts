import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { OpenRouterChatAdapter } from './OpenRouterChatAdapter'

describe('OpenRouterChatAdapter', () => {
  const adapter = container.resolve(OpenRouterChatAdapter)

  testChatAdapter({
    adapter,
    model: 'openrouter/free',
  })
})
