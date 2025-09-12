import { describe, test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { DeepSeekChatAdapter } from './DeepSeekChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { container } from '@/core/injection'
import { runIChatAdapterComplianceTests } from '../shared-tests/IChatAdapterTests'

describe('DeepSeekChatAdapter', () => {
  let adapter: DeepSeekChatAdapter
  let mockDeepSeek: any
  let originalApiKey: string | undefined
  let originalBaseUrl: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.DEEPSEEK_API_KEY
    originalBaseUrl = process.env.DEEPSEEK_BASE_URL
    process.env.DEEPSEEK_API_KEY = 'test-api-key'
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

    mockDeepSeek = {
      chat: {
        completions: {
          create: mock.fn(),
        },
      },
    }

    adapter = container.resolve(DeepSeekChatAdapter)
    adapter['deepSeek'] = mockDeepSeek
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
      process.env.DEEPSEEK_API_KEY = originalApiKey
    } else {
      delete process.env.DEEPSEEK_API_KEY
    }
    if (originalBaseUrl !== undefined) {
      process.env.DEEPSEEK_BASE_URL = originalBaseUrl
    } else {
      delete process.env.DEEPSEEK_BASE_URL
    }
    mock.restoreAll()
  })

  runIChatAdapterComplianceTests({
    get adapter() { return adapter },
    get mockClient() { return mockDeepSeek },
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