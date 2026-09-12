import type {
  LifecycleWorker,
  WorkerLifecycleCallbacks,
  WorkerReconciliationContext,
  WorkerReconciliationPreparation,
  WorkerReconciliationResult,
} from './lifecycle-types.js'

import {
  WorkerReconciliationError,
  type WorkerReconciliationFailure,
  type WorkerReconciliationStage,
  WorkerReconciliationTimeoutError,
} from './worker-reconciliation-error.js'

const PREPARATION_TIMEOUT_OVERHEAD_MS = 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647

const isPreparation = (
  value: unknown
): value is WorkerReconciliationPreparation =>
  typeof value === 'object' &&
  value != null &&
  'prepare' in value &&
  typeof value.prepare === 'function' &&
  'restore' in value &&
  typeof value.restore === 'function' &&
  'finalizeResidual' in value &&
  typeof value.finalizeResidual === 'function'

export class WorkerReconciler<
  Worker extends LifecycleWorker = LifecycleWorker
> {
  readonly #callbacks: WorkerLifecycleCallbacks<Worker>
  readonly #phaseTimeoutMs: number

  public constructor (
    callbacks: WorkerLifecycleCallbacks<Worker>,
    phaseTimeoutMs = 30_000
  ) {
    this.#callbacks = callbacks
    this.#phaseTimeoutMs = phaseTimeoutMs
  }

  public async reconcile (
    input: WorkerReconciliationContext<Worker>
  ): Promise<WorkerReconciliationResult> {
    const failures: WorkerReconciliationFailure[] = []
    const capture = async <Value>(
      stage: WorkerReconciliationStage,
      operation: (signal: AbortSignal) => Promise<Value> | Value,
      timeoutMs: null | number = this.#phaseTimeoutMs
    ): Promise<undefined | Value> => {
      let timeout: NodeJS.Timeout | undefined
      const controller = new AbortController()
      try {
        const operationPromise = Promise.resolve().then(() =>
          operation(controller.signal)
        )
        operationPromise.catch(() => undefined)
        if (timeoutMs == null) return await operationPromise
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            const error = new WorkerReconciliationTimeoutError(stage, timeoutMs)
            controller.abort(error)
            reject(error)
          }, timeoutMs)
        })
        return await Promise.race([operationPromise, timeoutPromise])
      } catch (error) {
        // no-excuse-ok: catch -- every phase must run before aggregate failure
        failures.push({ error, stage })
      } finally {
        if (timeout != null) clearTimeout(timeout)
      }
    }

    if (input.command.excluded === true) {
      if (input.command.exclusionError != null) {
        failures.push({ error: input.command.exclusionError, stage: 'exclude' })
      }
    } else {
      await capture('exclude', signal =>
        this.#callbacks.exclude(input.command.handle, signal)
      )
    }
    const preparation = await capture('prepare', signal =>
      this.#callbacks.reconcile(input.baseTransition, signal)
    )
    const preparationTimeoutMs =
      isPreparation(preparation) && preparation.prepareTimeoutMs != null
        ? preparation.prepareTimeoutMs >
          MAX_TIMER_DELAY_MS - PREPARATION_TIMEOUT_OVERHEAD_MS
          ? null
          : Math.max(
            this.#phaseTimeoutMs,
            preparation.prepareTimeoutMs + PREPARATION_TIMEOUT_OVERHEAD_MS
          )
        : this.#phaseTimeoutMs
    const reconciliationValue = isPreparation(preparation)
      ? await capture(
        'prepare',
        signal => preparation.prepare(signal),
        preparationTimeoutMs
      )
      : preparation
    await capture('remove', signal =>
      this.#callbacks.remove(input.command.handle, signal)
    )
    await capture('terminate', signal =>
      this.#callbacks.terminate(input.baseTransition, signal)
    )
    const transition = input.transition()
    await capture('complete', signal =>
      this.#callbacks.complete({ reconciliationValue, transition }, signal)
    )
    const running = await capture('isPoolRunning', signal =>
      this.#callbacks.isPoolRunning(signal)
    )
    const replacement = {
      classification: transition.classification,
      handle: input.command.handle,
    }
    const shouldReplace =
      input.command.allowReplacement && running === true
        ? await capture('shouldReplace', signal =>
          this.#callbacks.shouldReplace(replacement, signal)
        )
        : false
    if (shouldReplace === true) {
      await capture('replace', signal =>
        this.#callbacks.replace(replacement, signal)
      )
    }
    if (isPreparation(preparation)) {
      await capture('restore', signal => preparation.restore(signal))
    }
    await capture('drain', signal =>
      this.#callbacks.drain(input.command.handle, signal)
    )
    if (isPreparation(preparation)) {
      await capture('finalizeResidual', signal =>
        preparation.finalizeResidual(signal)
      )
    }
    await capture('finalize', input.finalize)
    if (failures.length > 0) throw new WorkerReconciliationError(failures)
    return Object.freeze({
      cause: transition.cause,
      classification: transition.classification,
      committed: true,
      ...(transition.exit != null && { exit: transition.exit }),
      lease: input.command.handle.lease,
    })
  }
}
