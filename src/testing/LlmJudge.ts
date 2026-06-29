import { IChatAdapter, IChatItem, IChatItemData } from '@/feature/chat-bot'
import { IMindsetModelRef, IMindsetTool } from '@/feature/mindset'

export interface ILlmJudgeOptions {
  adapter: IChatAdapter
  models: IMindsetModelRef[]
}

export interface ILlmJudgeEvaluateReq {
  /** Chat items (e.g. harness.history()) or a pre-rendered transcript. */
  transcript: (IChatItem | IChatItemData)[] | string
  /** What must hold for the evaluation to pass, in natural language. */
  criteria: string
}

export interface ILlmJudgeVerdict {
  pass: boolean
  reasoning: string
}

const VERDICT_TOOL: IMindsetTool = {
  language: 'english',
  name: 'submitVerdict',
  description:
    'Submit your evaluation verdict. You MUST always call this tool exactly once; never answer with plain text.',
  parameters: [
    {
      name: 'pass',
      required: true,
      schema: { type: 'boolean', description: 'true if the transcript satisfies the criteria' },
    },
    {
      name: 'reasoning',
      required: true,
      schema: { type: 'string', description: 'short explanation of the verdict' },
    },
  ],
}

const JUDGE_SYSTEM_PROMPT = `
You are a strict QA judge for chatbot conversations.
You will receive a chat transcript and evaluation criteria.
Evaluate whether the transcript satisfies ALL the criteria.
You MUST report your verdict by calling the submitVerdict tool exactly once.
Never reply with plain text.
`

export function renderTranscript(items: (IChatItem | IChatItemData)[]): string {
  return items
    .map((item) => {
      if (item.type === 'humanMessage') {
        const msg = item.humanMessage
        const parts = [
          msg.text,
          msg.images?.length ? `[${msg.images.length} image(s)]` : undefined,
          msg.documents?.length ? `[${msg.documents.length} document(s)]` : undefined,
          msg.object ? JSON.stringify(msg.object) : undefined,
        ].filter(Boolean)
        return `HUMAN: ${parts.join(' ')}`
      }
      if (item.type === 'botMessage') {
        return `BOT: ${item.botMessage.text ?? JSON.stringify(item.botMessage)}`
      }
      const call = item.functionCall
      return `TOOL CALL: ${call.name}(${call.arguments ?? '{}'}) -> ${call.result ?? '(no result)'}`
    })
    .join('\n')
}

/**
 * Grades chatbot behavior with a real LLM. Provider-agnostic: the verdict is
 * extracted through a forced tool call instead of parsing free-form text.
 */
export class LlmJudge {
  constructor(private options: ILlmJudgeOptions) {}

  async evaluate(req: ILlmJudgeEvaluateReq): Promise<ILlmJudgeVerdict> {
    const transcript =
      typeof req.transcript === 'string' ? req.transcript : renderTranscript(req.transcript)

    const { nextItems } = await this.options.adapter.nextItems({
      models: this.options.models,
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      tools: [VERDICT_TOOL],
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: `## Criteria\n${req.criteria}\n\n## Transcript\n${transcript}\n\nEvaluate now and call submitVerdict.`,
          },
        },
      ],
    })

    const verdictCall = nextItems.find(
      (item) => item.type === 'functionCall' && item.functionCall.name === VERDICT_TOOL.name,
    )
    if (!verdictCall || verdictCall.type !== 'functionCall') {
      const texts = nextItems
        .map((item) => (item.type === 'botMessage' ? item.botMessage.text : null))
        .filter(Boolean)
      throw new Error(
        `LlmJudge: the judge model did not call submitVerdict. Got: ${texts.join(' | ') || JSON.stringify(nextItems)}`,
      )
    }

    const args = JSON.parse(verdictCall.functionCall.arguments ?? '{}')
    if (typeof args.pass !== 'boolean') {
      throw new Error(`LlmJudge: invalid verdict arguments: ${verdictCall.functionCall.arguments}`)
    }
    return { pass: args.pass, reasoning: String(args.reasoning ?? '') }
  }

  /** Like evaluate(), but throws (with the judge's reasoning) when it fails. */
  async assert(req: ILlmJudgeEvaluateReq): Promise<ILlmJudgeVerdict> {
    const verdict = await this.evaluate(req)
    if (!verdict.pass) {
      throw new Error(`LlmJudge: criteria not satisfied: ${req.criteria}\n${verdict.reasoning}`)
    }
    return verdict
  }
}
