import type { PoolInfo, PoolType } from './pool.js'
import type {
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
} from './selection-strategies/selection-strategies-types.js'
import type { WorkerType, WorkerUsage } from './worker.js'

import { average, max, median, min, round } from '../utils.js'
import { PoolTypes } from './pool.js'

export interface PoolInfoProjectionInput {
  readonly backPressure: boolean
  readonly defaultStrategy: WorkerChoiceStrategy
  readonly enableTasksQueue: boolean
  readonly maxSize: number
  readonly minSize: number
  readonly queuedTasks: number
  readonly ready: boolean
  readonly started: boolean
  readonly statistics: PoolStatisticsProjection
  readonly strategyRetries: number
  readonly type: PoolType
  readonly utilization: number
  readonly version: string
  readonly worker: WorkerType
  readonly workers: readonly PoolInfoWorkerSnapshot[]
}

export interface PoolInfoWorkerSnapshot {
  readonly backPressured: boolean
  readonly busy: boolean
  readonly dynamic: boolean
  readonly idle: boolean
  readonly maxQueued: number
  readonly stealing: boolean
  readonly tasks: Readonly<{
    executed: number
    executing: number
    failed: number
    stolen: number
  }>
}

export type PoolStatisticsProjection = Pick<
  PoolInfo,
  'elu' | 'runTime' | 'waitTime'
>

const projectMeasurement = (
  usages: readonly WorkerUsage[],
  measurement: 'runTime' | 'waitTime',
  requirements: TaskStatisticsRequirements['runTime']
): NonNullable<PoolInfo['runTime']> => {
  const history = usages.reduce<number[]>(
    (values, usage) => values.concat(usage[measurement].history.toArray()),
    []
  )
  return {
    maximum: round(
      max(
        ...usages.map(
          usage => usage[measurement].maximum ?? Number.NEGATIVE_INFINITY
        )
      )
    ),
    minimum: round(
      min(
        ...usages.map(
          usage => usage[measurement].minimum ?? Number.POSITIVE_INFINITY
        )
      )
    ),
    ...(requirements.average && { average: round(average(history)) }),
    ...(requirements.median && { median: round(median(history)) }),
  }
}

const projectEluMeasurement = (
  usages: readonly WorkerUsage[],
  measurement: 'active' | 'idle',
  requirements: TaskStatisticsRequirements['elu']
): NonNullable<PoolInfo['elu']>['active'] => {
  const history = usages.reduce<number[]>(
    (values, usage) => values.concat(usage.elu[measurement].history.toArray()),
    []
  )
  return {
    maximum: round(
      max(
        ...usages.map(
          usage => usage.elu[measurement].maximum ?? Number.NEGATIVE_INFINITY
        )
      )
    ),
    minimum: round(
      min(
        ...usages.map(
          usage => usage.elu[measurement].minimum ?? Number.POSITIVE_INFINITY
        )
      )
    ),
    ...(requirements.average && { average: round(average(history)) }),
    ...(requirements.median && { median: round(median(history)) }),
  }
}

export const projectPoolStatistics = (
  usages: readonly WorkerUsage[],
  requirements: TaskStatisticsRequirements | undefined
): PoolStatisticsProjection => {
  return {
    ...(requirements?.runTime.aggregate === true && {
      runTime: projectMeasurement(usages, 'runTime', requirements.runTime),
    }),
    ...(requirements?.waitTime.aggregate === true && {
      waitTime: projectMeasurement(usages, 'waitTime', requirements.waitTime),
    }),
    ...(requirements?.elu.aggregate === true && {
      elu: {
        active: projectEluMeasurement(usages, 'active', requirements.elu),
        idle: projectEluMeasurement(usages, 'idle', requirements.elu),
        utilization: {
          average: round(
            average(usages.map(usage => usage.elu.utilization ?? 0))
          ),
          median: round(
            median(usages.map(usage => usage.elu.utilization ?? 0))
          ),
        },
      },
    }),
  }
}

export const projectPoolInfo = (input: PoolInfoProjectionInput): PoolInfo => {
  const count = (
    predicate: (worker: PoolInfoWorkerSnapshot) => boolean
  ): number =>
    input.workers.reduce(
      (total, worker) => (predicate(worker) ? total + 1 : total),
      0
    )
  const sum = (select: (worker: PoolInfoWorkerSnapshot) => number): number =>
    input.workers.reduce((total, worker) => total + select(worker), 0)

  return {
    defaultStrategy: input.defaultStrategy,
    maxSize: input.maxSize,
    minSize: input.minSize,
    ready: input.ready,
    started: input.started,
    strategyRetries: input.strategyRetries,
    type: input.type,
    version: input.version,
    worker: input.worker,
    ...(input.statistics.runTime != null &&
      input.statistics.waitTime != null && {
      utilization: round(input.utilization),
    }),
    busyWorkerNodes: count(worker => worker.busy),
    executedTasks: sum(worker => worker.tasks.executed),
    executingTasks: sum(worker => worker.tasks.executing),
    failedTasks: sum(worker => worker.tasks.failed),
    idleWorkerNodes: count(worker => worker.idle),
    workerNodes: input.workers.length,
    ...(input.type === PoolTypes.dynamic && {
      dynamicWorkerNodes: count(worker => worker.dynamic),
    }),
    ...(input.enableTasksQueue && {
      backPressure: input.backPressure,
      backPressureWorkerNodes: count(worker => worker.backPressured),
      maxQueuedTasks: sum(worker => worker.maxQueued),
      queuedTasks: input.queuedTasks,
      stealingWorkerNodes: count(worker => worker.stealing),
      stolenTasks: sum(worker => worker.tasks.stolen),
    }),
    ...input.statistics,
  }
}
