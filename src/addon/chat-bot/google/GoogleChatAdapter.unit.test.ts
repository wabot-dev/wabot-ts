import { describe, test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { GoogleChatAdapter } from './GoogleChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { Env } from '@/core/env'
import { runIChatAdapterComplianceTests } from '../shared-tests/IChatAdapterTests'

describe('GoogleChatAdapter', () => {
  let adapter: GoogleChatAdapter
  let mockOpenAI: any
  let mockEnv: Env
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.GOOGLE_API_KEY
    process.env.GOOGLE_API_KEY = 'test-api-key'

    mockOpenAI = {
      chat: {
        completions: {
          create: mock.fn(),
        },
      },
    }

    mockEnv = {
      requireString: mock.fn(() => 'test-api-key'),
    } as any

    adapter = new GoogleChatAdapter(mockEnv)
    adapter['openai'] = mockOpenAI
    adapter['logger'] = {
      debuggers: {},
      trace: mock.fn(),
      debug: mock.fn(),
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
      fatal: mock.fn(),
    } as any
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_API_KEY = originalApiKey
    } else {
      delete process.env.GOOGLE_API_KEY
    }
    mock.restoreAll()
  })

  runIChatAdapterComplianceTests({
    get adapter() { return adapter },
    get mockClient() { return mockOpenAI },
    createMockResponse: (content, usage) => ({
      choices: [{ message: { content, tool_calls: null } }],
      usage: { prompt_tokens: usage.inputTokens, completion_tokens: usage.outputTokens },
    }),
    setupMockCall: (mockClient, mockResponse) => {
      mockClient.chat.completions.create.mock.mockImplementation(() =>
        Promise.resolve(mockResponse),
      )
    },
  })
})