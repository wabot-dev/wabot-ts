import { describe, mock, beforeEach, afterEach } from 'node:test'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'
import { container } from '@/core/injection'
import { runIChatAdapterComplianceTests } from '../shared-tests/IChatAdapterTests'

describe('AnthropicChatAdapter', () => {
  let adapter: AnthropicChatAdapter
  let mockAnthropic: any
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-api-key'

    mockAnthropic = {
      messages: {
        create: mock.fn(),
      },
    }

    adapter = container.resolve(AnthropicChatAdapter)
    adapter['anthropic'] = mockAnthropic
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
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }
    mock.restoreAll()
  })

  runIChatAdapterComplianceTests({
    get adapter() { return adapter },
    get mockClient() { return mockAnthropic },
    createMockResponse: (content, usage) => ({
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens },
    }),
    setupMockCall: (mockClient, mockResponse) => {
      mockClient.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))
    },
  })
})