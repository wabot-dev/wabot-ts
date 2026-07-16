import test from 'node:test'
import assert from 'node:assert/strict'
import { InitiateCallRequest, InitiateCallTools } from './InitiateCallTools'
import { TwilioCalls } from './TwilioCalls'

test('InitiateCallTools.iniciarLlamada delegates to the call service', async () => {
  const calls: { to: string; greeting?: string }[] = []
  const tool = new InitiateCallTools({
    initiate: async (req: { to: string; greeting?: string }) => {
      calls.push(req)
      return { callId: 'CA1', to: '+573001112233' }
    },
  } as unknown as TwilioCalls)

  const req = new InitiateCallRequest()
  req.telefono = '+573001112233'
  req.objetivo = 'Recordar la cita de mañana'
  const result = await tool.iniciarLlamada(req)

  assert.deepEqual(calls, [{ to: '+573001112233', greeting: 'Recordar la cita de mañana' }])
  assert.deepEqual(result, { callId: 'CA1', to: '+573001112233', estado: 'iniciando' })
})
