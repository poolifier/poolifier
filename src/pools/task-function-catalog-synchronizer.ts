import { randomUUID } from 'node:crypto'

import type { WorkerHandle } from './lifecycle-types.js'
import type {
  TaskFunctionCatalogEntry,
  TaskFunctionCatalogSnapshot,
} from './task-function-catalog.js'
import type { TaskFunctionTransactionRequest } from './task-function-transaction-types.js'

import { TaskFunctionTransactionError } from './task-function-transaction-types.js'

const REPLAY_TIMEOUT = 30_000

export interface TaskFunctionCatalogSynchronizationCallbacks<
  Worker,
  Data,
  Response
> {
  readonly initialDefaultName: () => string
  readonly operationId?: () => string
  readonly quarantine: (handle: WorkerHandle<Worker>, cause: unknown) => void
  readonly send: (
    handle: WorkerHandle<Worker>,
    request: TaskFunctionTransactionRequest<Data, Response>,
    signal: AbortSignal
  ) => Promise<boolean>
  readonly snapshot: () => TaskFunctionCatalogSnapshot<Data, Response>
}

export class TaskFunctionCatalogSynchronizer<Worker, Data, Response> {
  public constructor (
    private readonly callbacks: TaskFunctionCatalogSynchronizationCallbacks<
      Worker,
      Data,
      Response
    >
  ) {}

  public async synchronize (handle: WorkerHandle<Worker>): Promise<number> {
    let applied: TaskFunctionCatalogSnapshot<Data, Response> = Object.freeze({
      defaultName: this.callbacks.initialDefaultName(),
      entries: Object.freeze([]),
      revision: 0,
    })
    for (;;) {
      const target = this.callbacks.snapshot()
      for (const request of this.#delta(applied, target)) {
        await this.#send(handle, request)
      }
      applied = target
      if (this.callbacks.snapshot().revision === target.revision) {
        return target.revision
      }
    }
  }

  #changed (
    applied: TaskFunctionCatalogEntry<Data, Response> | undefined,
    target: TaskFunctionCatalogEntry<Data, Response>
  ): boolean {
    return applied?.taskFunction !== target.taskFunction
  }

  #delta (
    applied: TaskFunctionCatalogSnapshot<Data, Response>,
    target: TaskFunctionCatalogSnapshot<Data, Response>
  ): readonly Omit<
    TaskFunctionTransactionRequest<Data, Response>,
    'operationId'
  >[] {
    const targetEntries = new Map(
      target.entries.map(entry => [entry.name, entry])
    )
    const appliedEntries = new Map(
      applied.entries.map(entry => [entry.name, entry])
    )
    const removals = applied.entries
      .filter(entry => !targetEntries.has(entry.name))
      .map(entry => ({ name: entry.name, operation: 'remove' as const }))
    const additions = target.entries
      .filter(entry => this.#changed(appliedEntries.get(entry.name), entry))
      .map(entry => ({
        name: entry.name,
        operation: 'add' as const,
        taskFunction: entry.taskFunction,
      }))
    const defaultOperation =
      target.defaultName !== applied.defaultName
        ? [{ name: target.defaultName, operation: 'default' as const }]
        : []
    return [...removals, ...additions, ...defaultOperation]
  }

  async #send (
    handle: WorkerHandle<Worker>,
    request: Omit<TaskFunctionTransactionRequest<Data, Response>, 'operationId'>
  ): Promise<void> {
    const operationId = this.callbacks.operationId?.() ?? randomUUID()
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort(
        new Error(`Task function replay ${request.operation} timed out`)
      )
    }, REPLAY_TIMEOUT)
    try {
      const acknowledged = await this.callbacks.send(
        handle,
        { ...request, operationId },
        controller.signal
      )
      if (!acknowledged) {
        throw new Error('Worker rejected task function replay operation')
      }
    } catch (cause) {
      this.callbacks.quarantine(handle, cause)
      throw new TaskFunctionTransactionError(operationId, [
        { cause, lease: handle.lease, phase: 'replay' },
      ])
    } finally {
      clearTimeout(timeout)
    }
  }
}
