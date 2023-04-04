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
 * Pool tasks usage statistics requirements.
 */
export interface RequiredStatistics {
  runTime: boolean
  avgRunTime: boolean
}

/**
 * Worker choice strategy interface.
 */
export interface IWorkerChoiceStrategy {
  /**
   * Is the pool attached to the strategy dynamic?.
   */
  readonly isDynamicPool: boolean
  /**
   * Required pool tasks usage statistics.
   */
  readonly requiredStatistics: RequiredStatistics
  /**
   * Resets strategy internals (counters, statistics, etc.).
   */
  reset: () => boolean
  /**
   * Chooses a worker in the pool and returns its key.
   */
  choose: () => number
  /**
   * Removes a worker reference from strategy internals.
   *
   * @param workerKey - The worker key.
   */
  remove: (workerKey: number) => boolean
}
