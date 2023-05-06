/**
 * Enumeration of worker choice strategies.
 */
export const WorkerChoiceStrategies = Object.freeze({
  /**
   * Round robin worker selection strategy.
   */
  ROUND_ROBIN: 'ROUND_ROBIN',
  /**
   * Less used worker selection strategy.
   */
  LESS_USED: 'LESS_USED',
  /**
   * Less busy worker selection strategy.
   */
  LESS_BUSY: 'LESS_BUSY',
  /**
   * Fair share worker selection strategy.
   */
  FAIR_SHARE: 'FAIR_SHARE',
  /**
   * Weighted round robin worker selection strategy.
   */
  WEIGHTED_ROUND_ROBIN: 'WEIGHTED_ROUND_ROBIN'
} as const)

/**
 * Worker choice strategy.
 */
export type WorkerChoiceStrategy = keyof typeof WorkerChoiceStrategies

/**
 * Worker choice strategy options.
 */
export interface WorkerChoiceStrategyOptions {
  /**
   * Use tasks median run time instead of average run time.
   *
   * @defaultValue false
   */
  medRunTime?: boolean
  /**
   * Worker weights to use for weighted round robin worker selection strategy.
   * Weight is the tasks maximum average or median runtime in milliseconds.
   *
   * @defaultValue Computed worker weights automatically given the CPU performance.
   */
  weights?: Record<number, number>
}

/**
 * Pool worker tasks usage statistics requirements.
 *
 * @internal
 */
export interface RequiredStatistics {
  /**
   * Require tasks run time.
   */
  runTime: boolean
  /**
   * Require tasks average run time.
   */
  avgRunTime: boolean
  /**
   * Require tasks median run time.
   */
  medRunTime: boolean
}

/**
 * Worker choice strategy interface.
 */
export interface IWorkerChoiceStrategy {
  /**
   * Required tasks usage statistics.
   */
  readonly requiredStatistics: RequiredStatistics
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
