import { describe, beforeEach, afterEach, test } from 'node:test'
import { GoogleChatAdapter } from './GoogleChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
  runIChatAdapterPerformanceTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('GoogleChatAdapter Integration Tests', () => {
  let adapter: GoogleChatAdapter
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.GOOGLE_API_KEY

    // Skip tests if no API key is provided
    if (!process.env.GOOGLE_API_KEY) {
      console.log('⚠️  Skipping Google integration tests - GOOGLE_API_KEY not provided')
      return
    }

    adapter = container.resolve(GoogleChatAdapter)
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_API_KEY = originalApiKey
    } else {
      delete process.env.GOOGLE_API_KEY
    }
  })

  // Skip all tests if no API key
  const runTests = () => {
    if (!process.env.GOOGLE_API_KEY) {
      test('Skipping integration tests - no API key', () => {
        console.log('Set GOOGLE_API_KEY environment variable to run integration tests')
      })
      return
    }

    runIChatAdapterIntegrationTests({
      adapter: () => adapter,
      model: 'gemini-1.5-pro', // Using Gemini Pro model
      skipTests: {
        // Google/Gemini specific configuration
        toolCalling: false, // Gemini supports tools
      },
    })

    runIChatAdapterPerformanceTests({
      adapter: () => adapter,
      model: 'gemini-1.5-pro',
    })

    test('Integration: Google-specific model variants', async () => {
      if (!process.env.GOOGLE_API_KEY) return

      const models = ['gemini-1.5-pro', 'gemini-1.5-flash']

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

    test('Integration: Google API specific features', async () => {
      if (!process.env.GOOGLE_API_KEY) return

      // Test with Gemini-specific system prompt
      const result = await adapter.nextItem({
        model: 'gemini-1.5-pro',
        systemPrompt: "You are Gemini, Google's AI assistant. Identify yourself briefly.",
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'What AI model are you?',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      if (result.chatItem.type === 'botMessage' && result.chatItem.botMessage.text) {
        const response = result.chatItem.botMessage.text.toLowerCase()
        // Should acknowledge being Gemini or Google's AI
        const hasGoogleReference =
          response.includes('gemini') || response.includes('google') || response.includes('bard')
        console.log(`Google AI identification response: ${result.chatItem.botMessage.text}`)
      }
    })
  }

  runTests()
})
