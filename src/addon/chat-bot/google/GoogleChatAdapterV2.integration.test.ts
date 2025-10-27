import { describe, beforeEach } from 'node:test'
import { GoogleChatAdapterV2 } from './GoogleChatAdapterV2'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('GoogleChatAdapter v2 Integration Tests', () => {
  let adapter: GoogleChatAdapterV2

  beforeEach(() => {
    adapter = container.resolve(GoogleChatAdapterV2)
  })

  runIChatAdapterIntegrationTests({
    adapter: () => adapter,
    model: 'gemini-2.5-flash-lite',
  })
})
