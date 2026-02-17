import { singleton } from '@/core/injection'

export type OperationalMode = 'plan' | 'build' | 'run'

@singleton()
export class OperationalModeStore {
  private mode: OperationalMode = 'plan'
  private lastUpdated: number = Date.now()

  setMode(mode: OperationalMode): void {
    this.mode = mode
    this.lastUpdated = Date.now()
  }

  getMode(): OperationalMode {
    return this.mode
  }

  getLastUpdated(): number {
    return this.lastUpdated
  }
}
