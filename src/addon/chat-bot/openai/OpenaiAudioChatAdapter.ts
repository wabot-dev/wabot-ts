import {
  IOpenaiAudioChatAdapter,
  IOpenaiAudioChatAdapterNextItemsReq,
  IOpenaiAudioChatAdapterNextItemsRes,
} from '../../../feature/chat-bot/IOpenaiAudioChatAdapter'
import {
  IChatAdapterNextItemsReq,
  IChatAdapterNextItemsRes,
  IChatItem,
  IChatMessage,
  IFunctionCall,
  ILanguageModelUsage,
} from '@/feature/chat-bot'
import { IAudioTranscribeReq, IAudioTranscribeRes } from '@/feature/chat-bot/IAudioTranscriber'
import { IChatMessageAudio, IAudioMetadata } from '@/feature/chat-bot/IChatMessageAudio'
import { OpenaiTtsConfig } from './OpenaiTtsConfig'
import { AudioResponseFormat } from '@/feature/chat-bot/IAudioSpeechSynthesizer'
import { IMindsetTool } from '@/feature/mindset'
import { singleton, inject } from '@/core/injection'
import { OpenAI, toFile } from 'openai'
import { Logger } from '@/core/logger'

@singleton()
export class OpenaiAudioChatAdapter implements IOpenaiAudioChatAdapter {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-audio-chat-adapter')

  constructor(@inject(OpenaiTtsConfig) private ttsConfig: OpenaiTtsConfig) {}

  async nextItems(
    req: IOpenaiAudioChatAdapterNextItemsReq,
  ): Promise<IOpenaiAudioChatAdapterNextItemsRes> {
    let updatedPrevItems: IChatItem[] = req.prevItems

    if (req.audioRequest) {
      try {
        const transcript = await this.transcribeAudio(req.audioRequest)
        if (transcript) {
          updatedPrevItems = [
            ...req.prevItems,
            {
              type: 'humanMessage',
              humanMessage: { text: transcript },
            } as IChatItem,
          ]
          this.logger.info('Audio transcribed', { text: transcript })
        }
      } catch (error) {
        this.logger.error('Failed to transcribe audio', error)
      }
    }

    const openIaInput: OpenAI.Responses.ResponseInput = []
    openIaInput.push({ role: 'system', content: req.systemPrompt })
    openIaInput.push(...this.mapChatItems(updatedPrevItems))

    const tools = req.tools.map((x) => this.mapTool(x))

    const response = await this.openai.responses.create({
      model: req.model,
      input: openIaInput,
      tools,
    })

    const result = this.mapResponse(response)

    for (const item of result.nextItems) {
      if (item.type === 'botMessage' && item.botMessage.text) {
        try {
          const audio = await this.synthesizeAudio(item.botMessage.text)
          item.botMessage.audios = [audio]
        } catch (error) {
          this.logger.error('Failed to synthesize audio', error)
        }
      }
    }

    return result as IOpenaiAudioChatAdapterNextItemsRes
  }

  private async transcribeAudio(req: IAudioTranscribeReq): Promise<string> {
    const file = await toFile(req.audio, 'audio.wav')
    const response = await this.openai.audio.transcriptions.create({
      model: req.model,
      file,
      response_format: 'text',
    })

    return typeof response === 'string' ? response : ''
  }

  private async synthesizeAudio(text: string): Promise<IChatMessageAudio> {
    const response = await this.openai.audio.speech.create({
      model: this.ttsConfig.model,
      voice: this.ttsConfig.voice,
      input: text,
      response_format: this.ttsConfig.format,
    })

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    const mimeType = this.getMimeType(this.ttsConfig.format)
    const base64Url = `data:${mimeType};base64,${audioBuffer.toString('base64')}`

    const metadata: IAudioMetadata = {
      provider: 'openai',
      model: this.ttsConfig.model,
      voice: this.ttsConfig.voice,
      format: this.ttsConfig.format,
      sizeBytes: audioBuffer.length,
      createdAt: new Date().toISOString(),
    }

    return {
      base64Url,
      mimeType,
      metadata,
    }
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const chatItem of chatItems) {
      switch (chatItem.type) {
        case 'humanMessage':
          openIaInput.push(this.mapHumanMessage(chatItem.humanMessage))
          break
        case 'botMessage':
          openIaInput.push(this.mapBotMessage(chatItem.botMessage))
          break
        case 'functionCall':
          openIaInput.push(...this.mapFunctionCall(chatItem.functionCall))
          break
      }
    }
    return openIaInput
  }

  private mapHumanMessage(item: IChatMessage): OpenAI.Responses.ResponseInputItem {
    const content: OpenAI.Responses.ResponseInputContent[] = []
    if (item.text) content.push({ type: 'input_text', text: item.text })
    if (item.images) {
      for (const image of item.images) {
        content.push({
          type: 'input_image',
          image_url: image.publicUrl ?? image.base64Url,
          detail: 'auto',
        })
      }
    }

    if (content.length === 0) {
      throw new Error('humanMessage content is empty')
    }

    return { role: 'user', content } as const
  }

  private mapBotMessage(item: IChatMessage): OpenAI.Responses.ResponseInputItem {
    if (!item.text) {
      throw new Error('botMessage content is empty')
    }
    return { role: 'assistant', content: item.text } as const
  }

  private mapFunctionCall(item: IFunctionCall): OpenAI.Responses.ResponseInputItem[] {
    return [
      {
        type: 'function_call',
        call_id: item.id,
        name: item.name,
        arguments: JSON.stringify(item.arguments),
      },
      {
        type: 'function_call_output',
        call_id: item.id,
        output: item.result ?? 'Not result',
      },
    ] as const
  }

  private mapTool(tool: IMindsetTool): OpenAI.Responses.Tool {
    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce(
          (prev, param) => ({
            ...prev,
            [param.name]: { type: param.type, description: param.description },
          }),
          {},
        ),
        required: tool.parameters.map((param) => param.name),
        additionalProperties: false,
      },
      strict: true,
    } as const
  }

  private mapResponse(response: OpenAI.Responses.Response): IChatAdapterNextItemsRes {
    let usage: ILanguageModelUsage
    if (response.usage) {
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }
    } else {
      throw new Error('Unable to found usage info')
    }

    const nextItems: IChatItem[] = []

    for (const output of response.output) {
      if (output.type === 'message') {
        for (const content of output.content) {
          if (content.type === 'output_text' && content.text) {
            nextItems.push({ type: 'botMessage', botMessage: { text: content.text } })
          }
        }
      } else if (output.type === 'function_call') {
        nextItems.push({
          type: 'functionCall',
          functionCall: {
            id: output.call_id,
            name: output.name,
            arguments: output.arguments,
          },
        })
      }
    }

    return { usage, nextItems }
  }

  private getMimeType(format: AudioResponseFormat): string {
    const mimeMap: Record<AudioResponseFormat, string> = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      wav: 'audio/wav',
      aac: 'audio/aac',
      flac: 'audio/flac',
      pcm: 'audio/pcm',
    }
    return mimeMap[format] ?? 'audio/mpeg'
  }
}
