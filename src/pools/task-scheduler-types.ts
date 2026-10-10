import type { Task, TaskUUID } from '../utility-types.js'
import type {
  DispatchPermit,
  SettlementResult,
  WorkerHandle,
} from './lifecycle-types.js'

export type QueueTakeResult<Worker> =
  | Readonly<{ kind: 'task'; taskId: TaskUUID }>
  | ScheduleResult<Worker>

export type ScheduleResult<Worker> =
  | Readonly<{
    backPressureStarted?: boolean
    handle: WorkerHandle<Worker>
    kind: 'committed'
    state: 'cancelling' | 'queued' | 'running' | 'waitingReady'
    taskId?: TaskUUID
  }>
  | Readonly<{ error?: unknown; kind: 'retry'; taskId?: TaskUUID }>
  | Readonly<{
    handle?: WorkerHandle<Worker>
    kind: 'settled'
    settlement?: SettlementResult
    taskId?: TaskUUID
  }>

export interface SchedulerWorker<Data> {
  deleteTask(task: Task<Data>): boolean
  dequeueLastPrioritizedTask(): Task<Data> | undefined
  dequeueTask(): Task<Data> | undefined
  enqueueTask(task: Task<Data>): number
  readonly info?: Readonly<{ backPressure: boolean }>
  tasksQueueSize(): number
}

export interface TaskSchedulerCallbacks<Worker, Data> {
  readonly acquire: (
    handle: WorkerHandle<Worker>
  ) => DispatchPermit<Worker> | undefined
  readonly candidates: (
    source?: WorkerHandle<Worker>
  ) => readonly WorkerHandle<Worker>[]
  readonly send: (
    permit: DispatchPermit<Worker>,
    task: Task<Data>,
    transferList?: Task<Data>['transferList']
  ) => void
  readonly sendAbort: (handle: WorkerHandle<Worker>, taskId: TaskUUID) => void
  readonly shouldDispatch: (permit: DispatchPermit<Worker>) => boolean
}
