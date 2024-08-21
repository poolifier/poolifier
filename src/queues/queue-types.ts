/**
 * Default queue size.
 * @internal
 */
export const defaultQueueSize = 2048

/**
 * Fixed queue node.
 * @typeParam T - Type of fixed queue node data.
 * @internal
 */
export interface FixedQueueNode<T> {
  data: T
  priority: number
}

/**
 * Fixed queue.
 * @typeParam T - Type of fixed queue data.
 * @internal
 */
export interface IFixedQueue<T> {
  /**
   * Returns an iterator for the fixed queue.
   * @returns An iterator for the fixed queue.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
   */
  [Symbol.iterator]: () => Iterator<T>
  /** The fixed queue capacity. */
  readonly capacity: number
  /**
   * Clears the fixed queue.
   */
  clear: () => void
  /**
   * Dequeue data from the fixed queue.
   * @returns The dequeued data or `undefined` if the fixed queue is empty.
   */
  dequeue: () => T | undefined
  /**
   * Checks if the fixed queue is empty.
   * @returns `true` if the fixed queue is empty, `false` otherwise.
   */
  empty: () => boolean
  /**
   * Enqueue data into the fixed queue.
   * @param data - Data to enqueue.
   * @param priority - Priority of the data. Lower values have higher priority.
   * @returns The new size of the fixed queue.
   * @throws If the fixed queue is full.
   */
  enqueue: (data: T, priority?: number) => number
  /**
   * Checks if the fixed queue is full.
   * @returns `true` if the fixed queue is full, `false` otherwise.
   */
  full: () => boolean
  /**
   * Gets data from the fixed queue.
   * @param index - The index of the data to get.
   * @returns The data at the index or `undefined` if the fixed queue is empty or the index is out of bounds.
   */
  get: (index: number) => T | undefined
  /** The fixed queue node array. */
  nodeArray: FixedQueueNode<T>[]
  /** The fixed queue size. */
  readonly size: number
}

/**
 * Default bucket size.
 * @internal
 */
export const defaultBucketSize = 2048

/**
 * Priority queue node.
 * @typeParam T - Type of priority queue node data.
 * @internal
 */
export interface PriorityQueueNode<T> extends IFixedQueue<T> {
  next?: IFixedQueue<T>
}
