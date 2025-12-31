import { Lock, LockKey } from "@/core/lock";



export interface LeaderElectorOptions {
  retryIntervalMs?: number;
  onRevoked?: () => void;
}

export class LeaderElector {
  private stopped = false;
  private isLeader = false;

  constructor(
    private readonly lock: Lock,
    private readonly leaderKey: LockKey,
    private readonly options: LeaderElectorOptions = {}
  ) {}

  /** Start leader election loop */
  start(onElected: () => void) {
    this.stopped = false;
    this.loop(onElected);
  }

  /** Stop leader election loop */
  stop() {
    this.stopped = true;
  }

  /** Returns true if this instance currently holds leadership */
  getLeaderStatus(): boolean {
    return this.isLeader;
  }

  /** Main election loop */
  private async loop(onElected: () => void) {
    const retryInterval = this.options.retryIntervalMs ?? 5000;

    while (!this.stopped) {
      try {
        // Blocking call: acquire leadership
        await this.lock.withKey(this.leaderKey, async () => {
          this.isLeader = true;
          console.log("Leadership acquired");

          // Run the leader task independently (async or sync)
          try {
            onElected();
          } catch (err) {
            console.error("Error in leader task:", err);
          }

          // The lock is released automatically when this block ends
          // Leadership is lost exactly here, independent of the leader task
          this.isLeader = false;
          console.log("Leadership lost");
          this.options.onRevoked?.();
        });
      } catch (err) {
        console.error("LeaderElector error:", err);
      }

      if (!this.stopped) {
        await new Promise((res) => setTimeout(res, retryInterval));
      }
    }
  }
}
