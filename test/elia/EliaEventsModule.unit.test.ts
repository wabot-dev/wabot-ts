// Ejemplo: testing determinista de un chatbot (mindset + tools) SIN llamadas
// a APIs de LLM ni base de datos.
//
// En una app consumidora estos imports serían:
//   import { ... } from '@wabot-dev/framework'
//   import { ... } from '@wabot-dev/framework/testing'
//
// Correr con: npm run test:elia

import assert from 'node:assert/strict'
import test from 'node:test'

import { container } from '@'
import { createChatBotHarness, useMemoryRepositories } from '@/testing'

import { EliaEventRepository } from './EliaEventRepository'
import { EliaMindset } from './EliaMindset'
import './EliaEventMemoryQueries' // registra la @memExtension (findUpcoming, etc.)

// Respalda EliaEventRepository (@repository) con un store en RAM.
useMemoryRepositories()

test('Elia responde con la identidad del mindset', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })
  harness.adapter.reply('¡Hola! Soy Elia, ¿en qué te ayudo?')

  const turn = await harness.send('hola')

  assert.equal(turn.replies.length, 1)
  assert.equal(turn.replies[0].senderName, 'Elia')
  assert.match(turn.replies[0].text ?? '', /Elia/)
})

test('el loop de tools guarda un evento real en el repositorio', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })

  // Guion del LLM: primero pide la tool, luego confirma con texto.
  // El framework ejecuta saveEvent DE VERDAD (validación + módulo + repo).
  harness.adapter
    .callTool('saveEvent', {
      title: 'Demo con el equipo',
      category: 'trabajo',
      dateTime: '2026-06-15T15:00:00.000Z',
      durationInMinutes: 45,
    })
    .reply('¡Listo! Agendé la demo para el 15 de junio a las 3pm.')

  const turn = await harness.send('agéndame una demo con el equipo el 15 de junio a las 3pm')

  // El turno reporta la tool ejecutada y su resultado
  assert.equal(turn.toolCalls.length, 1)
  assert.equal(turn.toolCalls[0].name, 'saveEvent')
  assert.deepEqual(
    turn.replies.map((r) => r.text),
    ['¡Listo! Agendé la demo para el 15 de junio a las 3pm.'],
  )

  // ...y el efecto es observable en el repositorio real (en RAM)
  const repository = container.resolve(EliaEventRepository)
  const saved = await repository.findByCategory('trabajo')
  assert.equal(saved.length, 1)
  assert.equal(saved[0]['data'].title, 'Demo con el equipo')
})

test('callTool prueba una tool individual sin armar conversación', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })
  const repository = container.resolve(EliaEventRepository)

  await harness.callTool('saveEvent', {
    title: 'Cita médica',
    category: 'salud',
    dateTime: '2026-07-01T09:00:00.000Z',
    durationInMinutes: 30,
  })

  const result = await harness.callTool('readEventsByCategory', { category: 'salud' })
  assert.match(result, /Cita médica/)

  const upcoming = await harness.callTool('readUpcomingEvents', { limit: 5 })
  assert.match(upcoming, /Cita médica/)

  assert.equal((await repository.findByCategory('salud')).length, 1)
})

test('argumentos inválidos devuelven INVALID_ARGUMENTS al LLM (no excepción)', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })

  // durationInMinutes viola @max(240) y falta el título
  const result = await harness.callTool('saveEvent', {
    category: 'trabajo',
    dateTime: '2026-06-15T15:00:00.000Z',
    durationInMinutes: 999,
  })

  assert.match(result, /INVALID_ARGUMENTS/)
  assert.match(result, /durationInMinutes/)
})

test('snapshot del system prompt y las tools que ve el modelo', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })

  const prompt = await harness.systemPrompt()
  assert.match(prompt, /Elia/)
  assert.match(prompt, /organizando tareas/)

  const toolNames = harness.tools().map((tool) => tool.name)
  assert.deepEqual(toolNames.sort(), ['readEventsByCategory', 'readUpcomingEvents', 'saveEvent'])
})

test('el adapter graba lo que el bot envía al modelo', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })
  harness.adapter.reply('ok')

  await harness.send('hola')

  const req = harness.adapter.lastRequest
  assert.ok(req)
  assert.equal(req.models[0].provider, 'anthropic') // primer candidato del mindset
  assert.equal(req.tools.length, 3)
  assert.equal(req.prevItems.at(-1)?.humanMessage?.text, 'hola')
})
