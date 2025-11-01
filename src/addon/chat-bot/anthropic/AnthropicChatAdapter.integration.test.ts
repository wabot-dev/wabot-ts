import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'

describe('AnthropicChatAdapter', () => {
  const adapter = container.resolve(AnthropicChatAdapter)

  testChatAdapter({
    adapter,
    model: 'claude-3-haiku-20240307',
  })
})
