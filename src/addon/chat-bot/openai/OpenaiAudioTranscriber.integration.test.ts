import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { OpenaiAudioTranscriber } from './OpenaiAudioTranscriber'

process.env.OPENAI_API_KEY ??= 'test-key'

describe('OpenaiAudioTranscriber', () => {
  describe('transcribe', () => {
    test('preserves WAV metadata when building the audio file', async () => {
      const transcriber = new OpenaiAudioTranscriber()
      let capturedReq: any

      ;(transcriber as any).createAudioFile = async (req: any) => {
        capturedReq = req
        return {} as File
      }
      ;(transcriber as any).openai = {
        audio: {
          transcriptions: {
            create: async () => 'Hello from wav',
          },
        },
      }

      const result = await transcriber.transcribe({
        model: 'whisper-1',
        audio: Buffer.from('wav-audio'),
        filename: 'voice-note.wav',
        mimeType: 'audio/wav',
      })

      assert.equal(result.text, 'Hello from wav')
      assert.equal(capturedReq.filename, 'voice-note.wav')
      assert.equal(capturedReq.mimeType, 'audio/wav')
    })

    test('preserves MP3 metadata when building the audio file', async () => {
      const transcriber = new OpenaiAudioTranscriber()
      let capturedReq: any

      ;(transcriber as any).createAudioFile = async (req: any) => {
        capturedReq = req
        return {} as File
      }
      ;(transcriber as any).openai = {
        audio: {
          transcriptions: {
            create: async () => 'Hello from mp3',
          },
        },
      }

      const result = await transcriber.transcribe({
        model: 'whisper-1',
        audio: Buffer.from('mp3-audio'),
        filename: 'voice-note.mp3',
        mimeType: 'audio/mpeg',
      })

      assert.equal(result.text, 'Hello from mp3')
      assert.equal(capturedReq.filename, 'voice-note.mp3')
      assert.equal(capturedReq.mimeType, 'audio/mpeg')
    })

    test('throws descriptive error when audio metadata is inconsistent', async () => {
      const transcriber = new OpenaiAudioTranscriber()

      await assert.rejects(
        async () => {
          await transcriber.transcribe({
            model: 'whisper-1',
            audio: Buffer.from('broken'),
            filename: 'voice-note.wav',
            mimeType: 'audio/mpeg',
          })
        },
        /Audio transcription failed: Audio metadata is inconsistent/,
      )
    })
  })
})
