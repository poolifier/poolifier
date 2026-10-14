import cluster, {
  type ClusterSettings,
  Worker as ClusterWorker,
} from 'node:cluster'
import { existsSync } from 'node:fs'
import {
  SHARE_ENV,
  Worker as ThreadWorker,
  type WorkerOptions,
} from 'node:worker_threads'

import type { MessageValue, Task } from '../utility-types.js'
import type { TasksQueueOptions } from './pool.js'
import type { WorkerChoiceStrategiesContext } from './selection-strategies/worker-choice-strategies-context.js'

import {
  defaultAgingFactor,
  defaultLoadExponent,
} from '../queues/queue-types.js'
import { average, isPlainObject, max, median, min } from '../utils.js'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
} from './selection-strategies/selection-strategies-types.js'
import {
  type IWorker,
  type IWorkerNode,
  type MeasurementStatistics,
  type WorkerInfo,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage,
} from './worker.js'

/**
 * Default measurement statistics requirements.
 */
export const DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS: Readonly<MeasurementStatisticsRequirements> =
  Object.freeze({
    aggregate: false,
    average: false,
    median: false,
  })

/**
 * Copies own enumerable properties into an object without a prototype.
 * @param sources - Objects to copy properties from.
 * @returns A new object without a prototype.
 * @internal
 */
export const withNullPrototype = <T extends object>(
  ...sources: (Partial<T> | undefined)[]
): T => {
  const target = Object.create(null) as T
  Object.assign(target, ...sources)
  return target
}

const defineEnumerableDataProperty = (
  target: object,
  key: PropertyKey,
  value: unknown
): void => {
  const descriptor = Object.create(null) as PropertyDescriptor
  descriptor.configurable = true
  descriptor.enumerable = true
  descriptor.value = value
  descriptor.writable = true
  Object.defineProperty(target, key, descriptor)
}

const cloneDenseExecArgv = (
  execArgv: readonly string[],
  optionName: string
): string[] => {
  const clone = new Array<string>(execArgv.length)
  for (let index = 0; index < execArgv.length; index++) {
    if (!Object.hasOwn(execArgv, index)) {
      throw new TypeError(`Invalid ${optionName}: must not be a sparse array`)
    }
    defineEnumerableDataProperty(clone, index, execArgv[index])
  }
  return clone
}

const cloneArrayOwnSlots = <T>(values: readonly T[]): T[] => {
  const clone = new Array<T>(values.length)
  for (let index = 0; index < values.length; index++) {
    if (Object.hasOwn(values, index)) {
      defineEnumerableDataProperty(clone, index, values[index])
    }
  }
  Object.setPrototypeOf(clone, null)
  return clone
}

const materializeArray = <T>(values: readonly T[]): (T | undefined)[] => {
  const clone = new Array<T | undefined>(values.length)
  for (let index = 0; index < values.length; index++) {
    defineEnumerableDataProperty(
      clone,
      index,
      Object.hasOwn(values, index) ? values[index] : undefined
    )
  }
  return clone
}

const isOwnPlainObject = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value) as null | object
  return prototype === null || prototype === Object.prototype
}

const normalizeStdioDescriptor = (value: unknown): unknown => {
  if (!isOwnPlainObject(value)) {
    return value
  }
  const descriptor = Object.create(null) as Record<PropertyKey, unknown>
  for (const key of ['fd', 'handle', '_handle']) {
    defineEnumerableDataProperty(descriptor, key, undefined)
  }
  for (const key of Reflect.ownKeys(value)) {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(value, key)
    if (propertyDescriptor != null) {
      Object.setPrototypeOf(propertyDescriptor, null)
      Object.defineProperty(descriptor, key, propertyDescriptor)
    }
  }
  return descriptor
}

const cloneStdio = (stdio: readonly unknown[]): unknown[] => {
  const clone = new Array<unknown>(stdio.length)
  for (let index = 0; index < stdio.length; index++) {
    defineEnumerableDataProperty(
      clone,
      index,
      Object.hasOwn(stdio, index)
        ? normalizeStdioDescriptor(stdio[index])
        : undefined
    )
  }
  return clone
}

const getPropertyOwner = (value: object, key: string): null | object => {
  let owner: null | object = value
  while (owner !== null && !Object.hasOwn(owner, key)) {
    owner = Object.getPrototypeOf(owner) as null | object
  }
  return owner
}

const getStdioControlValue = (
  entry: object,
  key: string,
  owner: null | object
): unknown => {
  if (owner !== Object.prototype) {
    return owner === null ? undefined : Reflect.get(entry, key)
  }
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, key)
  if (descriptor == null) {
    return undefined
  }
  if (!Object.hasOwn(descriptor, 'value')) {
    throw new TypeError(
      `Invalid cluster.settings.stdio entry: inherited accessor '${key}' from Object.prototype is not allowed`
    )
  }
  return descriptor.value
}

/**
 * Materializes missing cluster stdio slots and validates object-valued entries
 * before Node reads them.
 * @param stdio - Effective cluster stdio configuration.
 * @internal
 */
export const validateAndMaterializeClusterStdio = (stdio: unknown): void => {
  if (!Array.isArray(stdio)) {
    return
  }
  for (let index = 0; index < stdio.length; index++) {
    if (!Object.hasOwn(stdio, index)) {
      defineEnumerableDataProperty(stdio, index, undefined)
    }
  }
  for (const entry of stdio as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const fdOwner = getPropertyOwner(entry, 'fd')
    const fdValue = getStdioControlValue(entry, 'fd', fdOwner)
    if (typeof fdValue === 'number') {
      if (fdOwner === Object.prototype) {
        throw new TypeError(
          "Invalid cluster.settings.stdio entry: inherited 'fd' from Object.prototype is not allowed"
        )
      }
      continue
    }
    for (const key of ['handle', '_handle']) {
      const owner = getPropertyOwner(entry, key)
      const value = getStdioControlValue(entry, key, owner)
      if (
        owner === Object.prototype &&
        ((typeof value === 'object' && value !== null) ||
          typeof value === 'function')
      ) {
        throw new TypeError(
          `Invalid cluster.settings.stdio entry: inherited '${key}' from Object.prototype is not allowed`
        )
      }
    }
  }
}

const normalizeResourceLimits = (resourceLimits: object): object => {
  const normalizedResourceLimits = Object.create(null) as Record<
    string,
    unknown
  >
  for (const key of [
    'maxYoungGenerationSizeMb',
    'maxOldGenerationSizeMb',
    'codeRangeSizeMb',
    'stackSizeMb',
  ]) {
    if (Object.hasOwn(resourceLimits, key)) {
      defineEnumerableDataProperty(
        normalizedResourceLimits,
        key,
        Reflect.get(resourceLimits, key)
      )
    }
  }
  return normalizedResourceLimits
}

/**
 * Builds the environment passed through Node's cluster boundary.
 * @param processEnv - The process environment.
 * @param workerEnv - Explicit worker environment entries.
 * @param caseInsensitive - Whether environment names are case-insensitive.
 * @returns A normalized environment without a prototype.
 * @internal
 */
export const buildClusterWorkerEnvironment = (
  processEnv: NodeJS.ProcessEnv,
  workerEnv: Record<string, unknown> | undefined,
  caseInsensitive = process.platform === 'win32'
): Record<string, unknown> => {
  if (!caseInsensitive) {
    const environment = withNullPrototype<Record<string, unknown>>(
      processEnv,
      workerEnv
    )
    for (const key of Object.keys(Object.prototype)) {
      if (!Object.hasOwn(environment, key)) {
        environment[key] = undefined
      }
    }
    return environment
  }

  const effectiveEntries = new Map<string, { key: string; value: unknown }>()
  for (const source of [processEnv, workerEnv]) {
    if (source == null) {
      continue
    }
    const sourceEntries = new Map<string, string>()
    for (const key of Object.keys(source)) {
      const logicalKey = key.toUpperCase()
      const previousKey = sourceEntries.get(logicalKey)
      if (previousKey == null || key < previousKey) {
        sourceEntries.set(logicalKey, key)
      }
    }
    for (const [logicalKey, sourceKey] of sourceEntries) {
      const previousEntry = effectiveEntries.get(logicalKey)
      const key =
        previousEntry != null && previousEntry.key < sourceKey
          ? previousEntry.key
          : sourceKey
      effectiveEntries.set(logicalKey, { key, value: source[sourceKey] })
    }
  }

  const prototypeEntries = new Map<string, string>()
  for (const key of Object.keys(Object.prototype)) {
    const logicalKey = key.toUpperCase()
    const previousKey = prototypeEntries.get(logicalKey)
    if (previousKey == null || key < previousKey) {
      prototypeEntries.set(logicalKey, key)
    }
  }

  const environment = Object.create(null) as Record<string, unknown>
  for (const [logicalKey, effectiveEntry] of effectiveEntries) {
    const prototypeKey = prototypeEntries.get(logicalKey)
    const key =
      prototypeKey != null && prototypeKey < effectiveEntry.key
        ? prototypeKey
        : effectiveEntry.key
    environment[key] = effectiveEntry.value
  }
  for (const [logicalKey, prototypeKey] of prototypeEntries) {
    if (!effectiveEntries.has(logicalKey)) {
      environment[prototypeKey] = undefined
    }
  }
  return environment
}

/**
 * Builds cluster settings safe for Node's ordinary-object reconstruction.
 * @param currentSettings - Current Node cluster settings.
 * @param settings - Explicit pool cluster settings.
 * @param exec - Pool worker executable.
 * @returns Normalized cluster settings.
 * @internal
 */
export const buildClusterSettings = (
  currentSettings: ClusterSettings | undefined,
  settings: ClusterSettings | undefined,
  exec: string
): ClusterSettings => {
  const normalizedSettings = withNullPrototype<ClusterSettings>(
    {
      cwd: undefined,
      gid: undefined,
      inspectPort: undefined,
      serialization: undefined,
      stdio: undefined,
      uid: undefined,
      windowsHide: undefined,
    },
    currentSettings,
    settings,
    { exec }
  )
  if (Array.isArray(normalizedSettings.args)) {
    normalizedSettings.args = materializeArray(
      normalizedSettings.args
    ) as string[]
  }
  if (Array.isArray(normalizedSettings.execArgv)) {
    normalizedSettings.execArgv = cloneDenseExecArgv(
      normalizedSettings.execArgv,
      'settings.execArgv'
    )
  }
  if (Array.isArray(normalizedSettings.stdio)) {
    normalizedSettings.stdio = cloneStdio(normalizedSettings.stdio)
  }
  return normalizedSettings
}

/**
 * Builds options for a worker thread launch.
 * @param workerOptions - Explicit worker options.
 * @returns Normalized worker options.
 * @internal
 */
export const buildThreadWorkerOptions = (
  workerOptions: undefined | WorkerOptions
): WorkerOptions => {
  const normalizedWorkerOptions = withNullPrototype<WorkerOptions>(
    { env: SHARE_ENV },
    workerOptions
  )
  if (Array.isArray(normalizedWorkerOptions.argv)) {
    normalizedWorkerOptions.argv = cloneArrayOwnSlots(
      normalizedWorkerOptions.argv
    )
  }
  if (Array.isArray(normalizedWorkerOptions.execArgv)) {
    normalizedWorkerOptions.execArgv = cloneDenseExecArgv(
      normalizedWorkerOptions.execArgv,
      'workerOptions.execArgv'
    )
  }
  if (
    Object.hasOwn(normalizedWorkerOptions, 'resourceLimits') &&
    typeof normalizedWorkerOptions.resourceLimits === 'object' &&
    // Node accepts null as the absence of resource limits at runtime.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    normalizedWorkerOptions.resourceLimits !== null
  ) {
    normalizedWorkerOptions.resourceLimits = normalizeResourceLimits(
      normalizedWorkerOptions.resourceLimits
    )
  }
  if (Array.isArray(normalizedWorkerOptions.transferList)) {
    normalizedWorkerOptions.transferList = materializeArray(
      normalizedWorkerOptions.transferList
    ) as NonNullable<WorkerOptions['transferList']>
  }
  return normalizedWorkerOptions
}

export const getDefaultTasksQueueOptions = (
  poolMaxSize: number
): Required<Readonly<TasksQueueOptions>> => {
  return Object.freeze({
    agingFactor: defaultAgingFactor,
    concurrency: 1,
    loadExponent: defaultLoadExponent,
    size: poolMaxSize ** 2,
    tasksFinishedTimeout: 2000,
    tasksStealingOnBackPressure: true,
    tasksStealingRatio: 0.6,
    taskStealing: true,
  })
}

export const checkFilePath = (filePath: string | undefined): void => {
  if (filePath == null) {
    throw new TypeError('The worker file path must be defined')
  }
  if (typeof filePath !== 'string') {
    throw new TypeError('The worker file path must be a string')
  }
  if (!existsSync(filePath)) {
    throw new Error(`Cannot find the worker file '${filePath}'`)
  }
}

export const checkDynamicPoolSize = (
  min: number,
  max: number | undefined
): void => {
  if (max == null) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool without specifying the maximum pool size'
    )
  }
  if (!Number.isSafeInteger(max)) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool with a non safe integer maximum pool size'
    )
  }
  if (min > max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size'
    )
  }
  if (max === 0) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size equal to zero'
    )
  }
  if (min === max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead'
    )
  }
}

export const checkValidPriority = (priority: number | undefined): void => {
  if (priority != null && !Number.isSafeInteger(priority)) {
    throw new TypeError(`Invalid property 'priority': '${priority.toString()}'`)
  }
  if (
    priority != null &&
    Number.isSafeInteger(priority) &&
    (priority < -20 || priority > 19)
  ) {
    throw new RangeError("Property 'priority' must be between -20 and 19")
  }
}

export const checkValidWorkerChoiceStrategy = (
  workerChoiceStrategy: undefined | WorkerChoiceStrategy
): void => {
  if (
    workerChoiceStrategy != null &&
    !Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)
  ) {
    throw new Error(`Invalid worker choice strategy '${workerChoiceStrategy}'`)
  }
}

export const checkValidWorkerNodeKeys = (
  workerNodeKeys: null | number[] | undefined,
  maxPoolSize?: number
): void => {
  if (workerNodeKeys != null && !Array.isArray(workerNodeKeys)) {
    throw new TypeError('Invalid worker node keys: must be an array')
  }
  if (workerNodeKeys?.length === 0) {
    throw new RangeError('Invalid worker node keys: must not be an empty array')
  }
  if (workerNodeKeys != null) {
    for (const workerNodeKey of workerNodeKeys) {
      if (!Number.isSafeInteger(workerNodeKey) || workerNodeKey < 0) {
        throw new TypeError(
          `Invalid worker node key '${workerNodeKey.toString()}': must be a non-negative safe integer`
        )
      }
    }
  }
  if (
    workerNodeKeys != null &&
    new Set(workerNodeKeys).size !== workerNodeKeys.length
  ) {
    throw new TypeError('Invalid worker node keys: must not contain duplicates')
  }
  if (maxPoolSize != null && workerNodeKeys != null) {
    if (workerNodeKeys.length > maxPoolSize) {
      throw new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool'
      )
    }
    const invalidWorkerNodeKeys = workerNodeKeys.filter(
      workerNodeKey => workerNodeKey >= maxPoolSize
    )
    if (invalidWorkerNodeKeys.length > 0) {
      throw new RangeError(
        `Cannot add a task function with invalid worker node keys: ${invalidWorkerNodeKeys.toString()}. Valid keys are: 0..${(maxPoolSize - 1).toString()}`
      )
    }
  }
}

export const checkValidTasksQueueOptions = (
  tasksQueueOptions: TasksQueueOptions | undefined
): void => {
  if (tasksQueueOptions != null && !isPlainObject(tasksQueueOptions)) {
    throw new TypeError('Invalid tasks queue options: must be a plain object')
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    !Number.isSafeInteger(tasksQueueOptions.concurrency)
  ) {
    throw new TypeError(
      'Invalid worker node tasks concurrency: must be an integer'
    )
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    tasksQueueOptions.concurrency <= 0
  ) {
    throw new RangeError(
      `Invalid worker node tasks concurrency: ${tasksQueueOptions.concurrency.toString()} is a negative integer or zero`
    )
  }
  if (
    tasksQueueOptions?.size != null &&
    !Number.isSafeInteger(tasksQueueOptions.size)
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue size: must be an integer'
    )
  }
  if (tasksQueueOptions?.size != null && tasksQueueOptions.size <= 0) {
    throw new RangeError(
      `Invalid worker node tasks queue size: ${tasksQueueOptions.size.toString()} is a negative integer or zero`
    )
  }
  if (
    tasksQueueOptions?.agingFactor != null &&
    typeof tasksQueueOptions.agingFactor !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue aging factor: must be a number'
    )
  }
  if (
    tasksQueueOptions?.agingFactor != null &&
    tasksQueueOptions.agingFactor < 0
  ) {
    throw new RangeError(
      'Invalid worker node tasks queue aging factor: must be greater than or equal to 0'
    )
  }
  if (
    tasksQueueOptions?.loadExponent != null &&
    typeof tasksQueueOptions.loadExponent !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue load exponent: must be a number'
    )
  }
  if (
    tasksQueueOptions?.loadExponent != null &&
    tasksQueueOptions.loadExponent <= 0
  ) {
    throw new RangeError(
      'Invalid worker node tasks queue load exponent: must be greater than 0'
    )
  }
  if (
    tasksQueueOptions?.tasksStealingRatio != null &&
    typeof tasksQueueOptions.tasksStealingRatio !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks stealing ratio: must be a number'
    )
  }
  if (
    tasksQueueOptions?.tasksStealingRatio != null &&
    (tasksQueueOptions.tasksStealingRatio < 0 ||
      tasksQueueOptions.tasksStealingRatio > 1)
  ) {
    throw new RangeError(
      'Invalid worker node tasks stealing ratio: must be between 0 and 1'
    )
  }
}

export const checkWorkerNodeArguments = (
  type: undefined | WorkerType,
  filePath: string | undefined,
  opts: undefined | WorkerNodeOptions
): void => {
  if (type == null) {
    throw new TypeError('Cannot construct a worker node without a worker type')
  }
  if (!Object.values(WorkerTypes).includes(type)) {
    throw new TypeError(
      `Cannot construct a worker node with an invalid worker type '${type}'`
    )
  }
  checkFilePath(filePath)
  if (opts == null) {
    throw new TypeError(
      'Cannot construct a worker node without worker node options'
    )
  }
  if (!isPlainObject(opts)) {
    throw new TypeError(
      'Cannot construct a worker node with invalid worker node options: must be a plain object'
    )
  }
  if (opts.tasksQueueBackPressureSize == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue back pressure size option'
    )
  }
  if (!Number.isSafeInteger(opts.tasksQueueBackPressureSize)) {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer'
    )
  }
  if (opts.tasksQueueBackPressureSize <= 0) {
    throw new RangeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer'
    )
  }
  if (opts.tasksQueueBucketSize == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue bucket size option'
    )
  }
  if (!Number.isSafeInteger(opts.tasksQueueBucketSize)) {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue bucket size option that is not an integer'
    )
  }
  if (opts.tasksQueueBucketSize <= 0) {
    throw new RangeError(
      'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer'
    )
  }
  if (opts.tasksQueuePriority == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue priority option'
    )
  }
  if (typeof opts.tasksQueuePriority !== 'boolean') {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue priority option that is not a boolean'
    )
  }
}

/**
 * Updates the given measurement statistics.
 * @param measurementStatistics - The measurement statistics to update.
 * @param measurementRequirements - The measurement statistics requirements.
 * @param measurementValue - The measurement value.
 * @internal
 */
const updateMeasurementStatistics = (
  measurementStatistics: MeasurementStatistics,
  measurementRequirements: MeasurementStatisticsRequirements | undefined,
  measurementValue: number | undefined
): void => {
  if (
    measurementRequirements != null &&
    measurementValue != null &&
    measurementRequirements.aggregate
  ) {
    measurementStatistics.aggregate =
      (measurementStatistics.aggregate ?? 0) + measurementValue
    measurementStatistics.minimum = min(
      measurementValue,
      measurementStatistics.minimum ?? Number.POSITIVE_INFINITY
    )
    measurementStatistics.maximum = max(
      measurementValue,
      measurementStatistics.maximum ?? Number.NEGATIVE_INFINITY
    )
    if (measurementRequirements.average || measurementRequirements.median) {
      measurementStatistics.history.put(measurementValue)
      if (measurementRequirements.average) {
        measurementStatistics.average = average(
          measurementStatistics.history.toArray()
        )
      } else if (measurementStatistics.average != null) {
        measurementStatistics.average = undefined
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = median(
          measurementStatistics.history.toArray()
        )
      } else if (measurementStatistics.median != null) {
        measurementStatistics.median = undefined
      }
    }
  }
}
export { updateMeasurementStatistics }

export const updateWaitTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
  workerChoiceStrategiesContext:
    | undefined
    | WorkerChoiceStrategiesContext<Worker, Data, Response>,
  workerUsage: WorkerUsage,
  task: Task<Data>
): void => {
  const timestamp = performance.now()
  const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
  updateMeasurementStatistics(
    workerUsage.waitTime,
    workerChoiceStrategiesContext?.getTaskStatisticsRequirements().waitTime,
    taskWaitTime
  )
}

export const updateTaskStatisticsWorkerUsage = <Response = unknown>(
  workerUsage: WorkerUsage,
  message: MessageValue<Response>
): void => {
  const workerTaskStatistics = workerUsage.tasks
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    workerTaskStatistics.executing != null &&
    workerTaskStatistics.executing > 0
  ) {
    --workerTaskStatistics.executing
  }
  if (message.workerError == null) {
    ++workerTaskStatistics.executed
  } else {
    ++workerTaskStatistics.failed
  }
}

export const updateRunTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
  workerChoiceStrategiesContext:
    | undefined
    | WorkerChoiceStrategiesContext<Worker, Data, Response>,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>
): void => {
  if (message.workerError != null) {
    return
  }
  updateMeasurementStatistics(
    workerUsage.runTime,
    workerChoiceStrategiesContext?.getTaskStatisticsRequirements().runTime,
    message.taskPerformance?.runTime ?? 0
  )
}

export const updateEluWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
>(
  workerChoiceStrategiesContext:
    | undefined
    | WorkerChoiceStrategiesContext<Worker, Data, Response>,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>
): void => {
  if (message.workerError != null) {
    return
  }
  const eluTaskStatisticsRequirements =
    workerChoiceStrategiesContext?.getTaskStatisticsRequirements().elu
  updateMeasurementStatistics(
    workerUsage.elu.active,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.active ?? 0
  )
  updateMeasurementStatistics(
    workerUsage.elu.idle,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.idle ?? 0
  )
  if (eluTaskStatisticsRequirements?.aggregate === true) {
    if (message.taskPerformance?.elu != null) {
      workerUsage.elu.count = (workerUsage.elu.count ?? 0) + 1
      workerUsage.elu.utilization =
        ((workerUsage.elu.utilization ?? 0) * (workerUsage.elu.count - 1) +
          message.taskPerformance.elu.utilization) /
        workerUsage.elu.count
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const createWorker = <Worker extends IWorker>(
  type: WorkerType,
  filePath: string,
  opts: { env?: Record<string, unknown>; workerOptions?: WorkerOptions }
): Worker => {
  switch (type) {
    case WorkerTypes.cluster:
      validateAndMaterializeClusterStdio(cluster.settings.stdio)
      return cluster.fork(
        buildClusterWorkerEnvironment(process.env, opts.env)
      ) as unknown as Worker
    case WorkerTypes.thread:
      return new ThreadWorker(
        filePath,
        buildThreadWorkerOptions(opts.workerOptions)
      ) as unknown as Worker
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown worker type '${type}'`)
  }
}

/**
 * Returns the worker type of the given worker.
 * @param worker - The worker to get the type of.
 * @returns The worker type of the given worker.
 * @internal
 */
const getWorkerType = (worker: IWorker): undefined | WorkerType => {
  if (worker instanceof ThreadWorker) {
    return WorkerTypes.thread
  }
  if (worker instanceof ClusterWorker) {
    return WorkerTypes.cluster
  }
}

/**
 * Returns the worker id of the given worker.
 * @param worker - The worker to get the id of.
 * @returns The worker id of the given worker.
 * @internal
 */
const getWorkerId = (worker: IWorker): number | undefined => {
  if (worker instanceof ThreadWorker) {
    return worker.threadId
  }
  if (worker instanceof ClusterWorker) {
    return worker.id
  }
}

export const initWorkerInfo = (worker: IWorker): WorkerInfo => {
  return {
    backPressure: false,
    backPressureStealing: false,
    continuousStealing: false,
    dynamic: false,
    id: getWorkerId(worker),
    queuedTaskAbortion: false,
    ready: false,
    stealing: false,
    stolen: false,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    type: getWorkerType(worker)!,
  }
}

export const waitWorkerNodeEvents = async <
  Worker extends IWorker,
  Data = unknown
>(
  workerNode: IWorkerNode<Worker, Data>,
  workerNodeEvent: string,
  numberOfEventsToWait: number,
  timeout: number,
  timeoutRejection = true
): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const listener = () => {
      ++events
      if (events >= numberOfEventsToWait) {
        if (timeoutHandle != null) clearTimeout(timeoutHandle)
        workerNode.off(workerNodeEvent, listener)
        resolve(events)
      }
    }
    const timeoutHandle =
      timeout >= 0
        ? setTimeout(() => {
          workerNode.off(workerNodeEvent, listener)
          timeoutRejection
            ? reject(
              new Error(
                    `Timed out after ${timeout.toString()}ms waiting for ${numberOfEventsToWait.toString()} '${workerNodeEvent}' events. Received ${events.toString()} events`
              )
            )
            : resolve(events)
        }, timeout)
        : undefined
    switch (workerNodeEvent) {
      case 'backPressure':
      case 'idle':
      case 'taskFinished':
        workerNode.on(workerNodeEvent, listener)
        break
      default:
        if (timeoutHandle != null) clearTimeout(timeoutHandle)
        reject(new Error('Invalid worker node event'))
    }
  })
}
