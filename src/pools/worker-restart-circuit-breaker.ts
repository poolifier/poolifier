/**
 * Sliding-window circuit breaker bounding faulted worker replacements.
 * Pool-wide because a replaced worker is a new node, so per-worker counters
 * would reset every replacement and never detect a crash loop. Once tripped it
 * latches, mirroring an Erlang/OTP supervisor exceeding its restart intensity.
 * @internal
 */
export class WorkerRestartCircuitBreaker {
  public get tripped (): boolean {
    return this.#tripped
  }

  readonly #maxRestarts: number
  readonly #timestamps: number[] = []
  #tripped = false
  readonly #windowTime: number

  public constructor (
    maxRestarts = Number.POSITIVE_INFINITY,
    windowTime = 60_000
  ) {
    this.#maxRestarts = maxRestarts
    this.#windowTime = windowTime
  }

  /**
   * Records a faulted worker replacement attempt and reports whether it is
   * permitted. Trips (and denies) once more than `maxRestarts` replacements
   * occur within the trailing `windowTime`.
   * @param now - Monotonic timestamp of the attempt.
   * @returns Whether the replacement is permitted.
   */
  public attemptRestart (now = performance.now()): boolean {
    if (this.#tripped) {
      return false
    }
    if (!Number.isFinite(this.#maxRestarts)) {
      return true
    }
    while (
      this.#timestamps.length > 0 &&
      now - this.#timestamps[0] > this.#windowTime
    ) {
      this.#timestamps.shift()
    }
    this.#timestamps.push(now)
    if (this.#timestamps.length > this.#maxRestarts) {
      this.#tripped = true
      return false
    }
    return true
  }

  /**
   * Re-arms the breaker for a pool restart, clearing the latch and the recorded
   * attempts so a restarted pool starts from a clean crash-loop window.
   */
  public reset (): void {
    this.#timestamps.length = 0
    this.#tripped = false
  }
}
