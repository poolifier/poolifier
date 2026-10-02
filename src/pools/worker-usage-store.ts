import type { PriorityQueue } from '../queues/priority-queue.js'
import type { Task } from '../utility-types.js'
import type { WorkerInfo, WorkerUsage } from './worker.js'

import { CircularBuffer } from '../circular-buffer.js'
import { DEFAULT_TASK_NAME } from '../utils.js'
import { MeasurementHistorySize } from './worker.js'

type WorkerUsageInfo = Pick<WorkerInfo, 'taskFunctionsProperties'>

const createWorkerUsage = (tasks: WorkerUsage['tasks']): WorkerUsage => ({
  elu: {
    active: { history: new CircularBuffer(MeasurementHistorySize) },
    idle: { history: new CircularBuffer(MeasurementHistorySize) },
  },
  runTime: { history: new CircularBuffer(MeasurementHistorySize) },
  tasks,
  waitTime: { history: new CircularBuffer(MeasurementHistorySize) },
})

export class WorkerUsageStore<Data = unknown> {
  public readonly usage: WorkerUsage

  private readonly taskFunctionUsage = new Map<string, WorkerUsage>()

  public constructor (
    private readonly info: WorkerUsageInfo,
    private readonly tasksQueue: PriorityQueue<Task<Data>>
  ) {
    const queue = tasksQueue
    this.usage = createWorkerUsage({
      executed: 0,
      executing: 0,
      failed: 0,
      get maxQueued (): number {
        return queue.maxSize
      },
      get queued (): number {
        return queue.size
      },
      sequentiallyStolen: 0,
      stolen: 0,
    })
  }

  public deleteTaskFunctionWorkerUsage (name: string): boolean {
    return this.taskFunctionUsage.delete(name)
  }

  public getTaskFunctionWorkerUsage (name: string): WorkerUsage {
    const resolvedName = this.resolveTaskFunctionName(name)
    const existingUsage = this.taskFunctionUsage.get(resolvedName)
    if (existingUsage != null) return existingUsage
    const usage = this.createTaskFunctionWorkerUsage(resolvedName)
    this.taskFunctionUsage.set(resolvedName, usage)
    return usage
  }

  private createTaskFunctionWorkerUsage (name: string): WorkerUsage {
    const tasksQueue = this.tasksQueue
    const info = this.info
    return createWorkerUsage({
      executed: 0,
      executing: 0,
      failed: 0,
      get queued (): number {
        let queued = 0
        for (const task of tasksQueue) {
          const taskName =
            task.name === DEFAULT_TASK_NAME
              ? info.taskFunctionsProperties?.[1]?.name
              : task.name
          if (taskName === name) ++queued
        }
        return queued
      },
      sequentiallyStolen: 0,
      stolen: 0,
    })
  }

  private resolveTaskFunctionName (name: string): string {
    const properties = this.info.taskFunctionsProperties
    if (!Array.isArray(properties)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list is not yet defined`
      )
    }
    if (properties.length < 3) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list has less than 3 elements`
      )
    }
    if (name !== DEFAULT_TASK_NAME) return name
    return properties[1].name
  }
}
