import type { Container } from '@/core/injection'
import type { IToolSchema } from '@/feature/tool'
// Type-only: erased at compile time, so no runtime cycle mindset -> agent.
import type { IMindsetAgentBinding } from '@/feature/agent/MindsetAgentToolset'

/** A mindset's agents exposed as callable tools (schema + dispatch). */
export interface IMindsetAgentTools {
  schema(): IToolSchema[]
  has(name: string): boolean
  call(name: string, params: string): Promise<string>
}

/**
 * Builds {@link IMindsetAgentTools} for a mindset's `agents` bindings. The agent
 * feature registers the implementation under {@link MINDSET_AGENT_TOOLS_PROVIDER};
 * the mindset feature resolves it through the DI token so it never has to import
 * the agent feature (which would close a module cycle).
 */
export interface IMindsetAgentToolsProvider {
  create(
    bindings: IMindsetAgentBinding[],
    container: Container,
    reservedNames: Set<string>,
  ): IMindsetAgentTools
}

/** DI token the agent feature registers its provider under. */
export const MINDSET_AGENT_TOOLS_PROVIDER = 'wabot:mindset-agent-tools-provider'
