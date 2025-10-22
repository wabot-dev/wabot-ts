import { Env } from '@/core/env'
import { CustomError } from '@/core/error'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from '@/feature/chat-bot'

@singleton()
export class WabotChatAdapter implements IChatAdapter {
  private apiKey: string
  private baseUrl: string
  private logger = new Logger('wabot:wabot-chat-adapter')

  constructor(env: Env) {
    this.apiKey = env.requireString('WABOT_API_KEY')
    this.baseUrl = env.requireString('WABOT_LLM_URL')
    while (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.substring(0, this.baseUrl.length - 1)
    }
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    const response = await fetch(this.baseUrl + '/chat-bot/next-item', {
      method: 'post',
      headers: {
        Authorization: `Api-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new CustomError({
        message: (data?.error && JSON.stringify(data.error)) ?? 'error calling wabot llm api',
      })
    }

    return data
  }
}
