import { test } from 'node:test'
import assert from 'node:assert'
import { IChatAdapter, IChatAdapterNextItemReq } from '@/feature/chat-bot'

export interface IChatAdapterTestConfig {
  adapter: IChatAdapter
  mockClient: any
  createMockResponse: (content: string, usage: { inputTokens: number; outputTokens: number }) => any
  setupMockCall: (mockClient: any, mockResponse: any) => void
}

export function createBasicRequest(): IChatAdapterNextItemReq {
  return {
    model: 'test-model',
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
}

export function createToolRequest(): IChatAdapterNextItemReq {
  return {
    model: 'test-model',
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
}

export function runIChatAdapterComplianceTests(config: IChatAdapterTestConfig) {
  test('should implement IChatAdapter interface correctly', async () => {
    // Verify adapter implements the interface
    assert.ok(typeof config.adapter.nextItem === 'function', 'Should have nextItem method')

    // Setup mock for basic text response
    const mockResponse = config.createMockResponse('Test response', {
      inputTokens: 10,
      outputTokens: 5,
    })
    config.setupMockCall(config.mockClient, mockResponse)

    const request = createBasicRequest()
    const result = await config.adapter.nextItem(request)

    // Verify response structure
    assert.ok(typeof result === 'object', 'Should return an object')
    assert.ok('chatItem' in result, 'Should have chatItem property')
    assert.ok('usage' in result, 'Should have usage property')

    // Verify chatItem structure
    assert.ok(typeof result.chatItem === 'object', 'chatItem should be an object')
    assert.ok('type' in result.chatItem, 'chatItem should have type property')
    assert.strictEqual(result.chatItem.type, 'botMessage', 'Should return botMessage type')

    // Verify usage structure
    assert.ok(typeof result.usage === 'object', 'usage should be an object')
    assert.ok('inputTokens' in result.usage, 'usage should have inputTokens property')
    assert.ok('outputTokens' in result.usage, 'usage should have outputTokens property')
    assert.ok(typeof result.usage.inputTokens === 'number', 'inputTokens should be a number')
    assert.ok(typeof result.usage.outputTokens === 'number', 'outputTokens should be a number')

    // Verify specific response values
    assert.strictEqual(result.usage.inputTokens, 10)
    assert.strictEqual(result.usage.outputTokens, 5)
  })

  test('should handle basic text requests correctly', async () => {
    const mockResponse = config.createMockResponse('Hello! How can I help you today?', {
      inputTokens: 15,
      outputTokens: 10,
    })
    config.setupMockCall(config.mockClient, mockResponse)

    const request = createBasicRequest()
    request.systemPrompt = 'You are a helpful assistant'

    const result = await config.adapter.nextItem(request)

    // Verify response structure and content
    assert.strictEqual(result.chatItem.type, 'botMessage')
    if (result.chatItem.type === 'botMessage') {
      assert.ok(result.chatItem.botMessage.text, 'Should have text content')
    }
    assert.strictEqual(result.usage.inputTokens, 15)
    assert.strictEqual(result.usage.outputTokens, 10)
  })

  test('should reject empty user messages', async () => {
    const request = createBasicRequest()
    request.prevItems = [
      {
        type: 'humanMessage',
        humanMessage: {
          text: '', // Empty message
          chatConnection: {} as any,
          userConnection: {} as any,
        },
      },
    ]

    await assert.rejects(() => config.adapter.nextItem(request), {
      message: /message content is empty/i,
    })
  })

  test('should validate system prompt handling', async () => {
    const mockResponse = config.createMockResponse('System prompt processed', {
      inputTokens: 20,
      outputTokens: 12,
    })
    config.setupMockCall(config.mockClient, mockResponse)

    const request = createBasicRequest()
    request.systemPrompt = 'Custom system prompt for testing'

    const result = await config.adapter.nextItem(request)

    // Verify that system prompt was processed (adapter should handle it appropriately)
    assert.ok(result.chatItem, 'Should return valid chatItem')
    assert.ok(result.usage, 'Should return valid usage')
    assert.strictEqual(result.usage.inputTokens, 20)
    assert.strictEqual(result.usage.outputTokens, 12)
  })
}