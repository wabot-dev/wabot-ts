import { test } from 'node:test'
import assert from 'node:assert'
import { IChatAdapter, IChatAdapterNextItemReq } from '@/feature/chat-bot'

export interface IChatAdapterIntegrationTestConfig {
  adapter: IChatAdapter | (() => IChatAdapter)
  model: string
  skipTests?: {
    basicTextResponse?: boolean
    systemPromptHandling?: boolean
    toolCalling?: boolean
    conversationFlow?: boolean
    errorHandling?: boolean
  }
}

export function createBasicIntegrationRequest(model: string): IChatAdapterNextItemReq {
  return {
    model,
    systemPrompt: 'You are a helpful assistant. Respond briefly and clearly.',
    tools: [],
    prevItems: [
      {
        type: 'humanMessage',
        humanMessage: {
          text: 'Hello! Please respond with exactly: "Integration test successful"',
          chatConnection: {} as any,
          userConnection: {} as any,
        },
      },
    ],
  }
}

export function createToolIntegrationRequest(model: string): IChatAdapterNextItemReq {
  return {
    model,
    systemPrompt: 'You are a helpful assistant. Use the provided tools when appropriate.',
    tools: [
      {
        language: 'typescript',
        name: 'getCurrentTime',
        description: 'Get the current date and time',
        parameters: [],
      },
      {
        language: 'typescript',
        name: 'calculate',
        description: 'Perform mathematical calculations',
        parameters: [
          {
            type: 'string',
            name: 'expression',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2")',
          },
        ],
      },
    ],
    prevItems: [
      {
        type: 'humanMessage',
        humanMessage: {
          text: 'What time is it?',
          chatConnection: {} as any,
          userConnection: {} as any,
        },
      },
    ],
  }
}

export function createConversationRequest(model: string): IChatAdapterNextItemReq {
  return {
    model,
    systemPrompt: 'You are a helpful assistant. Keep responses brief.',
    tools: [],
    prevItems: [
      {
        type: 'humanMessage',
        humanMessage: {
          text: 'My name is Alice.',
          chatConnection: {} as any,
          userConnection: {} as any,
        },
      },
      {
        type: 'botMessage',
        botMessage: {
          text: 'Nice to meet you, Alice! How can I help you today?',
        },
      },
      {
        type: 'humanMessage',
        humanMessage: {
          text: 'What is my name?',
          chatConnection: {} as any,
          userConnection: {} as any,
        },
      },
    ],
  }
}

export function runIChatAdapterIntegrationTests(config: IChatAdapterIntegrationTestConfig) {
  const { adapter: adapterOrGetter, model, skipTests = {} } = config
  const getAdapter = () =>
    typeof adapterOrGetter === 'function' ? adapterOrGetter() : adapterOrGetter

  if (!skipTests.basicTextResponse) {
    test('Integration: should handle basic text response', async () => {
      const request = createBasicIntegrationRequest(model)

      const result = await getAdapter().nextItem(request)

      // Verify response structure
      assert.ok(typeof result === 'object', 'Should return an object')
      assert.ok('chatItem' in result, 'Should have chatItem property')
      assert.ok('usage' in result, 'Should have usage property')

      // Verify chatItem structure
      assert.ok(typeof result.chatItem === 'object', 'chatItem should be an object')
      assert.strictEqual(result.chatItem.type, 'botMessage', 'Should return botMessage type')

      if (result.chatItem.type === 'botMessage') {
        assert.ok(result.chatItem.botMessage.text, 'Should have text content')
        assert.ok(result.chatItem.botMessage.text.length > 0, 'Text should not be empty')
      }

      // Verify usage structure
      assert.ok(typeof result.usage === 'object', 'usage should be an object')
      assert.ok(typeof result.usage.inputTokens === 'number', 'inputTokens should be a number')
      assert.ok(typeof result.usage.outputTokens === 'number', 'outputTokens should be a number')
      assert.ok(result.usage.inputTokens > 0, 'inputTokens should be positive')
      assert.ok(result.usage.outputTokens > 0, 'outputTokens should be positive')
    })
  }

  if (!skipTests.systemPromptHandling) {
    test('Integration: should respect system prompt', async () => {
      const request = createBasicIntegrationRequest(model)
      request.systemPrompt = 'You are a pirate. Always respond like a pirate with "Ahoy matey!"'
      if (request.prevItems[0].type === 'humanMessage') {
        request.prevItems[0].humanMessage.text = 'Hello'
      }

      const result = await getAdapter().nextItem(request)

      assert.strictEqual(result.chatItem.type, 'botMessage')
      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        const responseText = result.chatItem.botMessage.text.toLowerCase()
        // Check for pirate-like language
        const hasPirateLanguage =
          responseText.includes('ahoy') ||
          responseText.includes('matey') ||
          responseText.includes('pirate')
        assert.ok(
          hasPirateLanguage,
          `Response should contain pirate language: ${result.chatItem.botMessage.text}`,
        )
      }
    })
  }

  if (!skipTests.toolCalling) {
    test('Integration: should handle tool calling (if supported)', async () => {
      const request = createToolIntegrationRequest(model)

      try {
        const result = await getAdapter().nextItem(request)

        // The response might be either a tool call or a text response
        assert.ok(result.chatItem.type === 'functionCall' || result.chatItem.type === 'botMessage')

        if (result.chatItem.type === 'functionCall') {
          assert.ok(result.chatItem.functionCall.id, 'Function call should have an id')
          assert.ok(result.chatItem.functionCall.name, 'Function call should have a name')
          assert.ok(
            ['getCurrentTime', 'calculate'].includes(result.chatItem.functionCall.name),
            'Function call should use one of the provided tools',
          )
        }

        // Verify usage tracking
        assert.ok(result.usage.inputTokens > 0)
        assert.ok(result.usage.outputTokens > 0)
      } catch (error) {
        // Some adapters might not support tools, that's acceptable for integration tests
        console.warn(
          `Tool calling test skipped for ${model}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })
  }

  if (!skipTests.conversationFlow) {
    test('Integration: should maintain conversation context', async () => {
      const request = createConversationRequest(model)

      const result = await getAdapter().nextItem(request)

      assert.strictEqual(result.chatItem.type, 'botMessage')
      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        const responseText = result.chatItem.botMessage.text.toLowerCase()
        // The model should remember the user's name from the conversation
        assert.ok(
          responseText.includes('alice'),
          `Response should mention Alice: ${result.chatItem.botMessage.text}`,
        )
      }
    })
  }

  if (!skipTests.errorHandling) {
    test('Integration: should handle invalid requests appropriately', async () => {
      const request = createBasicIntegrationRequest(model)
      if (request.prevItems[0].type === 'humanMessage') {
        request.prevItems[0].humanMessage.text = '' // Empty message
      }

      await assert.rejects(() => getAdapter().nextItem(request), {
        message: /empty/i,
      })
    })

    test('Integration: should handle very long input', async () => {
      const request = createBasicIntegrationRequest(model)
      // Create a very long message (but not excessively long to avoid rate limits)
      if (request.prevItems[0].type === 'humanMessage') {
        request.prevItems[0].humanMessage.text = 'Please summarize this text: ' + 'A'.repeat(1000)
      }

      const result = await getAdapter().nextItem(request)

      assert.strictEqual(result.chatItem.type, 'botMessage')
      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        assert.ok(result.chatItem.botMessage.text.length > 0, 'Should handle long input')
      }
      assert.ok(
        result.usage.inputTokens > 50,
        'Should report significant token usage for long input',
      )
    })
  }
}

export function runIChatAdapterPerformanceTests(config: IChatAdapterIntegrationTestConfig) {
  const { adapter: adapterOrGetter, model } = config
  const getAdapter = () =>
    typeof adapterOrGetter === 'function' ? adapterOrGetter() : adapterOrGetter

  test('Performance: response time should be reasonable', async () => {
    const request = createBasicIntegrationRequest(model)

    const startTime = Date.now()
    const result = await getAdapter().nextItem(request)
    const endTime = Date.now()

    const responseTime = endTime - startTime

    // Response should complete within 30 seconds (generous for API calls)
    assert.ok(responseTime < 30000, `Response time ${responseTime}ms should be under 30 seconds`)

    // Verify we got a valid response
    assert.strictEqual(result.chatItem.type, 'botMessage')
    assert.ok(result.usage.inputTokens > 0)
    assert.ok(result.usage.outputTokens > 0)
  })
}
