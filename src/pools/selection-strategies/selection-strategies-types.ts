import type { IPoolWorker } from '../pool-worker'

/**
 * Enumeration of worker choice strategies.
 */
export const WorkerChoiceStrategies = Object.freeze({
  /**
   * Round robin worker selection strategy.
   */
  ROUND_ROBIN: 'ROUND_ROBIN',
  /**
   * Less recently used worker selection strategy.
   */
  LESS_RECENTLY_USED: 'LESS_RECENTLY_USED',
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
export type RequiredStatistics = {
  runTime: boolean
}

/**
 * Worker choice strategy interface.
 *
 * @template Worker Type of worker which manages the strategy.
 */
export interface IWorkerChoiceStrategy<Worker extends IPoolWorker> {
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
  reset(): boolean
  /**
   * Chooses a worker in the pool.
   */
  choose(): Worker
}
