import { describe, mock, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { container } from '@/core/injection'


describe('ClaudeChatAdapter', () => {
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

  describe('nextItem', () => {
    test('should call Claude API with correct parameters for simple text request', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        usage: { input_tokens: 10, output_tokens: 15 },
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'Hello',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      }

      const result = await adapter.nextItem(req)

      assert.strictEqual(mockAnthropic.messages.create.mock.callCount(), 1)
      const callArgs = mockAnthropic.messages.create.mock.calls[0].arguments[0]

      assert.strictEqual(callArgs.model, 'claude-3-sonnet-20240229')
      assert.strictEqual(callArgs.system, 'You are a helpful assistant')
      assert.strictEqual(callArgs.max_tokens, 4096)
      assert.deepStrictEqual(callArgs.messages, [{ role: 'user', content: 'Hello' }])

      assert.deepStrictEqual(result, {
        chatItem: {
          type: 'botMessage',
          botMessage: { text: 'Hello! How can I help you today?' },
        },
        usage: { inputTokens: 10, outputTokens: 15 },
      })
    })

    test('should handle tool usage correctly', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'call_abc123',
            name: 'calculate',
            input: { expression: '2 + 2' },
          },
        ],
        usage: { input_tokens: 25, output_tokens: 8 },
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [
          {
            language: 'typescript',
            name: 'calculate',
            description: 'Calculate mathematical expressions',
            parameters: [
              {
                type: 'string',
                name: 'expression',
                description: 'Mathematical expression to calculate',
              },
            ],
          },
        ],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'What is 2 + 2?',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      }

      const result = await adapter.nextItem(req)

      const callArgs = mockAnthropic.messages.create.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.tools.length, 1)
      assert.strictEqual(callArgs.tools[0].name, 'calculate')
      assert.strictEqual(callArgs.tools[0].description, 'Calculate mathematical expressions')

      assert.deepStrictEqual(result, {
        chatItem: {
          type: 'functionCall',
          functionCall: {
            id: 'call_abc123',
            name: 'calculate',
            arguments: '{"expression":"2 + 2"}',
          },
        },
        usage: { inputTokens: 25, outputTokens: 8 },
      })
    })
  })
})
