import { randomUUID } from 'node:crypto'

import type { TaskFunctionObject } from '../worker/task-functions.js'
import type { WorkerHandle } from './lifecycle-types.js'
import type { TaskFunctionCatalogSnapshot } from './task-function-catalog.js'
import type {
  TaskFunctionTransactionCallbacks,
  TaskFunctionTransactionFailure,
  TaskFunctionTransactionRequest,
} from './task-function-transaction-types.js'

import { DEFAULT_TASK_NAME } from '../utils.js'
import { TaskFunctionCatalogSynchronizer } from './task-function-catalog-synchronizer.js'
import { TaskFunctionCatalog } from './task-function-catalog.js'
import { TaskFunctionTransactionError } from './task-function-transaction-types.js'

export type {
  TaskFunctionTransactionCallbacks,
  TaskFunctionTransactionRequest,
} from './task-function-transaction-types.js'

const TRANSACTION_TIMEOUT = 30_000

type Mutation<Data, Response> = Readonly<{
  candidate: (
    catalog: TaskFunctionCatalog<Data, Response>
  ) => TaskFunctionCatalog<Data, Response>
  forward: Omit<TaskFunctionTransactionRequest<Data, Response>, 'operationId'>
  inverse: (
    catalog: TaskFunctionCatalog<Data, Response>
  ) => Omit<TaskFunctionTransactionRequest<Data, Response>, 'operationId'>
  validate?: (
    catalog: TaskFunctionCatalog<Data, Response>,
    workerCount: number
  ) => boolean
}>

type SendOutcome<Worker> = Readonly<{
  cause?: unknown
  handle: WorkerHandle<Worker>
  status: 'acknowledged' | 'failed' | 'uncertain'
}>

export class TaskFunctionTransactionManager<
  Worker,
  Data = unknown,
  Response = unknown
> {
  public get snapshot (): TaskFunctionCatalogSnapshot<Data, Response> {
    return this.#catalog.snapshot()
  }

  readonly #callbacks: TaskFunctionTransactionCallbacks<Worker, Data, Response>
  #catalog = TaskFunctionCatalog.empty<Data, Response>()
  #initialDefaultName?: string
  #lane: Promise<void> = Promise.resolve()
  #pendingMutations = 0
  readonly #synchronizer: TaskFunctionCatalogSynchronizer<
    Worker,
    Data,
    Response
  >

  public constructor (
    callbacks: TaskFunctionTransactionCallbacks<Worker, Data, Response>
  ) {
    this.#callbacks = callbacks
    this.#synchronizer = new TaskFunctionCatalogSynchronizer({
      initialDefaultName: () => {
        if (this.#initialDefaultName == null) {
          throw new Error('Task function static default is not initialized')
        }
        return this.#initialDefaultName
      },
      operationId: callbacks.operationId,
      quarantine: (handle, cause) => {
        if (callbacks.exclude(handle, cause)) callbacks.reconcile(handle)
      },
      send: callbacks.send,
      snapshot: () => this.snapshot,
    })
  }

  public add (
    name: string,
    taskFunction: TaskFunctionObject<Data, Response>
  ): Promise<boolean> {
    return this.#enqueue({
      candidate: catalog => catalog.add(name, taskFunction),
      forward: { name, operation: 'add', taskFunction },
      inverse: catalog => {
        const previous = catalog.get(name)
        return previous == null
          ? { name, operation: 'remove' }
          : { name, operation: 'add', taskFunction: previous }
      },
    })
  }

  public async initializeStaticDefault (name: string): Promise<void> {
    const initialized = this.#lane.then(() => {
      this.#catalog = this.#catalog.initializeDefault(name)
      this.#initialDefaultName = name
      return undefined
    })
    this.#lane = initialized
    await initialized
  }

  public remove (name: string): Promise<boolean> {
    const hasStaticTaskFunction =
      this.#callbacks.hasStaticTaskFunction?.(name) === true
    return this.#enqueue({
      candidate: catalog => catalog.remove(name, hasStaticTaskFunction),
      forward: { name, operation: 'remove' },
      inverse: catalog => ({
        name,
        operation: 'add',
        taskFunction: catalog.get(name),
      }),
      validate: catalog =>
        catalog.has(name) &&
        (catalog.defaultName !== name || hasStaticTaskFunction),
    })
  }

  public setDefault (name: string): Promise<boolean> {
    return this.#enqueue({
      candidate: catalog => catalog.setDefault(name),
      forward: { name, operation: 'default' },
      inverse: catalog => ({ name: catalog.defaultName, operation: 'default' }),
      validate: catalog =>
        catalog.defaultName !== DEFAULT_TASK_NAME &&
        (catalog.has(name) ||
          this.#callbacks.hasStaticTaskFunction?.(name) === true),
    })
  }

  public async synchronize (handle: WorkerHandle<Worker>): Promise<number> {
    return await this.#synchronizer.synchronize(handle)
  }

  public withStableCatalogAdmission<Result>(
    admit: (snapshot: TaskFunctionCatalogSnapshot<Data, Response>) => Result,
    signal?: AbortSignal
  ): Promise<Result> | Result {
    const admitWhenStable = (): Promise<Result> | Result => {
      if (this.#pendingMutations > 0) {
        return this.#lane.then(admitWhenStable)
      }
      if (signal?.aborted === true) {
        throw signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted', 'AbortError')
      }
      return admit(this.snapshot)
    }
    return admitWhenStable()
  }

  #enqueue (mutation: Mutation<Data, Response>): Promise<boolean> {
    ++this.#pendingMutations
    const excluded = new Set<WorkerHandle<Worker>>()
    const result = this.#lane.then(
      async () => await this.#mutate(mutation, excluded)
    )
    const settled = result.then(
      () => {
        --this.#pendingMutations
        return undefined
      },
      () => {
        --this.#pendingMutations
        return undefined
      }
    )
    this.#lane = settled.then(() => {
      for (const handle of excluded) this.#callbacks.reconcile(handle)
      return undefined
    })
    return result
  }

  async #mutate (
    mutation: Mutation<Data, Response>,
    excluded: Set<WorkerHandle<Worker>>
  ): Promise<boolean> {
    const operationId = this.#callbacks.operationId?.() ?? randomUUID()
    const committed = this.#catalog
    const handles = this.#callbacks.snapshotReadyHandles()
    if (mutation.validate?.(committed, handles.length) === false) {
      throw new TaskFunctionTransactionError(operationId, [
        {
          cause: new TypeError(
            'Task function mutation is not valid for the committed catalog'
          ),
          phase: 'validation',
        },
      ])
    }
    const epoch = this.#callbacks.topologyEpoch()
    const controller = new AbortController()
    let topologyChanged = false
    const unsubscribe = this.#callbacks.subscribeTopologyChanges(() => {
      topologyChanged = true
      controller.abort(
        new Error('Worker topology changed during task function transaction')
      )
    })
    const forward = { ...mutation.forward, operationId }
    const outcomes = await this.#sendPhase(handles, forward, controller)
    unsubscribe()
    const failures = outcomes.filter(
      outcome => outcome.status !== 'acknowledged'
    )
    if (failures.length === 0 && this.#callbacks.topologyEpoch() === epoch) {
      this.#catalog = mutation.candidate(committed)
      const snapshot = this.snapshot
      try {
        this.#callbacks.onCommit(snapshot, committed.snapshot())
      } catch (error) {
        // no-excuse-ok: catch -- post-commit observers cannot revoke ownership
        try {
          this.#callbacks.onPostCommitError(error, snapshot)
        } catch (reportingError) {
          // no-excuse-ok: catch -- reporting cannot revoke a committed mutation
          this.#callbacks.defer(reportingError)
        }
      }
      return true
    }
    const causes: TaskFunctionTransactionFailure[] = failures.map(outcome => ({
      cause: outcome.cause,
      lease: outcome.handle.lease,
      phase: topologyChanged ? 'topology' : 'forward',
    }))
    if (failures.length === 0) {
      causes.push({
        cause: new Error(
          'Worker topology changed during task function transaction'
        ),
        phase: 'topology',
      })
    }
    for (const outcome of failures) {
      if (
        outcome.status === 'uncertain' &&
        !excluded.has(outcome.handle) &&
        this.#callbacks.exclude(outcome.handle, outcome.cause)
      ) {
        excluded.add(outcome.handle)
      }
    }
    const acknowledged = outcomes
      .filter(outcome => outcome.status === 'acknowledged')
      .reverse()
    const compensation = {
      ...mutation.inverse(committed),
      operationId: `${operationId}:compensate`,
    }
    const compensationOutcomes = await this.#sendPhase(
      acknowledged.map(outcome => outcome.handle),
      compensation,
      new AbortController()
    )
    for (const outcome of compensationOutcomes) {
      if (outcome.status === 'acknowledged') continue
      causes.push({
        cause: outcome.cause,
        lease: outcome.handle.lease,
        phase: 'compensation',
      })
      if (
        !excluded.has(outcome.handle) &&
        this.#callbacks.exclude(outcome.handle, outcome.cause)
      ) {
        excluded.add(outcome.handle)
      }
    }
    throw new TaskFunctionTransactionError(operationId, causes)
  }

  async #sendPhase (
    handles: readonly WorkerHandle<Worker>[],
    request: TaskFunctionTransactionRequest<Data, Response>,
    controller: AbortController
  ): Promise<readonly SendOutcome<Worker>[]> {
    if (handles.length === 0) return []
    const timeout = setTimeout(() => {
      controller.abort(
        new Error(`Task function ${request.operation} timed out`)
      )
    }, this.#callbacks.timeout?.() ?? TRANSACTION_TIMEOUT)
    const promises = handles.map(async handle => {
      try {
        const acknowledged = await this.#callbacks.send(
          handle,
          request,
          controller.signal
        )
        if (acknowledged) {
          return {
            handle,
            status: 'acknowledged',
          } satisfies SendOutcome<Worker>
        }
        controller.abort(new Error('Worker rejected task function operation'))
        return {
          cause: new Error('Worker rejected task function operation'),
          handle,
          status: 'failed',
        } satisfies SendOutcome<Worker>
      } catch (cause) {
        if (!controller.signal.aborted) controller.abort(cause)
        return {
          cause,
          handle,
          status: 'uncertain',
        } satisfies SendOutcome<Worker>
      }
    })
    const outcomes = await Promise.all(promises)
    clearTimeout(timeout)
    return outcomes
  }
}
