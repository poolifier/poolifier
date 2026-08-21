import type { LifecycleWorker } from './lifecycle-types.js'

import { WORKER_TERMINATION_GRACE_MS } from './worker-termination.js'

export interface WorkerTransportDrain {
  readonly waitForTransportDrain: () => Promise<void>
}

type DrainEvent = 'close' | 'disconnect'
type DrainSource = Readonly<{
  once: (event: DrainEvent, listener: () => void) => unknown
}>

export class WorkerTransportDrainBarrier {
  readonly #drained: Promise<void>
  #resolveDrain?: () => void

  public constructor (source: DrainSource, event: DrainEvent) {
    this.#drained = new Promise(resolve => {
      this.#resolveDrain = resolve
    })
    source.once(event, this.#markDrained)
  }

  public async wait (): Promise<void> {
    let timeout: NodeJS.Timeout | undefined
    const observationExpired = new Promise<void>(resolve => {
      timeout = setTimeout(resolve, WORKER_TERMINATION_GRACE_MS)
    })
    try {
      await Promise.race([this.#drained, observationExpired])
    } finally {
      if (timeout != null) clearTimeout(timeout)
    }
  }

  readonly #markDrained = (): void => {
    this.#resolveDrain?.()
    this.#resolveDrain = undefined
  }
}

/**
 * Waits for the worker's transport to drain, if the worker supports it.
 * @param worker - Worker to drain.
 */
export async function waitForWorkerTransportDrain (
  worker: LifecycleWorker
): Promise<void> {
  if (hasWorkerTransportDrain(worker)) {
    await worker.waitForTransportDrain()
  }
}

/**
 * Whether the worker exposes the transport drain capability.
 * @param worker - Worker to inspect.
 * @returns `true` when the worker can wait for transport drain.
 */
function hasWorkerTransportDrain (
  worker: LifecycleWorker
): worker is LifecycleWorker & WorkerTransportDrain {
  return (
    'waitForTransportDrain' in worker &&
    typeof worker.waitForTransportDrain === 'function'
  )
}
