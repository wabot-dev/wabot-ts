import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'

describe('AnthropicChatAdapter', () => {
  const adapter = container.resolve(AnthropicChatAdapter)

  testChatAdapter({
    adapter,
    model: 'claude-haiku-4-5-20251001',
  })
})
