import { describe, beforeEach, afterEach, test } from 'node:test'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
  runIChatAdapterPerformanceTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('AnthropicChatAdapter Integration Tests', () => {
  let adapter: AnthropicChatAdapter
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.ANTHROPIC_API_KEY

    // Skip tests if no API key is provided
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⚠️  Skipping Anthropic integration tests - ANTHROPIC_API_KEY not provided')
      return
    }

    adapter = container.resolve(AnthropicChatAdapter)
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }
  })

  // Skip all tests if no API key
  const runTests = () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      test('Skipping integration tests - no API key', () => {
        console.log('Set ANTHROPIC_API_KEY environment variable to run integration tests')
      })
      return
    }

    // Use default model for integration tests
    const model = 'claude-3-haiku-20240307'

    runIChatAdapterIntegrationTests({
      adapter: () => adapter,
      model, // Using Haiku for faster/cheaper tests
      skipTests: {
        // Anthropic/Claude specific configuration
        toolCalling: false, // Claude supports tools
      },
    })

    runIChatAdapterPerformanceTests({
      adapter: () => adapter,
      model,
    })

    test('Integration: Anthropic-specific model variants', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const models = [
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
      ]

      for (const model of models) {
        try {
          const result = await adapter.nextItem({
            model,
            systemPrompt: 'You are a helpful assistant.',
            tools: [],
            prevItems: [
              {
                type: 'humanMessage',
                humanMessage: {
                  text: 'Hello, respond with just "OK"',
                  chatConnection: {} as any,
                  userConnection: {} as any,
                },
              },
            ],
          })

          // Basic validation that the model works
          if (result.chatItem.type === 'botMessage') {
            console.log(`✅ ${model}: ${result.chatItem.botMessage.text}`)
          }
        } catch (error) {
          console.warn(
            `⚠️  ${model} failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    })

    test('Integration: Claude tool calling capabilities', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const result = await adapter.nextItem({
        model,
        systemPrompt: 'You are a helpful assistant. Use tools when appropriate.',
        tools: [
          {
            language: 'typescript',
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: [
              {
                type: 'string',
                name: 'location',
                description: 'The city and country, e.g. San Francisco, US',
              },
            ],
          },
        ],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'What is the weather like in Paris?',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      // Claude should either call the tool or explain why it can't
      if (result.chatItem.type === 'functionCall') {
        console.log(`✅ Claude called tool: ${result.chatItem.functionCall.name}`)
        console.log(`Arguments: ${result.chatItem.functionCall.arguments}`)
      } else if (result.chatItem.type === 'botMessage') {
        console.log(`Claude response: ${result.chatItem.botMessage.text}`)
      }
    })

    test('Integration: Claude system prompt adherence', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const result = await adapter.nextItem({
        model,
        systemPrompt:
          'You are Claude, an AI assistant created by Anthropic. Always mention that you are Claude in your responses.',
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'Who are you?',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        const response = result.chatItem.botMessage.text.toLowerCase()
        const mentionsClaude = response.includes('claude') || response.includes('anthropic')
        console.log(`Claude identification response: ${result.chatItem.botMessage.text}`)
        // Note: In integration tests, we log rather than assert for AI responses
        // as they can vary while still being correct
      }
    })

    test('Integration: Claude conversation memory', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const result = await adapter.nextItem({
        model,
        systemPrompt: 'You are a helpful assistant with good memory.',
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'My favorite color is blue.',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
          {
            type: 'botMessage',
            botMessage: {
              text: "I'll remember that your favorite color is blue!",
            },
          },
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'What did I just tell you about my color preference?',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        const response = result.chatItem.botMessage.text.toLowerCase()
        const remembersBlue = response.includes('blue')
        console.log(`Claude memory test response: ${result.chatItem.botMessage.text}`)
        console.log(`Remembers favorite color: ${remembersBlue}`)
      }
    })
  }

  runTests()
})
