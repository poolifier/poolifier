import type { TaskFunctionObject } from '../worker/task-functions.js'

import { DEFAULT_TASK_NAME } from '../utils.js'

export type TaskFunctionCatalogEntry<Data, Response> = Readonly<{
  name: string
  taskFunction: TaskFunctionObject<Data, Response>
}>

export type TaskFunctionCatalogSnapshot<Data, Response> = Readonly<{
  defaultName: string
  entries: readonly TaskFunctionCatalogEntry<Data, Response>[]
  revision: number
}>

export class TaskFunctionCatalog<Data = unknown, Response = unknown> {
  readonly #entries: ReadonlyMap<string, TaskFunctionObject<Data, Response>>

  private constructor (
    entries: ReadonlyMap<string, TaskFunctionObject<Data, Response>>,
    public readonly defaultName: string,
    public readonly revision: number
  ) {
    this.#entries = entries
  }

  public static empty<
    Data = unknown,
    Response = unknown
  >(): TaskFunctionCatalog<Data, Response> {
    return new TaskFunctionCatalog(new Map(), DEFAULT_TASK_NAME, 0)
  }

  public add (
    name: string,
    taskFunction: TaskFunctionObject<Data, Response>
  ): TaskFunctionCatalog<Data, Response> {
    return new TaskFunctionCatalog(
      new Map(this.#entries).set(name, taskFunction),
      this.defaultName,
      this.revision + 1
    )
  }

  public get (name: string): TaskFunctionObject<Data, Response> | undefined {
    return this.#entries.get(name)
  }

  public has (name: string): boolean {
    return this.#entries.has(name)
  }

  public initializeDefault (name: string): TaskFunctionCatalog<Data, Response> {
    if (this.defaultName !== DEFAULT_TASK_NAME && this.defaultName !== name) {
      throw new Error('Task function catalog static default is inconsistent')
    }
    return this.defaultName === name
      ? this
      : new TaskFunctionCatalog(this.#entries, name, this.revision)
  }

  public remove (
    name: string,
    preserveDefaultName = false
  ): TaskFunctionCatalog<Data, Response> {
    const entries = new Map(this.#entries)
    entries.delete(name)
    return new TaskFunctionCatalog(
      entries,
      this.defaultName === name && !preserveDefaultName
        ? DEFAULT_TASK_NAME
        : this.defaultName,
      this.revision + 1
    )
  }

  public setDefault (name: string): TaskFunctionCatalog<Data, Response> {
    return new TaskFunctionCatalog(this.#entries, name, this.revision + 1)
  }

  public snapshot (): TaskFunctionCatalogSnapshot<Data, Response> {
    return Object.freeze({
      defaultName: this.defaultName,
      entries: Object.freeze(
        [...this.#entries]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, taskFunction]) => Object.freeze({ name, taskFunction }))
      ),
      revision: this.revision,
    })
  }
}
