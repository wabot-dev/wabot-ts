// Ejemplo: testing end-to-end de un @chatController sin canal real
// (ni WhatsApp ni cmd): el harness usa el mismo code path de producción
// para resolver el Chat, inyectar el @chatBot y entregar el mensaje.
//
// Correr con: npm run test:elia

import assert from 'node:assert/strict'
import test from 'node:test'

import { createChatControllerHarness, useMemoryRepositories } from '@/testing'

import { EliaChatController } from './EliaChatController'
import './EliaEventMemoryQueries'

useMemoryRepositories()

test('onCmdMessage responde a través del reply del canal', async () => {
  const harness = createChatControllerHarness({ controller: EliaChatController })
  harness.adapter.reply('¡Hola! ¿Qué agendamos hoy?')

  const turn = await harness.invoke('onCmdMessage', 'hola elia')

  assert.equal(turn.replies.length, 1)
  assert.equal(turn.replies[0].text, '¡Hola! ¿Qué agendamos hoy?')
  assert.equal(turn.replies[0].senderName, 'Elia')
})

test('la memoria del chat persiste entre mensajes de la misma conexión', async () => {
  const harness = createChatControllerHarness({ controller: EliaChatController })
  harness.adapter.reply('Anotado: te gusta el café').reply('Claro, ¡con café!')

  await harness.invoke('onCmdMessage', 'me gusta el café')
  await harness.invoke('onCmdMessage', '¿recuerdas qué me gusta?')

  // El segundo request al LLM incluye los turnos anteriores
  const lastRequest = harness.adapter.lastRequest
  assert.ok(lastRequest)
  const transcript = JSON.stringify(lastRequest.prevItems)
  assert.match(transcript, /me gusta el café/)

  const history = await harness.history()
  assert.equal(history.length, 4) // humano, bot, humano, bot
})

test('un flujo con tool a través del controller', async () => {
  const harness = createChatControllerHarness({ controller: EliaChatController })
  harness.adapter
    .callTool('saveEvent', {
      title: 'Llamada con cliente',
      category: 'trabajo',
      dateTime: '2026-06-20T10:00:00.000Z',
      durationInMinutes: 30,
    })
    .reply('Agendada la llamada para el 20 de junio.')

  const turn = await harness.invoke('onCmdMessage', 'agenda una llamada con el cliente')

  assert.equal(turn.toolCalls.length, 1)
  assert.equal(turn.toolCalls[0].name, 'saveEvent')
  assert.match(turn.replies[0].text ?? '', /20 de junio/)
})
