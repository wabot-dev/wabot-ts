import { CustomError } from '@/core/error'
import { ILanguageModelUsage } from '@/feature/chat-bot'
import { description } from '@/core/description'
import { isBoolean } from '@/core/validation'

/** Name of the synthetic tool used to collect a structured answer. */
export const ANSWER_TOOL_NAME = '__wabot_final_answer'

export type AgentStopReason = 'budget' | 'maxSteps'

/**
 * The outcome of a single agent turn (`ask` / `order`).
 *
 * - `answer`   — the agent produced a (typed, when a schema was given) result.
 * - `question` — the agent replied with free text instead of the requested
 *                structured answer, e.g. it needs clarification back from you.
 * - `stopped`  — the turn hit a budget / step limit before finishing.
 */
export type AgentReply<T = string> =
  | { type: 'answer'; value: T; text: string; usage: ILanguageModelUsage }
  | { type: 'question'; text: string; usage: ILanguageModelUsage }
  | { type: 'stopped'; reason: AgentStopReason; text: string; usage: ILanguageModelUsage }

export type AgentPausedReply = Extract<AgentReply<any>, { type: 'question' | 'stopped' }>

/**
 * Thrown by the happy-path helpers (`ask`, `confirm`) when the agent did not
 * return an answer — it asked a clarifying question or hit a limit. Use
 * `order()` to receive the {@link AgentReply} union instead of catching this.
 */
export class AgentPausedError extends CustomError {
  constructor(public readonly reply: AgentPausedReply) {
    super({
      httpCode: 409,
      code: reply.type === 'question' ? 'AGENT_ASKED_QUESTION' : 'AGENT_STOPPED',
      message:
        reply.type === 'question'
          ? reply.text || 'The agent replied with a question instead of an answer.'
          : `The agent stopped before answering (${reply.reason}).`,
      info: { reply },
    })
  }
}

/** Internal response schema backing {@link AgentSession.confirm}. */
export class AgentBooleanAnswer {
  @description('The boolean answer to the question: true or false.')
  @isBoolean()
  value: boolean = false
}
