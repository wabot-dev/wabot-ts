import { mindsetModule } from '@/mindset'

@mindsetModule({
  description: `
    Devuelve los próximos eventos de la persona
    que le está hablando a Elia.
  `,
})
export class EliaGetUpcomingEvents {
  async execute() {
    return 'EliaGetUpcomingEvents'
  }
}
