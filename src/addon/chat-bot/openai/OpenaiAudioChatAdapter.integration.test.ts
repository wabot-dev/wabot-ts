import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { OpenaiAudioChatAdapter } from './OpenaiAudioChatAdapter'
import { OpenaiTtsConfig } from './OpenaiTtsConfig'

process.env.OPENAI_API_KEY ??= 'test-key'

describe('OpenaiAudioChatAdapter', () => {
  test('injects transcript into the prompt and attaches synthesized audio metadata', async () => {
    const adapter = new OpenaiAudioChatAdapter(
      new OpenaiTtsConfig('tts-1', 'alloy', 'mp3'),
      {
        transcribe: async () => ({ text: 'Transcribed audio text' }),
      } as any,
      {
        synthesize: async () => ({
          audio: Buffer.from('audio-bytes'),
          format: 'mp3',
          mimeType: 'audio/mpeg',
        }),
      } as any,
    )

    let capturedInput: unknown[] = []
    ;(adapter as any).openai = {
      responses: {
        create: async (payload: any) => {
          capturedInput = payload.input
          return {
            usage: { input_tokens: 3, output_tokens: 5 },
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'Bot reply with audio' }],
              },
            ],
          }
        },
      },
    }

    const result = await adapter.nextItems({
      model: 'gpt-4o-mini',
      systemPrompt: 'Act as a Bot',
      tools: [],
      prevItems: [],
      audioRequest: {
        model: 'whisper-1',
        audio: Buffer.from('wav-audio'),
        filename: 'clip.wav',
        mimeType: 'audio/wav',
      },
    })

    const transcriptInput = (capturedInput as any[]).find((item) => item.role === 'user')
    assert.ok(transcriptInput, 'should include a user item derived from audio transcription')
    assert.deepEqual(transcriptInput.content, [
      {
        type: 'input_text',
        text: 'Transcribed audio text',
      },
    ])

    assert.equal(result.nextItems.length, 1)
    assert.equal(result.nextItems[0].type, 'botMessage')
    const audio = result.nextItems[0].botMessage.audios?.[0]
    assert.ok(audio, 'should attach synthesized audio to the bot message')
    assert.equal(audio?.mimeType, 'audio/mpeg')
    assert.equal(audio?.metadata?.provider, 'openai')
    assert.equal(audio?.metadata?.model, 'tts-1')
    assert.equal(audio?.metadata?.voice, 'alloy')
    assert.equal(audio?.metadata?.format, 'mp3')
    assert.equal(audio?.metadata?.sizeBytes, Buffer.from('audio-bytes').length)
    assert.ok(audio?.metadata?.createdAt)
  })

  test('degrades gracefully when transcription fails', async () => {
    const adapter = new OpenaiAudioChatAdapter(
      new OpenaiTtsConfig(),
      {
        transcribe: async () => {
          throw new Error('transcription failed')
        },
      } as any,
      {
        synthesize: async () => ({
          audio: Buffer.from('audio-bytes'),
          format: 'mp3',
          mimeType: 'audio/mpeg',
        }),
      } as any,
    )

    let capturedInput: unknown[] = []
    ;(adapter as any).openai = {
      responses: {
        create: async (payload: any) => {
          capturedInput = payload.input
          return {
            usage: { input_tokens: 1, output_tokens: 1 },
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'Fallback bot reply' }],
              },
            ],
          }
        },
      },
    }

    const result = await adapter.nextItems({
      model: 'gpt-4o-mini',
      systemPrompt: 'Act as a Bot',
      tools: [],
      prevItems: [],
      audioRequest: {
        model: 'whisper-1',
        audio: Buffer.from('broken'),
        filename: 'clip.wav',
      },
    })

    assert.deepEqual(capturedInput, [{ role: 'system', content: 'Act as a Bot' }])
    assert.equal(result.nextItems[0].type, 'botMessage')
    assert.equal(result.nextItems[0].botMessage.text, 'Fallback bot reply')
  })

  test('degrades gracefully when synthesis fails', async () => {
    const adapter = new OpenaiAudioChatAdapter(
      new OpenaiTtsConfig(),
      {
        transcribe: async () => ({ text: 'Transcribed audio text' }),
      } as any,
      {
        synthesize: async () => {
          throw new Error('tts failed')
        },
      } as any,
    )

    ;(adapter as any).openai = {
      responses: {
        create: async () => ({
          usage: { input_tokens: 2, output_tokens: 2 },
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Text only reply' }],
            },
          ],
        }),
      },
    }

    const result = await adapter.nextItems({
      model: 'gpt-4o-mini',
      systemPrompt: 'Act as a Bot',
      tools: [],
      prevItems: [],
      audioRequest: {
        model: 'whisper-1',
        audio: Buffer.from('wav-audio'),
        filename: 'clip.wav',
      },
    })

    assert.equal(result.nextItems[0].type, 'botMessage')
    assert.equal(result.nextItems[0].botMessage.text, 'Text only reply')
    assert.equal(result.nextItems[0].botMessage.audios, undefined)
  })

  test('behaves like a normal chat adapter when no audio request is provided', async () => {
    const adapter = new OpenaiAudioChatAdapter(
      new OpenaiTtsConfig(),
      {
        transcribe: async () => ({ text: 'unused' }),
      } as any,
      {
        synthesize: async () => ({
          audio: Buffer.from('audio-bytes'),
          format: 'mp3',
          mimeType: 'audio/mpeg',
        }),
      } as any,
    )

    let transcribeCalls = 0
    ;(adapter as any).transcriber = {
      transcribe: async () => {
        transcribeCalls += 1
        return { text: 'unused' }
      },
    }
    ;(adapter as any).openai = {
      responses: {
        create: async () => ({
          usage: { input_tokens: 1, output_tokens: 1 },
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Regular reply' }],
            },
          ],
        }),
      },
    }

    const result = await adapter.nextItems({
      model: 'gpt-4o-mini',
      systemPrompt: 'Act as a Bot',
      tools: [],
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: { text: 'Hello' },
        },
      ],
    })

    assert.equal(transcribeCalls, 0)
    assert.equal(result.nextItems[0].type, 'botMessage')
    assert.equal(result.nextItems[0].botMessage.text, 'Regular reply')
  })
})
