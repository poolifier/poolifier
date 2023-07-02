/**
 * Enumeration of worker choice strategies.
 */
export const WorkerChoiceStrategies = Object.freeze({
  /**
   * Round robin worker selection strategy.
   */
  ROUND_ROBIN: 'ROUND_ROBIN',
  /**
   * Least used worker selection strategy.
   */
  LEAST_USED: 'LEAST_USED',
  /**
   * Least busy worker selection strategy.
   */
  LEAST_BUSY: 'LEAST_BUSY',
  /**
   * Least ELU worker selection strategy.
   *
   * @experimental
   */
  LEAST_ELU: 'LEAST_ELU',
  /**
   * Fair share worker selection strategy.
   */
  FAIR_SHARE: 'FAIR_SHARE',
  /**
   * Weighted round robin worker selection strategy.
   */
  WEIGHTED_ROUND_ROBIN: 'WEIGHTED_ROUND_ROBIN',
  /**
   * Interleaved weighted round robin worker selection strategy.
   *
   * @experimental
   */
  INTERLEAVED_WEIGHTED_ROUND_ROBIN: 'INTERLEAVED_WEIGHTED_ROUND_ROBIN'
} as const)

/**
 * Worker choice strategy.
 */
export type WorkerChoiceStrategy = keyof typeof WorkerChoiceStrategies

/**
 * Enumeration of measurements.
 */
export const Measurements = Object.freeze({
  runTime: 'runTime',
  waitTime: 'waitTime',
  elu: 'elu'
} as const)

/**
 * Measurement.
 */
export type Measurement = keyof typeof Measurements

/**
 * Measurement options.
 */
export interface MeasurementOptions {
  /**
   * Set measurement median.
   */
  readonly median: boolean
}

/**
 * Worker choice strategy options.
 */
export interface WorkerChoiceStrategyOptions {
  /**
   * Measurement to use for worker choice strategy.
   */
  readonly measurement?: Measurement
  /**
   * Runtime options.
   *
   * @defaultValue \{ median: false \}
   */
  readonly runTime?: MeasurementOptions
  /**
   * Wait time options.
   *
   * @defaultValue \{ median: false \}
   */
  readonly waitTime?: MeasurementOptions
  /**
   * Event loop utilization options.
   *
   * @defaultValue \{ median: false \}
   */
  readonly elu?: MeasurementOptions
  /**
   * Worker weights to use for weighted round robin worker selection strategy.
   * Weight is the tasks maximum average or median runtime in milliseconds.
   *
   * @defaultValue Computed worker weights automatically given the CPU performance.
   */
  readonly weights?: Record<number, number>
}

/**
 * Measurement statistics requirements.
 *
 * @internal
 */
export interface MeasurementStatisticsRequirements {
  /**
   * Requires measurement aggregate.
   */
  aggregate: boolean
  /**
   * Requires measurement average.
   */
  average: boolean
  /**
   * Requires measurement median.
   */
  median: boolean
}

/**
 * Pool worker node worker usage statistics requirements.
 *
 * @internal
 */
export interface TaskStatisticsRequirements {
  /**
   * Tasks runtime requirements.
   */
  readonly runTime: MeasurementStatisticsRequirements
  /**
   * Tasks wait time requirements.
   */
  readonly waitTime: MeasurementStatisticsRequirements
  /**
   * Tasks event loop utilization requirements.
   */
  readonly elu: MeasurementStatisticsRequirements
}

/**
 * Strategy policy.
 *
 * @internal
 */
export interface StrategyPolicy {
  /**
   * Expects direct usage of dynamic worker.
   */
  readonly useDynamicWorker: boolean
}

/**
 * Worker choice strategy interface.
 */
export interface IWorkerChoiceStrategy {
  /**
   * Strategy policy.
   */
  readonly strategyPolicy: StrategyPolicy
  /**
   * Tasks statistics requirements.
   */
  readonly taskStatisticsRequirements: TaskStatisticsRequirements
  /**
   * Resets strategy internals.
   *
   * @returns `true` if the reset is successful, `false` otherwise.
   */
  reset: () => boolean
  /**
   * Updates the worker node key strategy internals.
   *
   * @returns `true` if the update is successful, `false` otherwise.
   */
  update: (workerNodeKey: number) => boolean
  /**
   * Chooses a worker node in the pool and returns its key.
   *
   * @returns The worker node key.
   */
  choose: () => number
  /**
   * Removes the worker node key from strategy internals.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node key is removed, `false` otherwise.
   */
  remove: (workerNodeKey: number) => boolean
  /**
   * Sets the worker choice strategy options.
   *
   * @param opts - The worker choice strategy options.
   */
  setOptions: (opts: WorkerChoiceStrategyOptions) => void
}
