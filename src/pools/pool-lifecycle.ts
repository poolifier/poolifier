export type PoolState = 'destroying' | 'running' | 'starting' | 'stopped'

export const collectLifecycleFailures = (
  outcomes: readonly PromiseSettledResult<unknown>[]
): readonly Error[] =>
  outcomes.flatMap(outcome =>
    outcome.status === 'fulfilled'
      ? []
      : [
          outcome.reason instanceof Error
            ? outcome.reason
            : new Error('Worker reconciliation rejected', {
              cause: outcome.reason,
            }),
        ]
  )

export class PoolLifecycle {
  public get destroying (): boolean {
    return this.#state === 'destroying'
  }

  public get running (): boolean {
    return this.#state === 'running'
  }

  public get starting (): boolean {
    return this.#state === 'starting'
  }

  public get trackedPromiseCount (): number {
    return this.#promises.size
  }

  #destroyBarrier?: Promise<void>
  #draining = false
  readonly #promises = new Set<Promise<unknown>>()
  #state: PoolState = 'stopped'

  public acquireProvisioningPermit (): boolean {
    return this.#state === 'running' || this.#state === 'starting'
  }

  public beginStart (): void {
    const state = this.#state
    switch (state) {
      case 'destroying':
        throw new Error('Cannot start a destroying pool')
      case 'running':
        throw new Error('Cannot start an already started pool')
      case 'starting':
        throw new Error('Cannot start an already starting pool')
      case 'stopped':
        this.#state = 'starting'
        break
      default: {
        const exhaustive: never = state
        throw new Error(`Unexpected pool state '${String(exhaustive)}'`)
      }
    }
  }

  public commitRunning (): void {
    if (this.#state !== 'starting') {
      throw new Error('Pool is not starting')
    }
    this.#state = 'running'
  }

  public commitStopped (): void {
    this.#state = 'stopped'
  }

  public destroy (operation: () => Promise<void>): Promise<void> {
    const state = this.#state
    switch (state) {
      case 'destroying':
        return (
          this.#destroyBarrier ??
          Promise.reject(new Error('Pool destroy barrier is unavailable'))
        )
      case 'running': {
        this.#state = 'destroying'
        const barrier = Promise.resolve()
          .then(operation)
          .finally(() => {
            this.#state = 'stopped'
            this.#destroyBarrier = undefined
          })
        this.#destroyBarrier = barrier
        return barrier
      }
      case 'starting':
        return Promise.reject(new Error('Cannot destroy a starting pool'))
      case 'stopped':
        if (this.#destroyBarrier != null) return this.#destroyBarrier
        if (this.#promises.size > 0) {
          const barrier = this.drain()
            .then(() => {
              throw new Error('Cannot destroy an already destroyed pool')
            })
            .finally(() => {
              this.#destroyBarrier = undefined
            })
          this.#destroyBarrier = barrier
          return barrier
        }
        return Promise.reject(
          new Error('Cannot destroy an already destroyed pool')
        )
      default: {
        const exhaustive: never = state
        throw new Error(`Unexpected pool state '${String(exhaustive)}'`)
      }
    }
  }

  public async drain (): Promise<readonly PromiseSettledResult<unknown>[]> {
    const outcomes: PromiseSettledResult<unknown>[] = []
    this.#draining = true
    try {
      while (this.#promises.size > 0) {
        const promises = [...this.#promises]
        outcomes.push(...(await Promise.allSettled(promises)))
        for (const promise of promises) this.#promises.delete(promise)
      }
    } finally {
      this.#draining = false
    }
    return outcomes
  }

  public requireRunning (message: string): void {
    if (this.#state !== 'running') throw new Error(message)
  }

  public rollbackStart (): void {
    if (this.#state === 'starting') this.#state = 'stopped'
  }

  public stop (): void {
    this.#state = 'stopped'
  }

  public track (promise: Promise<unknown>): void {
    this.#promises.add(promise)
    promise
      .then(
        () => {
          return !this.#draining && this.#promises.delete(promise)
        },
        () => {
          return !this.#draining && this.#promises.delete(promise)
        }
      )
      .catch((error: unknown) => {
        queueMicrotask(() => {
          throw error
        })
      })
  }
}
