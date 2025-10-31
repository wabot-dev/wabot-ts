import { container } from '@/core/injection'
import { testChatAdapter } from '@/feature/chat-bot/testChatAdapter'
import { describe } from 'node:test'
import { GoogleChatAdapterV2 } from './GoogleChatAdapterV2'

describe('GoogleChatAdapter', () => {
  const adapter = container.resolve(GoogleChatAdapterV2)

  testChatAdapter({
    adapter,
    model: 'gemini-2.5-pro',
  })
})
