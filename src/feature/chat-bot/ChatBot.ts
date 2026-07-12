import { randomUUID } from 'node:crypto'
import { MindsetOperator } from '@/feature/mindset'
import { AudioSpeechSynthesizer } from './AudioSpeechSynthesizer'
import { AudioTranscriber } from './AudioTranscriber'
import { ChatAdapter } from './ChatAdapter'
import { ChatItem } from './ChatItem'
import { ChatMemory } from './ChatMemory'
import { IChatBot } from './IChatBot'
import { IChatMessage } from './IChatMessage'
import { IChatMessageAudio } from './IChatMessageAudio'
import { stripAnsweredMedia } from './stripAnsweredMedia'
import { container, injectable } from '@/core/injection'
import { Logger } from '@/core/logger'

const DEFAULT_TTS_VOICE = 'alloy'

async function audioToBuffer(audio: IChatMessageAudio): Promise<Buffer> {
  if (audio.base64Url) {
    const base64 = audio.base64Url.includes(',')
      ? audio.base64Url.slice(audio.base64Url.indexOf(',') + 1)
      : audio.base64Url
    return Buffer.from(base64, 'base64')
  }
  if (!audio.publicUrl) throw new Error('audio has neither base64Url nor publicUrl')
  const res = await fetch(audio.publicUrl)
  if (!res.ok) throw new Error(`failed to fetch audio: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

const MAX_CONSECUTIVE_INVALID_ARGS = 2

function isInvalidArgsResult(result: string | undefined): boolean {
  if (!result) return false
  return (
    result.startsWith('{"error":"INVALID_ARGUMENTS"') ||
    result.startsWith('{"error":"INVALID_JSON_ARGUMENTS"')
  )
}

@injectable()
export class ChatBot implements IChatBot {
  private logger = new Logger('wabot:chat-bot')

  constructor(
    private memory: ChatMemory,
    private adapter: ChatAdapter,
    private mindset: MindsetOperator,
  ) {}

  public async sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => Promise<void>,
  ) {
    // Voice notes: transcribe with the mindset's speechToText model, if declared.
    await this.transcribeInbound(message)
    const inboundHadAudio = (message.audios?.length ?? 0) > 0

    const newChatItem = new ChatItem({
      type: 'humanMessage',
      humanMessage: message,
    })
    await this.memory.create(newChatItem)
    await this.processLoop(callback, 0, inboundHadAudio)
  }

  protected async processLoop(
    callback: (message: IChatMessage) => Promise<void>,
    invalidArgsCount: number,
    voiceReply = false,
  ) {
    const prevItems = await this.memory.findLastItems(16)
    if (prevItems.length === 0) {
      return
    }
    const lastChatItem = prevItems[prevItems.length - 1]
    if (lastChatItem.type === 'botMessage') {
      return
    }

    const systemPrompt = await this.mindset.systemPrompt()
    const tools = this.mindset.tools()
    const identity = await this.mindset.identity()

    const prevItemsData = prevItems.map((x) => x.getData())

    // The bot — not the provider adapters — decides which media reaches the
    // model: keep binaries only for the pending exchange and drop already-
    // answered ones. The leftover media also determines whether this call needs
    // a vision model.
    const sentItems = stripAnsweredMedia(prevItemsData)
    const needsVision = sentItems.some(
      (data) => data.type === 'humanMessage' && (data.humanMessage.images?.length ?? 0) > 0,
    )
    const kind = needsVision ? 'visionLlm' : 'llm'
    const candidates = await this.mindset.resolveModels(kind)
    if (candidates.length === 0) {
      throw new Error(
        `Invalid ${this.mindset.constructor.name} - no model resolved for kind '${kind}'`,
      )
    }

    const { nextItems: newItemsData } = await this.adapter.nextItems({
      models: candidates,
      systemPrompt,
      tools,
      prevItems: sentItems,
    })

    for (const newItemData of newItemsData) {
      if (newItemData.type === 'functionCall') {
        newItemData.functionCall.result = await this.mindset.callFunction(
          newItemData.functionCall.name,
          newItemData.functionCall.arguments ?? '{}',
        )
        if (isInvalidArgsResult(newItemData.functionCall.result)) {
          invalidArgsCount++
        } else {
          invalidArgsCount = 0
        }
      } else if (newItemData.type === 'botMessage') {
        newItemData.botMessage.senderName = identity.name
      }

      const newChatItem = new ChatItem(newItemData)
      await this.memory.create(newChatItem)

      if (newItemData.type === 'botMessage') {
        // Mirror: voice in → voice out. Synthesize on a copy so the base64 audio
        // is delivered but not persisted to chat memory.
        const reply = { ...newChatItem.botMessage }
        if (voiceReply) await this.synthesizeReply(reply)
        await callback(reply)
      }
    }

    if (invalidArgsCount >= MAX_CONSECUTIVE_INVALID_ARGS) {
      this.logger.warn(
        `Aborting chat loop after ${invalidArgsCount} consecutive invalid-argument function calls`,
      )
      return
    }

    if (newItemsData.length == 0 || newItemsData[newItemsData.length - 1].type === 'botMessage') {
      return
    }
    await this.processLoop(callback, invalidArgsCount, voiceReply)
  }

  /** Transcribes inbound audio into text using the mindset's speechToText model. */
  private async transcribeInbound(message: IChatMessage): Promise<void> {
    if (!message.audios?.length || message.text) return
    const models = await this.mindset.resolveModels('speechToText')
    if (models.length === 0) return

    try {
      const audio = message.audios[0]
      const { text } = await container.resolve(AudioTranscriber).transcribe({
        model: models[0].model,
        provider: models[0].provider,
        audio: await audioToBuffer(audio),
        mimeType: audio.mimeType,
        filename: audio.name,
      })
      if (text?.trim()) message.text = text.trim()
    } catch (error) {
      this.logger.error(
        'failed to transcribe inbound audio',
        error instanceof Error ? { message: error.message } : { error },
      )
    }
  }

  /** Attaches synthesized speech to a reply using the mindset's textToSpeech model. */
  private async synthesizeReply(message: IChatMessage): Promise<void> {
    if (!message.text) return
    const models = await this.mindset.resolveModels('textToSpeech')
    if (models.length === 0) return

    try {
      const res = await container.resolve(AudioSpeechSynthesizer).synthesize({
        model: models[0].model,
        provider: models[0].provider,
        voice: DEFAULT_TTS_VOICE,
        text: message.text,
        format: 'mp3',
      })
      message.audios = [
        {
          id: randomUUID(),
          mimeType: res.mimeType,
          base64Url: `data:${res.mimeType};base64,${res.audio.toString('base64')}`,
        },
      ]
    } catch (error) {
      this.logger.error(
        'failed to synthesize reply audio',
        error instanceof Error ? { message: error.message } : { error },
      )
    }
  }
}
