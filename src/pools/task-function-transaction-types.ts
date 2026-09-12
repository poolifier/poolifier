import type { TaskFunctionObject } from '../worker/task-functions.js'
import type { WorkerHandle, WorkerLease } from './lifecycle-types.js'
import type { TaskFunctionCatalogSnapshot } from './task-function-catalog.js'

export interface TaskFunctionTransactionCallbacks<Worker, Data, Response> {
  readonly defer: (error: unknown) => void
  readonly exclude: (handle: WorkerHandle<Worker>, cause: unknown) => boolean
  readonly hasStaticTaskFunction?: (name: string) => boolean
  readonly onCommit: (
    snapshot: TaskFunctionCatalogSnapshot<Data, Response>,
    previous: TaskFunctionCatalogSnapshot<Data, Response>
  ) => void
  readonly onPostCommitError: (
    error: unknown,
    snapshot: TaskFunctionCatalogSnapshot<Data, Response>
  ) => void
  readonly operationId?: () => string
  readonly reconcile: (handle: WorkerHandle<Worker>) => void
  readonly send: (
    handle: WorkerHandle<Worker>,
    request: TaskFunctionTransactionRequest<Data, Response>,
    signal: AbortSignal
  ) => Promise<boolean>
  readonly snapshotReadyHandles: () => readonly WorkerHandle<Worker>[]
  readonly subscribeTopologyChanges: (
    listener: (epoch: number) => void
  ) => () => void
  readonly timeout?: () => number
  readonly topologyEpoch: () => number
}

export type TaskFunctionTransactionFailure = Readonly<{
  cause: unknown
  lease?: WorkerLease
  phase: 'compensation' | 'forward' | 'replay' | 'topology' | 'validation'
}>

export type TaskFunctionTransactionRequest<Data, Response> = Readonly<{
  name: string
  operation: 'add' | 'default' | 'remove'
  operationId: string
  taskFunction?: TaskFunctionObject<Data, Response>
}>

export class TaskFunctionTransactionError extends Error {
  public override readonly name = 'TaskFunctionTransactionError'

  public constructor (
    public readonly operationId: string,
    public readonly failures: readonly TaskFunctionTransactionFailure[]
  ) {
    super(`Task function transaction '${operationId}' failed`, {
      cause: failures[0]?.cause,
    })
  }
}
