import type { PoolDegradedEvent, PoolHealthState } from './pool.js'

/**
 * Callbacks the {@link PoolHealthMonitor} depends on to observe the pool and
 * publish health transitions.
 * @internal
 */
export interface PoolHealthMonitorCallbacks {
  readonly minSize: () => number
  readonly publishDegraded: (event: PoolDegradedEvent) => void
  readonly publishDegradedEnd: () => void
  readonly readyWorkerNodeCount: () => number
  readonly started: () => boolean
  readonly tripped: () => boolean
}

/**
 * Tracks the pool health state and publishes transitions between healthy,
 * degraded and unrecoverable. Degraded means the pool is started but has fewer
 * ready worker nodes than its minimum size; unrecoverable means the worker
 * restart circuit breaker tripped and the pool can no longer replace faulted
 * workers. The unrecoverable state latches, mirroring the circuit breaker.
 * @internal
 */
export class PoolHealthMonitor {
  public get state (): PoolHealthState {
    return this.#state
  }

  public get unrecoverable (): boolean {
    return this.#state === 'unrecoverable'
  }

  readonly #callbacks: PoolHealthMonitorCallbacks
  #everReady = false
  #state: PoolHealthState = 'healthy'

  public constructor (callbacks: PoolHealthMonitorCallbacks) {
    this.#callbacks = callbacks
  }

  /**
   * Recomputes the pool health state from the current pool topology and
   * publishes a transition when it changes. No-ops once unrecoverable (latched)
   * and when the recomputed state matches the current one. A pool that has not
   * yet reached its minimum ready worker nodes since the last {@link reset} is
   * not reported as degraded, so a startup ramp does not publish a spurious
   * transition.
   */
  public refresh (): void {
    if (this.#state === 'unrecoverable') {
      return
    }
    const readyWorkerNodeCount = this.#callbacks.readyWorkerNodeCount()
    const minSize = this.#callbacks.minSize()
    if (readyWorkerNodeCount >= minSize) {
      this.#everReady = true
    }
    const next: PoolHealthState = this.#callbacks.tripped()
      ? 'unrecoverable'
      : this.#callbacks.started() &&
          this.#everReady &&
          readyWorkerNodeCount < minSize
        ? 'degraded'
        : 'healthy'
    if (next === this.#state) {
      return
    }
    this.#state = next
    if (next === 'healthy') {
      this.#callbacks.publishDegradedEnd()
    } else {
      this.#callbacks.publishDegraded({
        minSize,
        readyWorkerNodeCount,
        reason:
          next === 'unrecoverable' ? 'circuitBreakerTripped' : 'belowMinimum',
        unrecoverable: next === 'unrecoverable',
      })
    }
  }

  /**
   * Re-arms the monitor for a pool restart: clears the latched state and the
   * startup-ramp mask so a restarted pool is not reported degraded or
   * unrecoverable because of its previous run.
   */
  public reset (): void {
    this.#everReady = false
    this.#state = 'healthy'
  }
}
