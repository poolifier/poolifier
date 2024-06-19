import { cpus } from 'node:os'

import type { IPool } from '../pool.js'
import type { IWorker } from '../worker.js'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy.js'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from './interleaved-weighted-round-robin-worker-choice-strategy.js'
import { LeastBusyWorkerChoiceStrategy } from './least-busy-worker-choice-strategy.js'
import { LeastEluWorkerChoiceStrategy } from './least-elu-worker-choice-strategy.js'
import { LeastUsedWorkerChoiceStrategy } from './least-used-worker-choice-strategy.js'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy.js'
import {
  type IWorkerChoiceStrategy,
  type MeasurementStatisticsRequirements,
  type StrategyPolicy,
  type TaskStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.js'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy.js'
import type { WorkerChoiceStrategiesContext } from './worker-choice-strategies-context.js'

const estimatedCpuSpeed = (): number => {
  const runs = 150000000
  const begin = performance.now()
  // eslint-disable-next-line no-empty
  for (let i = runs; i > 0; i--) {}
  const end = performance.now()
  const duration = end - begin
  return Math.trunc(runs / duration / 1000) // in MHz
}

const getDefaultWorkerWeight = (): number => {
  const currentCpus = cpus()
  let estCpuSpeed: number | undefined
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (currentCpus.every(cpu => cpu.speed == null || cpu.speed === 0)) {
    estCpuSpeed = estimatedCpuSpeed()
  }
  let cpusCycleTimeWeight = 0
  for (const cpu of currentCpus) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (cpu.speed == null || cpu.speed === 0) {
      cpu.speed =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        currentCpus.find(cpu => cpu.speed != null && cpu.speed !== 0)?.speed ??
        estCpuSpeed ??
        2000
    }
    // CPU estimated cycle time
    const numberOfDigits = cpu.speed.toString().length - 1
    const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigits))
    cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigits)
  }
  return Math.round(cpusCycleTimeWeight / currentCpus.length)
}

const getDefaultWeights = (
  poolMaxSize: number,
  defaultWorkerWeight?: number
): Record<number, number> => {
  defaultWorkerWeight = defaultWorkerWeight ?? getDefaultWorkerWeight()
  const weights: Record<number, number> = {}
  for (let workerNodeKey = 0; workerNodeKey < poolMaxSize; workerNodeKey++) {
    weights[workerNodeKey] = defaultWorkerWeight
  }
  return weights
}

export const getWorkerChoiceStrategiesRetries = <
  Worker extends IWorker,
  Data,
  Response
>(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ): number => {
  return (
    pool.info.maxSize +
    Object.keys(opts?.weights ?? getDefaultWeights(pool.info.maxSize)).length
  )
}

export const buildWorkerChoiceStrategyOptions = <
  Worker extends IWorker,
  Data,
  Response
>(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions
  ): WorkerChoiceStrategyOptions => {
  opts = structuredClone(opts ?? {})
  opts.weights = opts.weights ?? getDefaultWeights(pool.info.maxSize)
  return {
    ...{
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false },
    },
    ...opts,
  }
}

export const toggleMedianMeasurementStatisticsRequirements = (
  measurementStatisticsRequirements: MeasurementStatisticsRequirements,
  toggleMedian: boolean
): void => {
  if (measurementStatisticsRequirements.average && toggleMedian) {
    measurementStatisticsRequirements.average = false
    measurementStatisticsRequirements.median = toggleMedian
  }
  if (measurementStatisticsRequirements.median && !toggleMedian) {
    measurementStatisticsRequirements.average = true
    measurementStatisticsRequirements.median = toggleMedian
  }
}

export const buildWorkerChoiceStrategiesPolicy = (
  workerChoiceStrategies: Map<WorkerChoiceStrategy, IWorkerChoiceStrategy>
): StrategyPolicy => {
  const policies: StrategyPolicy[] = Array.from(
    workerChoiceStrategies,
    ([_, workerChoiceStrategy]) => workerChoiceStrategy.strategyPolicy
  )
  return {
    dynamicWorkerUsage: policies.some(p => p.dynamicWorkerUsage),
    dynamicWorkerReady: policies.some(p => p.dynamicWorkerReady),
  }
}

export const buildWorkerChoiceStrategiesTaskStatisticsRequirements = (
  workerChoiceStrategies: Map<WorkerChoiceStrategy, IWorkerChoiceStrategy>
): TaskStatisticsRequirements => {
  const taskStatisticsRequirements: TaskStatisticsRequirements[] = Array.from(
    workerChoiceStrategies,
    ([_, workerChoiceStrategy]) =>
      workerChoiceStrategy.taskStatisticsRequirements
  )
  return {
    runTime: {
      aggregate: taskStatisticsRequirements.some(r => r.runTime.aggregate),
      average: taskStatisticsRequirements.some(r => r.runTime.average),
      median: taskStatisticsRequirements.some(r => r.runTime.median),
    },
    waitTime: {
      aggregate: taskStatisticsRequirements.some(r => r.waitTime.aggregate),
      average: taskStatisticsRequirements.some(r => r.waitTime.average),
      median: taskStatisticsRequirements.some(r => r.waitTime.median),
    },
    elu: {
      aggregate: taskStatisticsRequirements.some(r => r.elu.aggregate),
      average: taskStatisticsRequirements.some(r => r.elu.average),
      median: taskStatisticsRequirements.some(r => r.elu.median),
    },
  }
}

export const getWorkerChoiceStrategy = <Worker extends IWorker, Data, Response>(
  workerChoiceStrategy: WorkerChoiceStrategy,
  pool: IPool<Worker, Data, Response>,
  context: ThisType<WorkerChoiceStrategiesContext<Worker, Data, Response>>,
  opts?: WorkerChoiceStrategyOptions
): IWorkerChoiceStrategy => {
  switch (workerChoiceStrategy) {
    case WorkerChoiceStrategies.ROUND_ROBIN:
      return new (RoundRobinWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.LEAST_USED:
      return new (LeastUsedWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.LEAST_BUSY:
      return new (LeastBusyWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.LEAST_ELU:
      return new (LeastEluWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.FAIR_SHARE:
      return new (FairShareWorkerChoiceStrategy.bind(context))(pool, opts)
    case WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN:
      return new (WeightedRoundRobinWorkerChoiceStrategy.bind(context))(
        pool,
        opts
      )
    case WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN:
      return new (InterleavedWeightedRoundRobinWorkerChoiceStrategy.bind(
        context
      ))(pool, opts)
    default:
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Worker choice strategy '${workerChoiceStrategy}' is not valid`
      )
  }
}
