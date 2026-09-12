import {
  type ExitHandler,
  type IPool,
  type IWorker,
  type IWorkerNode,
  PoolEvents,
  type PromiseResponseWrapper,
  type TaskUUID,
  WorkerCrashError,
  type WorkerInfo,
  WorkerTerminationError,
} from '../../lib/index.js'

declare const pool: IPool<IWorker>
declare const response: PromiseResponseWrapper
declare const legacyWorkerNode: Omit<
  IWorkerNode<IWorker>,
  'waitForTransportDrain'
>

const compatibleWorkerNode: IWorkerNode<IWorker> = legacyWorkerNode
const prependOnceWorkerEventHandler =
  compatibleWorkerNode.prependOnceWorkerEventHandler

declare const workerInfo: WorkerInfo
const crashHandled: boolean = workerInfo.crashHandled
const terminating: boolean = workerInfo.terminating

const exitHandler: ExitHandler<IWorker> = function (exitCode, signal): void {
  Object.freeze({ exitCode, signal })
}
const nullableExitHandlerParameters: Parameters<ExitHandler<IWorker>> = [
  null,
  null,
]
const optionalSignalExitHandlerParameters: Parameters<ExitHandler<IWorker>> = [
  0,
  undefined,
]

pool.emitter?.on(PoolEvents.error, (error: WorkerCrashError): void => {
  const metadata: Readonly<{
    cause?: unknown
    exitCode: null | number
    signal: NodeJS.Signals | null
    taskId?: TaskUUID
    workerId?: number
  }> = error
  Object.freeze(metadata)
})

const destroyOutcome: Promise<void> = pool.destroy()
const workerId: number | undefined = response.workerId
const crashError = new WorkerCrashError('worker crashed')
const terminationError = new WorkerTerminationError('worker terminated')
const removedWorkerInfoKey: Exclude<
  'staticTaskFunctionsProperties',
  keyof WorkerInfo
> = 'staticTaskFunctionsProperties'

export const apiContract = Object.freeze({
  compatibleWorkerNode,
  crashError,
  crashHandled,
  destroyOutcome,
  exitHandler,
  nullableExitHandlerParameters,
  optionalSignalExitHandlerParameters,
  prependOnceWorkerEventHandler,
  removedWorkerInfoKey,
  terminating,
  terminationError,
  workerId,
  workerInfo,
})
