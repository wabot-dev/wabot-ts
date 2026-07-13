import { uiController, view } from '@/ui'
import { MonitorAuthMiddleware } from './MonitorAuthMiddleware'
import { ChatBrowserRepository, THREAD_LIMIT } from './ChatBrowserRepository'
import { ChatIdParam, ListChatsQuery } from './QueryDto'
import { ChatDetailPage, ChatListPage } from './ui/chat'
import { limitOf, pageOf } from './ui/format'

/**
 * Chat browser + debugger under `/monitor`: lists conversations (filter by
 * channel/type/search, paginated) and renders a chat's message thread with
 * collapsible function calls. SSR, no client JS; auth via MonitorAuthMiddleware.
 * Shares the `/monitor` base path with MonitorController (disjoint sub-paths).
 */
@uiController({ path: '/monitor', middlewares: [MonitorAuthMiddleware], head: { preconnect: ['https://design.wabot.dev'] } })
export class ChatBrowserController {
  constructor(private browser: ChatBrowserRepository) {}

  @view({ path: 'chats', title: 'Chats · Monitor' })
  async list(input: ListChatsQuery) {
    const page = pageOf(input.page)
    const pageSize = limitOf(input.limit)
    const f = { channel: input.channel, type: input.type, search: input.q }
    const [rows, total] = await Promise.all([
      this.browser.listChats({ ...f, limit: pageSize, offset: (page - 1) * pageSize }),
      this.browser.countChats(f),
    ])
    return <ChatListPage rows={rows} total={total} page={page} pageSize={pageSize} query={input} />
  }

  @view({ path: 'chats/:id', title: 'Chat · Monitor' })
  async detail(input: ChatIdParam) {
    const id = input.id!
    const [header, items] = await Promise.all([
      this.browser.chatHeader(id),
      this.browser.chatThread(id),
    ])
    return <ChatDetailPage header={header} items={items} truncated={items.length >= THREAD_LIMIT} />
  }
}
