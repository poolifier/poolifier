import type { MessageValue, Task } from '../utility-types.js'
import type { SettlementResult, WorkerLease } from './lifecycle-types.js'
import type { WorkerUsage } from './worker.js'

import { hasMultipleTaskFunctions } from './utils.js'

export interface AccountingWorker {
  getTaskFunctionWorkerUsage: (name: string) => undefined | WorkerUsage
  readonly info: Readonly<{ taskFunctionsProperties?: readonly unknown[] }>
  readonly usage: WorkerUsage
}

export interface TaskUsageAccountingCallbacks<
  Worker extends AccountingWorker,
  Data,
  Response
> {
  readonly getWorkerNodeKeyByLease: (lease?: WorkerLease) => number
  readonly shouldUpdateTaskFunctionUsage?: (workerNodeKey: number) => boolean
  readonly updateElu?: (
    usage: WorkerUsage,
    message: MessageValue<Response>
  ) => void
  readonly updateRunTime?: (
    usage: WorkerUsage,
    message: MessageValue<Response>
  ) => void
  readonly updateStrategy?: (workerNodeKey: number) => void
  readonly updateWaitTime?: (usage: WorkerUsage, task: Task<Data>) => void
  readonly workerNodes: () => readonly Worker[]
}

export class TaskUsageAccounting<
  Worker extends AccountingWorker,
  Data = unknown,
  Response = unknown
> {
  public constructor (
    private readonly callbacks: TaskUsageAccountingCallbacks<
      Worker,
      Data,
      Response
    >
  ) {}

  public afterExecution (
    workerNodeKey: number,
    message: MessageValue<Response>,
    executingWorkerNodeKey = workerNodeKey,
    settledTaskName?: string
  ): void {
    const taskName = message.taskPerformance?.name ?? settledTaskName
    const workers = this.callbacks.workerNodes()
    const executingWorker = workers.at(executingWorkerNodeKey)
    const statisticsWorker = workers.at(workerNodeKey)
    if (executingWorker == null || statisticsWorker == null) return
    this.decrementExecuting(executingWorker.usage)
    this.taskFunctionUsage(
      executingWorkerNodeKey,
      taskName,
      executingWorker,
      usage => {
        this.decrementExecuting(usage)
      }
    )
    this.updateOutcome(statisticsWorker.usage, message)
    this.callbacks.updateRunTime?.(statisticsWorker.usage, message)
    this.callbacks.updateElu?.(statisticsWorker.usage, message)
    this.taskFunctionUsage(workerNodeKey, taskName, statisticsWorker, usage => {
      this.updateOutcome(usage, message)
      this.callbacks.updateRunTime?.(usage, message)
      this.callbacks.updateElu?.(usage, message)
    })
    this.callbacks.updateStrategy?.(executingWorkerNodeKey)
    if (workerNodeKey !== executingWorkerNodeKey) {
      this.callbacks.updateStrategy?.(workerNodeKey)
    }
  }

  public applyRejectedSettlement (
    result: SettlementResult,
    fallbackWorker?: Worker
  ): undefined | Worker {
    if (!result.settled) return undefined
    const { activeLease, executionStarted, selectedLease, taskName } =
      result.effect
    const workers = this.callbacks.workerNodes()
    const activeKey = this.callbacks.getWorkerNodeKeyByLease(activeLease)
    const selectedKey = this.callbacks.getWorkerNodeKeyByLease(selectedLease)
    const activeWorker =
      activeKey === -1 ? fallbackWorker : workers.at(activeKey)
    const statisticsWorker =
      selectedKey === -1 ? activeWorker : workers.at(selectedKey)
    if (activeLease != null && activeWorker != null) {
      this.decrementExecuting(activeWorker.usage)
      this.taskFunctionUsage(activeKey, taskName, activeWorker, usage => {
        this.decrementExecuting(usage)
      })
    }
    if (executionStarted && statisticsWorker != null) {
      ++statisticsWorker.usage.tasks.failed
      this.taskFunctionUsage(selectedKey, taskName, statisticsWorker, usage => {
        ++usage.tasks.failed
      })
    }
    if (activeKey !== -1) this.callbacks.updateStrategy?.(activeKey)
    if (selectedKey !== -1 && selectedKey !== activeKey) {
      this.callbacks.updateStrategy?.(selectedKey)
    }
    return activeWorker ?? statisticsWorker
  }

  public beforeExecution (workerNodeKey: number, task: Task<Data>): void {
    const worker = this.callbacks.workerNodes().at(workerNodeKey)
    if (worker == null) return
    ++worker.usage.tasks.executing
    this.callbacks.updateWaitTime?.(worker.usage, task)
    this.taskFunctionUsage(workerNodeKey, task.name, worker, usage => {
      ++usage.tasks.executing
      this.callbacks.updateWaitTime?.(usage, task)
    })
  }

  public resetSequentiallyStolen (
    workerNodeKey: number,
    taskName?: string
  ): void {
    const worker = this.callbacks.workerNodes().at(workerNodeKey)
    if (worker == null) return
    worker.usage.tasks.sequentiallyStolen = 0
    this.taskFunctionUsage(workerNodeKey, taskName, worker, usage => {
      usage.tasks.sequentiallyStolen = 0
    })
  }

  public updateSequentiallyStolen (
    workerNodeKey: number,
    taskName?: string,
    previousTaskName?: string
  ): void {
    const worker = this.callbacks.workerNodes().at(workerNodeKey)
    if (worker == null || taskName == null) return
    ++worker.usage.tasks.sequentiallyStolen
    this.taskFunctionUsage(workerNodeKey, taskName, worker, usage => {
      if (
        usage.tasks.sequentiallyStolen === 0 ||
        (previousTaskName === taskName && usage.tasks.sequentiallyStolen > 0)
      ) {
        ++usage.tasks.sequentiallyStolen
      } else if (usage.tasks.sequentiallyStolen > 0) {
        usage.tasks.sequentiallyStolen = 0
      }
    })
  }

  public updateStolen (workerNodeKey: number, taskName: string): void {
    const worker = this.callbacks.workerNodes().at(workerNodeKey)
    if (worker == null) return
    ++worker.usage.tasks.stolen
    this.taskFunctionUsage(workerNodeKey, taskName, worker, usage => {
      ++usage.tasks.stolen
    })
  }

  private decrementExecuting (usage: WorkerUsage): void {
    if (usage.tasks.executing > 0) --usage.tasks.executing
  }

  private taskFunctionUsage (
    workerNodeKey: number,
    taskName: string | undefined,
    worker: Worker,
    update: (usage: WorkerUsage) => void
  ): void {
    if (
      taskName == null ||
      !(
        this.callbacks.shouldUpdateTaskFunctionUsage?.(workerNodeKey) ??
        hasMultipleTaskFunctions(worker.info.taskFunctionsProperties)
      )
    ) {
      return
    }
    const usage = worker.getTaskFunctionWorkerUsage(taskName)
    if (usage != null) update(usage)
  }

  private updateOutcome (
    usage: WorkerUsage,
    message: MessageValue<Response>
  ): void {
    if (message.workerError == null) ++usage.tasks.executed
    else ++usage.tasks.failed
  }
}
