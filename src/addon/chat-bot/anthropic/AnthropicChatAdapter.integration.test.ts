import { describe, beforeEach } from 'node:test'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('AnthropicChatAdapter Integration Tests', () => {
  let adapter: AnthropicChatAdapter

  beforeEach(() => {
    adapter = container.resolve(AnthropicChatAdapter)
  })

  runIChatAdapterIntegrationTests({
    adapter: () => adapter,
    model: 'claude-3-haiku-20240307',
  })
})
