import { describe, beforeEach } from 'node:test'
import { OpenaiChatAdapter } from './OpenaiChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('OpenaiChatAdapter Integration Tests', () => {
  let adapter: OpenaiChatAdapter

  beforeEach(() => {
    adapter = container.resolve(OpenaiChatAdapter)
  })

  runIChatAdapterIntegrationTests({
    adapter: () => adapter,
    model: 'gpt-3.5-turbo',
  })
})
