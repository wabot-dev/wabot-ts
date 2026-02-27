import { container } from '@/core/injection'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { OpenaiAudioTranscriber } from './OpenaiAudioTranscriber'

describe('OpenaiAudioTranscriber', () => {
  const transcriber = container.resolve(OpenaiAudioTranscriber)

  describe('transcribe', () => {
    test('should transcribe valid audio', async () => {
      const audioBuffer = Buffer.from('mock audio data')
      const result = await transcriber.transcribe({
        model: 'whisper-1',
        audio: audioBuffer,
      })
      
      assert.ok(result.text, 'Should return transcribed text')
    })

    test('should handle errors gracefully', async () => {
      const invalidBuffer = Buffer.from('')
      
      await assert.rejects(
        async () => {
          await transcriber.transcribe({
            model: 'whisper-1',
            audio: invalidBuffer,
          })
        },
        /Audio transcription failed/,
        'Should throw transcription error'
      )
    })
  })
})
