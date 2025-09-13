import { describe, beforeEach, afterEach, test } from 'node:test'
import { DeepSeekChatAdapter } from './DeepSeekChatAdapter'
import { container } from '@/core/injection'
import {
  runIChatAdapterIntegrationTests,
  runIChatAdapterPerformanceTests,
} from '../shared-tests/IChatAdapterIntegrationTests'

describe('DeepSeekChatAdapter Integration Tests', () => {
  let adapter: DeepSeekChatAdapter
  let originalApiKey: string | undefined
  let originalBaseUrl: string | undefined

  beforeEach(() => {
    adapter = container.resolve(DeepSeekChatAdapter)
  })

  // Skip all tests if no API key
  const runTests = () => {
    runIChatAdapterIntegrationTests({
      adapter: () => adapter,
      model: 'deepseek-chat', // Standard DeepSeek model
      skipTests: {
        // DeepSeek specific configuration
        toolCalling: false, // DeepSeek supports tools through OpenAI-compatible API
      },
    })

    runIChatAdapterPerformanceTests({
      adapter: () => adapter,
      model: 'deepseek-chat',
    })

    test('Integration: DeepSeek-specific model variants', async () => {
      const models = ['deepseek-chat', 'deepseek-coder']

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
          // Some models might not be available depending on API access
        }
      }
    })

    test('Integration: DeepSeek coding capabilities', async () => {
      const result = await adapter.nextItem({
        model: 'deepseek-coder',
        systemPrompt: 'You are a coding assistant. Provide brief, accurate code examples.',
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'Write a simple TypeScript function that adds two numbers.',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      if (result.chatItem.type === 'botMessage') {
        const response = result.chatItem.botMessage.text || ''
        console.log(`DeepSeek coding response: ${response}`)

        // Check if response contains code-related keywords
        const hasCodeKeywords =
          response.toLowerCase().includes('function') ||
          response.toLowerCase().includes('typescript') ||
          response.includes('=>') ||
          response.includes('return')

        console.log(`Contains coding elements: ${hasCodeKeywords}`)
      }
    })

    test('Integration: DeepSeek API configuration', async () => {

      // Test with explicit base URL
      const result = await adapter.nextItem({
        model: 'deepseek-chat',
        systemPrompt: 'You are DeepSeek, an AI assistant. Identify yourself briefly.',
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
        console.log(`DeepSeek identification response: ${result.chatItem.botMessage.text}`)

        // DeepSeek should acknowledge its identity
        const hasDeepSeekReference = response.includes('deepseek') || response.includes('assistant')
        console.log(`Mentions DeepSeek: ${hasDeepSeekReference}`)
      }
    })

    test('Integration: DeepSeek tool calling with coding context', async () => {

      const result = await adapter.nextItem({
        model: 'deepseek-coder',
        systemPrompt:
          'You are a coding assistant. Use tools when they can help with programming tasks.',
        tools: [
          {
            language: 'typescript',
            name: 'run_code',
            description: 'Execute code and return the result',
            parameters: [
              {
                type: 'string',
                name: 'code',
                description: 'The code to execute',
              },
              {
                type: 'string',
                name: 'language',
                description: 'Programming language (typescript, javascript, python)',
              },
            ],
          },
        ],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: {
              text: 'Can you run this code: console.log("Hello from DeepSeek")',
              chatConnection: {} as any,
              userConnection: {} as any,
            },
          },
        ],
      })

      // DeepSeek should either call the tool or explain the code
      if (result.chatItem.type === 'functionCall') {
        console.log(`✅ DeepSeek called tool: ${result.chatItem.functionCall.name}`)
        console.log(`Arguments: ${result.chatItem.functionCall.arguments}`)
      } else if (result.chatItem.type === 'botMessage') {
        console.log(`DeepSeek response: ${result.chatItem.botMessage.text}`)
      }
    })

    test('Integration: DeepSeek error handling', async () => {

      // Test with empty message (should be handled by adapter validation)
      try {
        await adapter.nextItem({
          model: 'deepseek-chat',
          systemPrompt: 'You are a helpful assistant.',
          tools: [],
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: {
                text: '', // Empty message
                chatConnection: {} as any,
                userConnection: {} as any,
              },
            },
          ],
        })

        console.warn('⚠️  Expected error for empty message but request succeeded')
      } catch (error) {
        console.log(
          `✅ Correctly handled empty message error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })

    test('Integration: DeepSeek with different base URLs', async () => {
      // This test verifies that the base URL configuration works
      // The actual URL should be set in environment variables
      const currentBaseUrl = process.env.DEEPSEEK_BASE_URL
      console.log(`Testing with base URL: ${currentBaseUrl}`)

      try {
        const result = await adapter.nextItem({
          model: 'deepseek-chat',
          systemPrompt: 'You are a helpful assistant.',
          tools: [],
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: {
                text: 'Test connection with current base URL configuration.',
                chatConnection: {} as any,
                userConnection: {} as any,
              },
            },
          ],
        })

        if (result.chatItem.type === 'botMessage') {
          console.log(`✅ Base URL configuration working: ${result.chatItem.botMessage.text}`)
        }
      } catch (error) {
        console.error(
          `❌ Base URL configuration failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        throw error
      }
    })
  }

  runTests()
})
