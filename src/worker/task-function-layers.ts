import type { TaskFunctionProperties } from '../utility-types.js'
import type { TaskFunctionObject } from './task-functions.js'

import { buildTaskFunctionProperties, DEFAULT_TASK_NAME } from '../utils.js'

export class TaskFunctionLayers<Data = unknown, Response = unknown> extends Map<
  string,
  TaskFunctionObject<Data, Response>
> {
  public get defaultName (): string {
    return this.#defaultName
  }

  public override get size (): number {
    return [...this.#effectiveKeys()].length
  }

  #defaultName: string
  readonly #overlay = new Map<string, TaskFunctionObject<Data, Response>>()

  public constructor (
    staticTaskFunctions: Map<string, TaskFunctionObject<Data, Response>>,
    defaultName: string
  ) {
    super()
    this.#defaultName = defaultName
    for (const [name, taskFunction] of staticTaskFunctions) {
      super.set(name, taskFunction)
    }
  }

  public addOverlay (
    name: string,
    taskFunction: TaskFunctionObject<Data, Response>
  ): void {
    this.#overlay.set(name, taskFunction)
  }

  public override clear (): void {
    this.#overlay.clear()
    super.clear()
  }

  public override delete (name: string): boolean {
    const effectiveName = name === DEFAULT_TASK_NAME ? this.#defaultName : name
    const existed = this.has(effectiveName)
    this.#overlay.delete(effectiveName)
    super.delete(effectiveName)
    return existed
  }

  public override entries (): MapIterator<
    [string, TaskFunctionObject<Data, Response>]
  > {
    return this.#effectiveEntries()[Symbol.iterator]()
  }

  public override forEach (
    callbackfn: (
      value: TaskFunctionObject<Data, Response>,
      key: string,
      map: Map<string, TaskFunctionObject<Data, Response>>
    ) => void,
    thisArg?: unknown
  ): void {
    for (const [name, taskFunction] of this) {
      callbackfn.call(thisArg, taskFunction, name, this)
    }
  }

  public override get (
    name: string
  ): TaskFunctionObject<Data, Response> | undefined {
    const effectiveName = name === DEFAULT_TASK_NAME ? this.#defaultName : name
    return this.#overlay.get(effectiveName) ?? super.get(effectiveName)
  }

  public override has (name: string): boolean {
    return this.get(name) != null
  }

  public override keys (): MapIterator<string> {
    return this.#effectiveKeys()
  }

  public listEffectiveProperties (): TaskFunctionProperties[] {
    const defaultTaskFunction = this.get(DEFAULT_TASK_NAME)
    if (defaultTaskFunction == null) return []
    return [
      buildTaskFunctionProperties(DEFAULT_TASK_NAME, defaultTaskFunction),
      ...(this.#defaultName !== DEFAULT_TASK_NAME
        ? [buildTaskFunctionProperties(this.#defaultName, defaultTaskFunction)]
        : []),
      ...[...this]
        .filter(
          ([name]) => name !== DEFAULT_TASK_NAME && name !== this.#defaultName
        )
        .map(([name, taskFunction]) =>
          buildTaskFunctionProperties(name, taskFunction)
        ),
    ]
  }

  public listStaticProperties (): TaskFunctionProperties[] {
    const defaultTaskFunction = super.get(this.#defaultName)
    if (defaultTaskFunction == null) return []
    return [
      buildTaskFunctionProperties(DEFAULT_TASK_NAME, defaultTaskFunction),
      ...(this.#defaultName !== DEFAULT_TASK_NAME
        ? [buildTaskFunctionProperties(this.#defaultName, defaultTaskFunction)]
        : []),
      ...[...super.entries()]
        .filter(
          ([name]) => name !== DEFAULT_TASK_NAME && name !== this.#defaultName
        )
        .map(([name, taskFunction]) =>
          buildTaskFunctionProperties(name, taskFunction)
        ),
    ]
  }

  public removeOverlay (name: string): boolean {
    if (name === this.#defaultName && super.get(name) == null) {
      return false
    }
    return this.#overlay.delete(name)
  }

  public removePermanently (name: string): boolean {
    const existed = this.has(name)
    this.#overlay.delete(name)
    super.delete(name)
    return existed
  }

  public override set (
    name: string,
    taskFunction: TaskFunctionObject<Data, Response>
  ): this {
    super.set(
      name === DEFAULT_TASK_NAME ? this.#defaultName : name,
      taskFunction
    )
    return this
  }

  public setDefault (name: string): boolean {
    if (!this.has(name)) return false
    this.#defaultName = name
    return true
  }

  public override [Symbol.iterator] (): MapIterator<
    [string, TaskFunctionObject<Data, Response>]
  > {
    return this.entries()
  }

  public override values (): MapIterator<TaskFunctionObject<Data, Response>> {
    return this.#effectiveValues()
  }

  * #effectiveEntries (): MapIterator<
    [string, TaskFunctionObject<Data, Response>]
  > {
    const defaultTaskFunction = this.get(DEFAULT_TASK_NAME)
    if (defaultTaskFunction != null) {
      yield [DEFAULT_TASK_NAME, defaultTaskFunction]
    }
    const names = new Set([...super.keys(), ...this.#overlay.keys()])
    names.delete(DEFAULT_TASK_NAME)
    for (const name of names) {
      const taskFunction = this.get(name)
      if (taskFunction != null) yield [name, taskFunction]
    }
  }

  * #effectiveKeys (): MapIterator<string> {
    for (const [name] of this.#effectiveEntries()) yield name
  }

  * #effectiveValues (): MapIterator<TaskFunctionObject<Data, Response>> {
    for (const [, taskFunction] of this.#effectiveEntries()) yield taskFunction
  }
}
