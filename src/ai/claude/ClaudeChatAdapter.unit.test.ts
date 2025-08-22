import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { ClaudeChatAdapter } from './ClaudeChatAdapter'
import { IChatAdapterNextItemReq } from '@/chatbot'

describe('ClaudeChatAdapter', () => {
  let adapter: ClaudeChatAdapter
  let mockAnthropic: any
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_API_KEY
    process.env.CLAUDE_API_KEY = 'test-api-key'

    mockAnthropic = {
      messages: {
        create: mock.fn(),
      },
    }

    adapter = new ClaudeChatAdapter()
    // Override the anthropic client after construction
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
      process.env.CLAUDE_API_KEY = originalEnv
    } else {
      delete process.env.CLAUDE_API_KEY
    }
    mock.restoreAll()
  })

  describe('constructor', () => {
    it('should throw error when CLAUDE_API_KEY is not provided', () => {
      delete process.env.CLAUDE_API_KEY

      assert.throws(() => new ClaudeChatAdapter(), {
        message: 'CLAUDE_API_KEY env variable is required',
      })

      process.env.CLAUDE_API_KEY = 'test-api-key'
    })
  })

  describe('nextItem', () => {
    it('should call Claude API with correct parameters for simple request', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Test response' }],
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'CONNECTION_MESSAGE',
            content: {
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
      assert.strictEqual(callArgs.tools, undefined)

      assert.deepStrictEqual(result, {
        type: 'BOT_MESSAGE',
        content: { text: 'Test response' },
      })
    })

    it('should handle tools in request', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'test_tool',
            input: { param: 'value' },
          },
        ],
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [
          {
            language: 'typescript',
            name: 'test_tool',
            description: 'A test tool',
            parameters: [
              {
                type: 'string',
                name: 'param',
                description: 'A parameter',
              },
            ],
          },
        ],
        prevItems: [],
      }

      const result = await adapter.nextItem(req)

      const callArgs = mockAnthropic.messages.create.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.tools.length, 1)
      assert.deepStrictEqual(callArgs.tools[0], {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'A parameter' },
          },
          required: ['param'],
        },
      })

      assert.deepStrictEqual(result, {
        type: 'FUNCTION_CALL',
        content: {
          id: 'tool_123',
          name: 'test_tool',
          arguments: '{"param":"value"}',
        },
      })
    })

    it('should handle function call in previous items', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Function result processed' }],
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'FUNCTION_CALL',
            content: {
              id: 'call_123',
              name: 'test_function',
              arguments: '{"param":"value"}',
              result: 'Function executed successfully',
            },
          },
        ],
      }

      await adapter.nextItem(req)

      const callArgs = mockAnthropic.messages.create.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.messages.length, 2)
      assert.deepStrictEqual(callArgs.messages[0], {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'test_function',
            input: { param: 'value' },
          },
        ],
      })
      assert.deepStrictEqual(callArgs.messages[1], {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call_123',
            content: 'Function executed successfully',
          },
        ],
      })
    })

    it('should throw error for empty user message', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'CONNECTION_MESSAGE',
            content: {
              text: '',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'User message content is empty',
      })
    })

    it('should throw error for empty bot message', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'BOT_MESSAGE',
            content: { text: '' },
          },
        ],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Assistant message content is empty',
      })
    })

    it('should throw error for unsupported Claude response', async () => {
      const mockResponse = {
        content: [{ type: 'unsupported_type' }],
      }
      mockAnthropic.messages.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'claude-3-sonnet-20240229',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Not supported Claude Response',
      })
    })
  })
})
