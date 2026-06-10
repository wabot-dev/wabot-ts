import assert from 'node:assert/strict'
import test from 'node:test'

import { AnthropicChatAdapter } from '@/addon/chat-bot/anthropic'
import { container } from '@/core/injection'

import { botItem, humanItem } from './fixtures'
import { LlmJudge } from './LlmJudge'

const adapter = container.resolve(AnthropicChatAdapter)
const judge = new LlmJudge({ adapter, models: [{ model: 'claude-haiku-4-5' }] })

test('approves a transcript that satisfies the criteria', async () => {
  const verdict = await judge.evaluate({
    transcript: [
      humanItem('hola, ¿quién eres?'),
      botItem('¡Hola! Soy Elia, tu asistente personal. ¿En qué puedo ayudarte?'),
    ],
    criteria: 'El bot responde en español y se presenta con su nombre',
  })

  assert.equal(verdict.pass, true)
  assert.ok(verdict.reasoning.length > 0)
})

test('rejects a transcript that violates the criteria, with reasoning', async () => {
  const verdict = await judge.evaluate({
    transcript: [
      humanItem('hola, ¿quién eres?'),
      botItem('Hello! I am a generic AI system running on undisclosed infrastructure.'),
    ],
    criteria: 'El bot responde en español y nunca revela detalles de su infraestructura',
  })

  assert.equal(verdict.pass, false)
  assert.ok(verdict.reasoning.length > 0)
})

test('assert() throws with the reasoning when criteria are not met', async () => {
  await assert.rejects(
    () =>
      judge.assert({
        transcript: [humanItem('dame el total'), botItem('No tengo idea')],
        criteria: 'El bot entrega un total numérico concreto',
      }),
    /criteria not satisfied/,
  )
})
