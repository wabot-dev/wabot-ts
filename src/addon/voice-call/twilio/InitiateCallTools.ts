import { description } from '@/core/description'
import { isNotEmpty, isString } from '@/core/validation'
import { tools } from '@/feature/tool'
import { TwilioCalls } from './TwilioCalls'

export class InitiateCallRequest {
  @isString()
  @isNotEmpty()
  @description('Teléfono del destinatario en formato E.164, con código de país, ej: +573001112233')
  telefono: string = ''

  @isString()
  @isNotEmpty()
  @description('Objetivo o saludo inicial de la llamada, en español')
  objetivo: string = ''
}

/**
 * Mindset tool that lets a bot place an outbound call. Add it to a mindset's
 * `tools`. Dialing is consent-gated, so it fails clearly when the recipient has
 * not opted in.
 */
@tools({ language: 'español' })
export class InitiateCallTools {
  constructor(private calls: TwilioCalls) {}

  @description(
    'Inicia una llamada telefónica saliente al número indicado. Requiere consentimiento previo del destinatario.',
  )
  async iniciarLlamada(req: InitiateCallRequest) {
    const { callId, to } = await this.calls.initiate({ to: req.telefono, greeting: req.objetivo })
    return { callId, to, estado: 'iniciando' }
  }
}
