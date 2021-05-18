import type { IWorker } from '../abstract-pool'

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
  FAIR_SHARE: 'FAIR_SHARE'
} as const)

/**
 * Worker choice strategy.
 */
export type WorkerChoiceStrategy = keyof typeof WorkerChoiceStrategies

/**
 * Worker choice strategy interface.
 *
 * @template Worker Type of worker which manages the strategy.
 */
export interface IWorkerChoiceStrategy<Worker extends IWorker> {
  /**
   * Choose a worker in the pool.
   */
  choose(): Worker
}
