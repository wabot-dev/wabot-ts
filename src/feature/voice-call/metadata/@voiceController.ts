import { container, injectable } from '@/core/injection'
import { type IConstructor } from '@/core/generics'
import { VoiceControllerMetadataStore } from './VoiceControllerMetadataStore'

/** Marks a class as a voice controller (analogous to `@chatController`). */
export function voiceController() {
  return function (target: IConstructor<any>) {
    container.resolve(VoiceControllerMetadataStore).saveVoiceControllerMetadata({
      controllerConstructor: target,
    })
    injectable()(target)
  }
}
