import { test } from 'node:test'

import {
  audioSpeechSynthesizerConformanceCases,
  audioTranscriberConformanceCases,
  IAudioSpeechSynthesizerConformanceReq,
  IAudioTranscriberConformanceReq,
} from '@/testing/conformance/audioAdapterConformanceCases'

export interface ItestAudioSpeechSynthesizerReq extends IAudioSpeechSynthesizerConformanceReq {}

/** node:test wrapper over the runner-agnostic speech-synthesizer conformance cases. */
export function testAudioSpeechSynthesizer(req: ItestAudioSpeechSynthesizerReq) {
  for (const conformanceCase of audioSpeechSynthesizerConformanceCases(req)) {
    test(conformanceCase.name, conformanceCase.run)
  }
}

export interface ItestAudioTranscriberReq extends IAudioTranscriberConformanceReq {}

/** node:test wrapper over the runner-agnostic transcriber conformance cases. */
export function testAudioTranscriber(req: ItestAudioTranscriberReq) {
  for (const conformanceCase of audioTranscriberConformanceCases(req)) {
    test(conformanceCase.name, conformanceCase.run)
  }
}
