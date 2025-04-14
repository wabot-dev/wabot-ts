import { mindsetFunction } from "@/mindset";

@mindsetFunction({
  description: `
    Devuelve los próximos eventos de la persona
    que le está hablando a Elia.
  `,
})
export class EliaGetUpcomingEvents {

  async execute() {
    return "EliaGetUpcomingEvents";
  }
}
