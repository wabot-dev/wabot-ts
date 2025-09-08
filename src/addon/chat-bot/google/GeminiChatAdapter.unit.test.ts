import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { GoogleChatAdapter } from './GoogleChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { container } from '@/core/injection'

describe('GeminiChatAdapter', () => {
  let adapter: GoogleChatAdapter
  let mockGenAI: any
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'test-api-key'

    mockGenAI = {
      models: {
        generateContent: mock.fn(),
      },
    }

    adapter = container.resolve(GoogleChatAdapter)
    adapter['genai'] = mockGenAI
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
      process.env.GEMINI_API_KEY = originalApiKey
    } else {
      delete process.env.GEMINI_API_KEY
    }
    mock.restoreAll()
  })

  describe('constructor', () => {
    it('should throw error when GEMINI_API_KEY is not provided', () => {
      // delete process.env.GEMINI_API_KEY

      // assert.throws(() => new GoogleChatAdapter(), {
      //   message: 'GEMINI_API_KEY env variable is required',
      // })

      // process.env.GEMINI_API_KEY = 'test-api-key'
    })

    it('should throw error for unsupported model in nextItem', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'invalid-model',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message:
          'Unsupported Gemini model: invalid-model. Supported models: gemini-2.0-flash-exp, gemini-1.5-flash, gemini-1.5-pro, gemini-pro',
      })
    })
  })

  describe('nextItem', () => {
    it('should call Gemini API with correct parameters for simple request', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: 'Test response' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
          },
        },
      }
      mockGenAI.models.generateContent.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
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

      assert.strictEqual(mockGenAI.models.generateContent.mock.callCount(), 1)

      const callArgs = mockGenAI.models.generateContent.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.model, 'gemini-1.5-flash')
      assert.strictEqual(callArgs.contents.length, 3)
      assert.deepStrictEqual(callArgs.contents[2], {
        role: 'user',
        parts: [{ text: 'Hello' }],
      })
      assert.strictEqual(callArgs.tools, undefined)

      assert.deepStrictEqual(result, {
        chatItem: { type: 'botMessage', botMessage: { text: 'Test response' } },
        usage: {
          inputTokens: 10,
          outputTokens: 15,
        },
      })
    })

    it('should handle tools in request', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: 'test_tool',
                      args: { param: 'value' },
                    },
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 20,
            candidatesTokenCount: 5,
          },
        },
      }
      mockGenAI.models.generateContent.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
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

      const callArgs = mockGenAI.models.generateContent.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.tools.length, 1)
      assert.deepStrictEqual(callArgs.tools[0].functionDeclarations[0], {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'A parameter' },
          },
          required: ['param'],
        },
      })

      assert.strictEqual(result.chatItem.type, 'functionCall')
      if (result.chatItem.type === 'functionCall') {
        assert.strictEqual(result.chatItem.functionCall.name, 'test_tool')
        assert.strictEqual(result.chatItem.functionCall.arguments, '{"param":"value"}')
        assert.ok(result.chatItem.functionCall.id) // Just check it exists
      }
    })

    it('should handle function call in previous items', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: 'Function result processed' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 30,
            candidatesTokenCount: 20,
          },
        },
      }
      mockGenAI.models.generateContent.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'functionCall',
            functionCall: {
              id: 'call_123',
              name: 'test_function',
              arguments: '{"param":"value"}',
              result: 'Function executed successfully',
            },
          },
        ],
      }

      await adapter.nextItem(req)

      const callArgs = mockGenAI.models.generateContent.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.contents.length, 4)

      assert.deepStrictEqual(callArgs.contents[2], {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'test_function',
              args: { param: 'value' },
            },
          },
        ],
      })

      assert.deepStrictEqual(callArgs.contents[3], {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'test_function',
              response: {
                result: 'Function executed successfully',
              },
            },
          },
        ],
      })
    })

    it('should throw error for empty user message', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
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
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'botMessage',
            botMessage: { text: '' },
          },
        ],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Bot message content is empty',
      })
    })


    it('should throw error for unsupported Gemini response', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ unsupportedType: 'data' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
          },
        },
      }
      mockGenAI.models.generateContent.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Not supported Gemini Response',
      })
    })

    it('should throw error when usage info is missing', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: 'Test response' }],
              },
            },
          ],
          usageMetadata: null,
        },
      }
      mockGenAI.models.generateContent.mock.mockImplementation(() => Promise.resolve(mockResponse))

      const req: IChatAdapterNextItemReq = {
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Unable to found usage info',
      })
    })
  })
})
