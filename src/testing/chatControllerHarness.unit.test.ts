import assert from 'node:assert/strict'
import test from 'node:test'

import { ChatBot, chatBot } from '@/feature/chat-bot'
import { chatController, IReceivedMessage } from '@/feature/chat-controller'
import { IMindset, IMindsetDescription, mindset } from '@/feature/mindset'

import { createChatControllerHarness } from './chatControllerHarness'

@mindset()
class EchoMindset implements IMindset {
  async describe(): Promise<IMindsetDescription> {
    return {
      identity: { name: 'Echo', language: 'english' },
      context: '',
      skills: 'echoing',
      limits: '',
      workflow: '',
    }
  }
  async models() {
    return { llm: [{ model: 'mock-model' }] }
  }
}

@chatController()
class EchoController {
  constructor(@chatBot(EchoMindset) private bot: ChatBot) {}

  async onTestMessage(context: IReceivedMessage) {
    await this.bot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}

test('invokes a controller method end-to-end and captures the replies', async () => {
  const harness = createChatControllerHarness({ controller: EchoController })
  harness.adapter.reply('respuesta del bot')

  const turn = await harness.invoke('onTestMessage', 'hola')

  assert.equal(turn.replies.length, 1)
  assert.equal(turn.replies[0].text, 'respuesta del bot')
  assert.equal(turn.replies[0].senderName, 'Echo')
})

test('keeps the chat memory across invocations (same connection)', async () => {
  const harness = createChatControllerHarness({ controller: EchoController })
  harness.adapter.reply('uno').reply('dos')

  await harness.invoke('onTestMessage', 'primer mensaje')
  await harness.invoke('onTestMessage', 'segundo mensaje')

  const history = await harness.history()
  assert.equal(history.length, 4)
  assert.equal(history[0].humanMessage?.text, 'primer mensaje')
  assert.equal(history[2].humanMessage?.text, 'segundo mensaje')

  const lastRequest = harness.adapter.lastRequest
  assert.ok(lastRequest)
  assert.ok(lastRequest.prevItems.length >= 3, 'the bot should see the previous turns')
})

test('fails clearly when the method does not exist', async () => {
  const harness = createChatControllerHarness({ controller: EchoController })

  await assert.rejects(() => harness.invoke('nope', 'hola'), /has no method 'nope'/)
})
