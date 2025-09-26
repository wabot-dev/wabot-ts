import { describe, beforeEach } from 'node:test'
import { GoogleChatAdapter } from './GoogleChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('GoogleChatAdapter Integration Tests', () => {
  let adapter: GoogleChatAdapter

  beforeEach(() => {
    adapter = container.resolve(GoogleChatAdapter)
  })

  runIChatAdapterIntegrationTests({
    adapter: () => adapter,
    model: 'gemini-2.5-flash-lite',
  })
})
