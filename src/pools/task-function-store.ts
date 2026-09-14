import type { TaskFunctionProperties } from '../utility-types.js'
import type { TaskFunctionObject } from '../worker/task-functions.js'
import type { WorkerChoiceStrategy } from './selection-strategies/selection-strategies-types.js'
import type { TaskFunctionCatalogSnapshot } from './task-function-catalog.js'

import { buildTaskFunctionProperties, DEFAULT_TASK_NAME } from '../utils.js'

export type TaskFunctionPropertiesByWorker =
  readonly (readonly TaskFunctionProperties[])[]

export class TaskFunctionStore<Data = unknown, Response = unknown> {
  public get size (): number {
    return this.#snapshot().entries.length
  }

  readonly #snapshot: () => TaskFunctionCatalogSnapshot<Data, Response>

  public constructor (
    snapshot: () => TaskFunctionCatalogSnapshot<Data, Response>
  ) {
    this.#snapshot = snapshot
  }

  public get (name: string): TaskFunctionObject<Data, Response> | undefined {
    return this.#snapshot().entries.find(entry => entry.name === name)
      ?.taskFunction
  }

  public has (
    name: string,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): boolean {
    return this.listProperties(propertiesByWorker).some(
      properties => properties.name === name
    )
  }

  public hasRegistered (name: string): boolean {
    return this.get(name) != null
  }

  public listProperties (
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): readonly TaskFunctionProperties[] {
    const staticProperties =
      propertiesByWorker.find(properties => properties.length > 0) ?? []
    const byName = new Map(
      staticProperties
        .filter(properties => properties.name !== DEFAULT_TASK_NAME)
        .map(properties => [properties.name, properties])
    )
    const snapshot = this.#snapshot()
    for (const entry of snapshot.entries) {
      byName.set(
        entry.name,
        buildTaskFunctionProperties(entry.name, entry.taskFunction)
      )
    }
    const entries = [...byName.values()]
    const defaultName =
      snapshot.defaultName === DEFAULT_TASK_NAME
        ? staticProperties.at(1)?.name
        : snapshot.defaultName
    const defaultProperties = byName.get(defaultName ?? '') ??
      staticProperties.at(0) ?? { name: DEFAULT_TASK_NAME }
    return [
      { ...defaultProperties, name: DEFAULT_TASK_NAME },
      ...entries.sort((left, right) => {
        if (left.name === defaultName) return -1
        if (right.name === defaultName) return 1
        return 0
      }),
    ]
  }

  public priority (
    name: string | undefined,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): number | undefined {
    return this.#findProperties(name, propertiesByWorker)?.priority
  }

  public propertiesOf (name: string): TaskFunctionProperties {
    return buildTaskFunctionProperties(name, this.get(name))
  }

  public strategy (
    name: string | undefined,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): undefined | WorkerChoiceStrategy {
    return this.#findProperties(name, propertiesByWorker)?.strategy
  }

  public * [Symbol.iterator] (): IterableIterator<
    [string, TaskFunctionObject<Data, Response>]
  > {
    for (const entry of this.#snapshot().entries) {
      yield [entry.name, entry.taskFunction]
    }
  }

  public usesPriority (
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): boolean {
    return this.listProperties(propertiesByWorker).some(
      properties => properties.priority != null
    )
  }

  public workerChoiceStrategies (
    defaultStrategy: WorkerChoiceStrategy,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): Set<WorkerChoiceStrategy> {
    const strategies = new Set<WorkerChoiceStrategy>([defaultStrategy])
    for (const properties of this.listProperties(propertiesByWorker)) {
      if (properties.strategy != null) strategies.add(properties.strategy)
    }
    return strategies
  }

  public workerNodeKeys (
    name: string | undefined,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): ReadonlySet<number> | undefined {
    const workerNodeKeys = this.#findProperties(
      name,
      propertiesByWorker
    )?.workerNodeKeys
    return workerNodeKeys == null ? undefined : new Set(workerNodeKeys)
  }

  #findProperties (
    name: string | undefined,
    propertiesByWorker: TaskFunctionPropertiesByWorker
  ): TaskFunctionProperties | undefined {
    const properties = this.listProperties(propertiesByWorker)
    const resolvedName =
      name == null || name === DEFAULT_TASK_NAME ? DEFAULT_TASK_NAME : name
    return properties.find(candidate => candidate.name === resolvedName)
  }
}
