import { IMindsetModels } from '@/feature/mindset'

/**
 * A dev-facing agent. Unlike a mindset (which describes an end-user chatbot's
 * persona), an agent is driven programmatically: you set its context, ask it
 * structured questions and give it orders. Implement this interface and
 * register the class with `@agent`.
 */
export interface IAgent {
  /** The agent's base instructions / system context. */
  instructions(): Promise<string>
  /** Models the agent may use, by kind. Reuses the mindset model contract. */
  models(): Promise<IMindsetModels>
}

/** DI token + throw-everything base, mirroring {@link Mindset}. */
export class Agent implements IAgent {
  instructions(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  models(): Promise<IMindsetModels> {
    throw new Error('Method not implemented.')
  }
}
