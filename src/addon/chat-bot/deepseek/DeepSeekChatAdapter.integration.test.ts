import { describe, beforeEach } from 'node:test'
import { DeepSeekChatAdapter } from './DeepSeekChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('DeepSeekChatAdapter Integration Tests', () => {
  let adapter: DeepSeekChatAdapter

  beforeEach(() => {
    adapter = container.resolve(DeepSeekChatAdapter)
  })

  runIChatAdapterIntegrationTests({
    adapter: () => adapter,
    model: 'deepseek-chat',
  })
})
