import { describe, expect, it } from 'vitest'

import { buildPoolOptions } from '../../../lib/pools/pool-options-builder.mjs'
import {
  projectPoolInfo,
  projectPoolStatistics,
} from '../../../lib/pools/pool-projections.mjs'
import { PoolTypes } from '../../../lib/pools/pool.mjs'
import { WorkerChoiceStrategies } from '../../../lib/pools/selection-strategies/selection-strategies-types.mjs'

const requirements = ({
  average = false,
  elu = false,
  median = false,
  runTime = false,
  waitTime = false,
} = {}) => ({
  elu: { aggregate: elu, average, median },
  runTime: { aggregate: runTime, average, median },
  waitTime: { aggregate: waitTime, average, median },
})

const measurement = (history, minimum, maximum) => ({
  history: { toArray: () => history },
  maximum,
  minimum,
})

const usage = ({
  active = [],
  idle = [],
  runTime = [],
  utilization = 0,
  waitTime = [],
} = {}) => ({
  elu: {
    active: measurement(
      active,
      active.length === 0 ? undefined : Math.min(...active),
      active.length === 0 ? undefined : Math.max(...active)
    ),
    idle: measurement(
      idle,
      idle.length === 0 ? undefined : Math.min(...idle),
      idle.length === 0 ? undefined : Math.max(...idle)
    ),
    utilization,
  },
  runTime: measurement(
    runTime,
    runTime.length === 0 ? undefined : Math.min(...runTime),
    runTime.length === 0 ? undefined : Math.max(...runTime)
  ),
  tasks: { executed: 0, executing: 0, failed: 0, maxQueued: 0, stolen: 0 },
  waitTime: measurement(
    waitTime,
    waitTime.length === 0 ? undefined : Math.min(...waitTime),
    waitTime.length === 0 ? undefined : Math.max(...waitTime)
  ),
})

describe('pool projections', () => {
  it('preserves empty aggregate sentinel values', () => {
    expect(
      projectPoolStatistics(
        [],
        requirements({
          average: true,
          median: true,
          runTime: true,
          waitTime: true,
        })
      )
    ).toStrictEqual({
      runTime: { average: 0, maximum: -Infinity, median: 0, minimum: Infinity },
      waitTime: {
        average: 0,
        maximum: -Infinity,
        median: 0,
        minimum: Infinity,
      },
    })
  })

  it('projects requested statistics across workers', () => {
    const statistics = projectPoolStatistics(
      [
        usage({
          active: [1, 3],
          idle: [5],
          runTime: [2, 4],
          utilization: 0.25,
          waitTime: [6],
        }),
        usage({
          active: [2],
          idle: [7, 9],
          runTime: [6],
          utilization: 0.75,
          waitTime: [8, 10],
        }),
      ],
      requirements({
        average: true,
        elu: true,
        median: true,
        runTime: true,
        waitTime: true,
      })
    )

    expect(statistics).toStrictEqual({
      elu: {
        active: { average: 2, maximum: 3, median: 2, minimum: 1 },
        idle: { average: 7, maximum: 9, median: 7, minimum: 5 },
        utilization: { average: 0.5, median: 0.5 },
      },
      runTime: { average: 4, maximum: 6, median: 4, minimum: 2 },
      waitTime: { average: 8, maximum: 10, median: 8, minimum: 6 },
    })
  })

  it('projects dynamic and queue fields only when enabled', () => {
    const result = projectPoolInfo({
      backPressure: true,
      defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
      enableTasksQueue: true,
      maxSize: 4,
      minSize: 2,
      queuedTasks: 5,
      ready: true,
      started: true,
      statistics: {},
      strategyRetries: 3,
      type: PoolTypes.dynamic,
      utilization: 0.456,
      version: '1.0.0',
      worker: 'thread',
      workers: [
        {
          backPressured: true,
          busy: true,
          dynamic: false,
          idle: false,
          maxQueued: 4,
          stealing: false,
          tasks: { executed: 2, executing: 1, failed: 0, stolen: 1 },
        },
        {
          backPressured: false,
          busy: false,
          dynamic: true,
          idle: true,
          maxQueued: 3,
          stealing: true,
          tasks: { executed: 3, executing: 0, failed: 1, stolen: 2 },
        },
      ],
    })

    expect(result).toMatchObject({
      backPressure: true,
      backPressureWorkerNodes: 1,
      busyWorkerNodes: 1,
      dynamicWorkerNodes: 1,
      executedTasks: 5,
      idleWorkerNodes: 1,
      maxQueuedTasks: 7,
      queuedTasks: 5,
      stealingWorkerNodes: 1,
      stolenTasks: 3,
      workerNodes: 2,
    })
  })

  it('merges pool and queue options in current precedence order', () => {
    const input = {
      enableTasksQueue: true,
      restartWorkerOnError: false,
      tasksQueueOptions: { concurrency: 2 },
      workerChoiceStrategyOptions: { measurement: 'runTime' },
    }
    expect(buildPoolOptions(input, 3)).toStrictEqual({
      enableEvents: true,
      enableTasksQueue: true,
      restartWorkerOnError: false,
      startWorkers: true,
      tasksQueueOptions: {
        agingFactor: 0.001,
        concurrency: 2,
        loadExponent: 2 / 3,
        size: 9,
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
      },
      workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      workerChoiceStrategyOptions: { measurement: 'runTime' },
    })
    expect(
      buildPoolOptions({ tasksQueueOptions: { concurrency: 2 } }, 3)
        .tasksQueueOptions
    ).toStrictEqual({ concurrency: 2 })
    expect(() =>
      buildPoolOptions(
        { workerChoiceStrategyOptions: { weights: { 0: 1 } } },
        2
      )
    ).toThrow(
      'Invalid worker choice strategy options: must have a weight for each worker node'
    )
  })
})
